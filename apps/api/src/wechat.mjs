import { existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";

const WECHAT_API = "https://api.weixin.qq.com";
// Keyword names follow the template chosen in the WeChat admin console; they
// can be remapped with WECHAT_UPDATE_TEMPLATE_DATA without code changes.
export const DEFAULT_TEMPLATE_DATA = {
  thing1: "{vehicle}",
  character_string2: "{target}",
  thing3: "{hint}"
};
// Subscribe message value length limits by keyword type.
const limits = { thing: 20, character_string: 32, phrase: 5, name: 10, number: 32, letter: 32, symbol: 5, time: 32, date: 32 };

export class WechatError extends Error {
  constructor(code, message, status = 502) {
    super(message);
    this.code = code;
    this.status = status;
  }
}

function truncate(key, value) {
  const limit = limits[key.replace(/\d+$/, "")] ?? 20;
  const characters = Array.from(String(value ?? "").trim() || "—");
  return characters.length <= limit ? characters.join("") : `${characters.slice(0, limit - 1).join("")}…`;
}

/** Persists subscriber credits so a restart does not lose one-time grants. */
export class JsonFileStore {
  constructor(path) { this.path = path; }
  load() {
    if (!existsSync(this.path)) return { subscribers: {} };
    try { return { subscribers: {}, ...JSON.parse(readFileSync(this.path, "utf8")) }; }
    catch { return { subscribers: {} }; }
  }
  save(state) {
    mkdirSync(dirname(this.path), { recursive: true });
    const temporary = `${this.path}.tmp`;
    writeFileSync(temporary, JSON.stringify(state, null, 2), { mode: 0o600 });
    renameSync(temporary, this.path);
  }
}

export class MemoryStore {
  constructor(state = { subscribers: {} }) { this.state = structuredClone(state); }
  load() { return structuredClone(this.state); }
  save(state) { this.state = structuredClone(state); }
}

/**
 * WeChat one-time subscribe messages replace iOS local notifications. Every
 * accepted prompt allows exactly one message, so each acceptance is stored as
 * a credit for the subscriber's openid.
 */
export class WechatNotifier {
  constructor({ appId, appSecret, templateId, templateData = DEFAULT_TEMPLATE_DATA, miniprogramState = "formal", store, fetch = globalThis.fetch, clock = () => new Date() }) {
    Object.assign(this, { appId, appSecret, templateId, templateData, miniprogramState, store, fetch, clock });
    this.token = null;
  }

  get configured() { return Boolean(this.appId && this.appSecret && this.templateId); }

  publicConfig() { return { configured: this.configured, templateId: this.configured ? this.templateId : null }; }

  async call(path, init) {
    const response = await this.fetch(`${WECHAT_API}${path}`, init);
    const body = await response.json();
    if (body.errcode) throw new WechatError(body.errcode, body.errmsg ?? "wechat_error");
    return body;
  }

  async openid(code) {
    if (!this.configured) throw new WechatError("wechat_not_configured", "WeChat subscribe messages are not configured.", 503);
    if (typeof code !== "string" || !code) throw new WechatError("code_required", "A wx.login code is required.", 400);
    const query = new URLSearchParams({ appid: this.appId, secret: this.appSecret, js_code: code, grant_type: "authorization_code" });
    try {
      return (await this.call(`/sns/jscode2session?${query}`)).openid;
    } catch (error) {
      if (error.code === 40029 || error.code === 40163) throw new WechatError("invalid_code", "The wx.login code is invalid or already used.", 400);
      throw error;
    }
  }

  update(openid, change) {
    const state = this.store.load();
    const subscriber = state.subscribers[openid] ?? { credits: 0, notified: {} };
    change(subscriber);
    subscriber.updatedAt = this.clock().toISOString();
    state.subscribers[openid] = subscriber;
    this.store.save(state);
    return { configured: true, credits: subscriber.credits };
  }

  async status(code) {
    const openid = await this.openid(code);
    return { configured: true, credits: this.store.load().subscribers[openid]?.credits ?? 0 };
  }

  async subscribe(code) {
    const openid = await this.openid(code);
    return this.update(openid, (subscriber) => { subscriber.credits = Math.min(subscriber.credits + 1, 50); });
  }

  async cancel(code) {
    const openid = await this.openid(code);
    return this.update(openid, (subscriber) => { subscriber.credits = 0; });
  }

  async accessToken() {
    if (this.token && this.token.expiresAt > this.clock().getTime()) return this.token.value;
    const body = await this.call("/cgi-bin/stable_token", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ grant_type: "client_credential", appid: this.appId, secret: this.appSecret })
    });
    this.token = { value: body.access_token, expiresAt: this.clock().getTime() + (body.expires_in - 300) * 1000 };
    return this.token.value;
  }

  messageData(vehicle) {
    const values = {
      vehicle: vehicle.displayName ?? "Tesla",
      target: vehicle.availableSoftwareVersion ?? "新版本",
      current: vehicle.softwareVersion ?? "未知",
      hint: "请在车机或特斯拉App中安装",
      time: this.clock().toISOString().slice(0, 16).replace("T", " ")
    };
    return Object.fromEntries(Object.entries(this.templateData).map(([key, template]) => [
      key,
      { value: truncate(key, String(template).replace(/\{(\w+)\}/g, (_, name) => values[name] ?? "")) }
    ]));
  }

  /** Sends at most one message per subscriber, vehicle and target version. */
  async notifySoftwareUpdate(vehicle) {
    if (!this.configured || vehicle.updateStatus !== "available") return 0;
    const target = vehicle.availableSoftwareVersion ?? "unknown";
    const state = this.store.load();
    let sent = 0;
    for (const [openid, subscriber] of Object.entries(state.subscribers)) {
      subscriber.notified ??= {};
      if (subscriber.credits <= 0 || subscriber.notified[vehicle.id] === target) continue;
      try {
        const token = await this.accessToken();
        await this.call(`/cgi-bin/message/subscribe/send?access_token=${encodeURIComponent(token)}`, {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            touser: openid,
            template_id: this.templateId,
            page: "pages/software-update/index",
            data: this.messageData(vehicle),
            miniprogram_state: this.miniprogramState,
            lang: "zh_CN"
          })
        });
        subscriber.credits -= 1;
        subscriber.notified[vehicle.id] = target;
        sent += 1;
      } catch (error) {
        // 43101: the grant was already used or revoked on the WeChat side.
        if (error.code === 43101) subscriber.credits = 0;
        if (error.code === 40001 || error.code === 42001) this.token = null;
      }
    }
    this.store.save(state);
    return sent;
  }
}

