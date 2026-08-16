import assert from "node:assert/strict";
import test from "node:test";
import { createApp } from "../src/app.mjs";
import { FixtureRepository } from "../src/fixture-repository.mjs";

async function request(path) {
  let status;
  let payload;
  const response = {
    writeHead(code) { status = code; },
    end(body) { payload = JSON.parse(body); }
  };
  await createApp(new FixtureRepository(), () => new Date("2026-07-26T00:00:00Z"))(
    { method: "GET", url: path, headers: { host: "localhost" } }, response
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
