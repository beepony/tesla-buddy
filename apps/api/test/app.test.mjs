import assert from "node:assert/strict";
import test from "node:test";
import { createApp } from "../src/app.mjs";
import { FixtureRepository } from "../src/fixture-repository.mjs";

async function request(path, { apiToken, authorization } = {}) {
  let status;
  let payload;
  const response = {
    writeHead(code) { status = code; },
    end(body) { payload = JSON.parse(body); }
  };
  await createApp(new FixtureRepository(), () => new Date("2026-07-26T00:00:00Z"), apiToken)(
    { method: "GET", url: path, headers: { host: "localhost", authorization } }, response
  );
  return { status, body: payload };
}

test("returns the demo vehicle overview", async () => {
  const { status, body } = await request("/v1/vehicles/demo-model-y/overview");
  assert.equal(status, 200);
  assert.equal(body.data.batteryLevelPercent, 68);
});

test("requires a vehicle id for reports", async () => {
  const { status, body } = await request("/v1/reports/summary");
  assert.equal(status, 400);
  assert.equal(body.error, "vehicle_id_required");
});

test("protects vehicle data when an API token is configured", async () => {
  const unauthorized = await request("/v1/vehicles", { apiToken: "test-token" });
  assert.equal(unauthorized.status, 401);

  const authorized = await request("/v1/vehicles", {
    apiToken: "test-token",
    authorization: "Bearer test-token"
  });
  assert.equal(authorized.status, 200);
});