export function createWechatNotifier(environment = process.env) {
  if (!environment.WECHAT_APP_ID || !environment.WECHAT_APP_SECRET || !environment.WECHAT_UPDATE_TEMPLATE_ID) return null;
  return new WechatNotifier({
    appId: environment.WECHAT_APP_ID,
    appSecret: environment.WECHAT_APP_SECRET,
    templateId: environment.WECHAT_UPDATE_TEMPLATE_ID,
    templateData: environment.WECHAT_UPDATE_TEMPLATE_DATA ? JSON.parse(environment.WECHAT_UPDATE_TEMPLATE_DATA) : DEFAULT_TEMPLATE_DATA,
    miniprogramState: environment.WECHAT_MINIPROGRAM_STATE || "formal",
    store: new JsonFileStore(environment.WECHAT_SUBSCRIPTION_STORE || "data/wechat-subscriptions.json")
  });
}

/**
 * The server checks for updates itself, so reminders arrive even when the
 * mini program is closed (iOS needed background app refresh for this).
 */
export function startSoftwareUpdateWatcher({ repository, softwareUpdates, notifier, intervalMs = 5 * 60_000 }) {
  if (!notifier?.configured || !softwareUpdates) return () => {};
  const check = async () => {
    try {
      for (const vehicle of await repository.listVehicles()) {
        await notifier.notifySoftwareUpdate(softwareUpdates.overview(vehicle));
      }
    } catch (error) {
      console.warn(`Software update notification check failed: ${error.message}`);
    }
  };
  const timer = setInterval(check, intervalMs);
  const first = setTimeout(check, 30_000);
  timer.unref?.();
  first.unref?.();
  return () => { clearInterval(timer); clearTimeout(first); };
}
