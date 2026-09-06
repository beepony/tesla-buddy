import assert from "node:assert/strict";
import test from "node:test";
import { createApp } from "../src/app.mjs";
import { FixtureRepository } from "../src/fixture-repository.mjs";

async function request(path, { apiToken, authorization, softwareUpdates } = {}) {
  let status;
  let payload;
  const response = {
    writeHead(code) { status = code; },
    end(body) { payload = JSON.parse(body); }
  };
  await createApp(new FixtureRepository(), () => new Date("2026-07-26T00:00:00Z"), apiToken, softwareUpdates)(
    { method: "GET", url: path, headers: { host: "localhost", authorization } }, response
  );
  return { status, body: payload };
}

test("returns the demo vehicle overview", async () => {
  const { status, body } = await request("/v1/vehicles/demo-model-y/overview");
  assert.equal(status, 200);
  assert.equal(body.data.batteryLevelPercent, 68);
});

test("vehicle list and overview expose updates without bypassing authentication or missing vehicles", async () => {
  const softwareUpdates = {
    overview(vehicle) {
      return { ...vehicle, updateStatus: "available", availableSoftwareVersion: "2026.26.1" };
    }
  };
  const options = { apiToken: "secret", authorization: "Bearer secret", softwareUpdates };
  const overview = await request("/v1/vehicles/demo-model-y/overview", options);
  const vehicles = await request("/v1/vehicles", options);
  assert.equal(overview.body.data.updateStatus, "available");
  assert.equal(overview.body.data.availableSoftwareVersion, "2026.26.1");
  assert.deepEqual(vehicles.body.data[0], overview.body.data);
  assert.equal((await request("/v1/vehicles/missing/overview", options)).status, 404);
  assert.equal((await request("/v1/vehicles/demo-model-y/overview", { ...options, authorization: undefined })).status, 401);
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

test("returns parking sessions derived from drives", async () => {
  const { status, body } = await request("/v1/vehicles/demo-model-y/parking-sessions");
  assert.equal(status, 200);
  assert.equal(body.data[0].isActive, true);
  assert.equal(body.data[0].locationKey, "address:demo-office");
});

test("charging status is authenticated and no session is represented as null", async () => {
  assert.equal((await request("/v1/vehicles/demo-model-y/charging-status", { apiToken: "test-token" })).status, 401);
  const result = await request("/v1/vehicles/demo-model-y/charging-status", { apiToken: "test-token", authorization: "Bearer test-token" });
  assert.equal(result.status, 200);
  assert.equal(result.body.data, null);
});
