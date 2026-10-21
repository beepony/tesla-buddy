import assert from "node:assert/strict";
import test from "node:test";
import { createApp } from "../src/app.mjs";
import { FixtureRepository } from "../src/fixture-repository.mjs";
import { MemoryStore, WechatNotifier, createWechatNotifier, startSoftwareUpdateWatcher } from "../src/wechat.mjs";

function fakeWechat() {
  const calls = [];
  const fetch = async (url, init = {}) => {
    calls.push({ url, body: init.body ? JSON.parse(init.body) : null });
    let body = {};
    if (url.includes("/sns/jscode2session")) {
      const code = new URL(url).searchParams.get("js_code");
      body = code === "bad" ? { errcode: 40029, errmsg: "invalid code" } : { openid: `openid-${code}`, session_key: "secret" };
    } else if (url.includes("/cgi-bin/stable_token")) {
      body = { access_token: "token-1", expires_in: 7200 };
    } else if (url.includes("/message/subscribe/send")) {
      body = calls.failNext ? { errcode: calls.failNext, errmsg: "fail" } : { errcode: 0, errmsg: "ok" };
      calls.failNext = null;
    }
    return { json: async () => body };
  };
  const notifier = new WechatNotifier({
    appId: "wx123", appSecret: "secret", templateId: "tmpl-1",
    store: new MemoryStore(), fetch, clock: () => new Date("2026-10-21T08:00:00Z")
  });
  return { notifier, calls };
}

async function request(app, method, path, body, authorization = "Bearer t") {
  let status;
  let payload;
  await app({ method, url: path, headers: { host: "localhost", authorization }, body }, {
    writeHead(code) { status = code; },
    end(text) { payload = JSON.parse(text); }
  });
  return { status, body: payload };
}

const updateVehicle = { id: "1", displayName: "我的 Model Y 长续航版全轮驱动高性能车型", softwareVersion: "2026.8.3.6", updateStatus: "available", availableSoftwareVersion: "2026.26.1" };

test("subscription endpoints resolve the openid on the server and require authentication", async () => {
  const { notifier } = fakeWechat();
  const app = createApp(new FixtureRepository(), undefined, "t", null, notifier);
  assert.deepEqual((await request(app, "GET", "/v1/wechat/config")).body.data, { configured: true, templateId: "tmpl-1" });
  assert.equal((await request(app, "POST", "/v1/wechat/subscriptions/subscribe", { code: "a" }, "")).status, 401);
  assert.equal((await request(app, "POST", "/v1/wechat/subscriptions/subscribe", { code: "a" })).body.data.credits, 1);
  assert.equal((await request(app, "POST", "/v1/wechat/subscriptions/subscribe", { code: "a" })).body.data.credits, 2);
  assert.equal((await request(app, "POST", "/v1/wechat/subscriptions/status", { code: "a" })).body.data.credits, 2);
  assert.equal((await request(app, "POST", "/v1/wechat/subscriptions/unsubscribe", { code: "a" })).body.data.credits, 0);
  assert.equal((await request(app, "POST", "/v1/wechat/subscriptions/status", { code: "bad" })).status, 400);
  assert.equal((await request(app, "POST", "/v1/wechat/subscriptions/status", {})).status, 400);
  assert.equal((await request(app, "GET", "/v1/wechat/subscriptions/status")).status, 405);
  assert.equal((await request(app, "POST", "/v1/vehicles")).status, 405);
});

test("subscription endpoints report when WeChat is not configured", async () => {
  const app = createApp(new FixtureRepository(), undefined, "t");
  assert.deepEqual((await request(app, "GET", "/v1/wechat/config")).body.data, { configured: false, templateId: null });
  assert.equal((await request(app, "POST", "/v1/wechat/subscriptions/subscribe", { code: "a" })).status, 503);
  assert.equal(createWechatNotifier({}), null);
});

test("software update messages spend one credit and are sent once per target version", async () => {
  const { notifier, calls } = fakeWechat();
  await notifier.subscribe("a");
  await notifier.subscribe("a");
  assert.equal(await notifier.notifySoftwareUpdate({ ...updateVehicle, updateStatus: "no_update" }), 0);
  assert.equal(await notifier.notifySoftwareUpdate(updateVehicle), 1);
  assert.equal(await notifier.notifySoftwareUpdate(updateVehicle), 0);
  const sent = calls.filter((call) => call.url.includes("/message/subscribe/send"));
  assert.equal(sent.length, 1);
  assert.equal(sent[0].body.touser, "openid-a");
  assert.equal(sent[0].body.page, "pages/software-update/index");
  assert.equal(sent[0].body.data.character_string2.value, "2026.26.1");
  assert.equal(Array.from(sent[0].body.data.thing1.value).length, 20);
  assert.equal((await notifier.status("a")).credits, 1);
  assert.equal(await notifier.notifySoftwareUpdate({ ...updateVehicle, availableSoftwareVersion: "2026.32.1" }), 1);
  assert.equal((await notifier.status("a")).credits, 0);
  assert.equal(await notifier.notifySoftwareUpdate({ ...updateVehicle, availableSoftwareVersion: "2026.38.1" }), 0);
  assert.equal(calls.filter((call) => call.url.includes("stable_token")).length, 1);
});

test("revoked grants are cleared and failed sends can retry later", async () => {
  const { notifier, calls } = fakeWechat();
  await notifier.subscribe("a");
  calls.failNext = 43101;
  assert.equal(await notifier.notifySoftwareUpdate(updateVehicle), 0);
  assert.equal((await notifier.status("a")).credits, 0);

  await notifier.subscribe("b");
  calls.failNext = 45009;
  assert.equal(await notifier.notifySoftwareUpdate(updateVehicle), 0);
  assert.equal((await notifier.status("b")).credits, 1);
  assert.equal(await notifier.notifySoftwareUpdate(updateVehicle), 1);
});

test("watcher stays idle without notifier or MQTT monitor", () => {
  const stop = startSoftwareUpdateWatcher({ repository: new FixtureRepository(), softwareUpdates: null, notifier: null });
  assert.equal(typeof stop, "function");
  stop();
});
