import assert from "node:assert/strict";
import test from "node:test";
import { chargingStatus } from "../src/charging-status.mjs";
const now = new Date("2026-09-05T02:00:00Z");
const row = { id: 1, car_id: 1, start_date: "2026-09-05T01:00:00Z", end_date: null,
  sample_date: "2026-09-05T01:59:30Z", battery_level: 64, charger_power: 11, sample_energy: "12.4" };
test("fresh sample reports actual battery and power without inventing a target", () => {
  const s = chargingStatus(row, now);
  assert.equal(s.state, "charging"); assert.equal(s.batteryPercent, 64);
  assert.equal(s.addedEnergyKwh, 12.4); assert.equal(s.targetPercent, null);
});
test("stopped logger cannot leave a session falsely live", () => {
  assert.equal(chargingStatus({ ...row, sample_date: "2026-09-04T01:00:00Z" }, now).state, "stale");
});
test("zero power, missing sample and completed sessions have distinct states", () => {
  assert.equal(chargingStatus({ ...row, charger_power: 0 }, now).state, "paused");
  assert.equal(chargingStatus({ ...row, charger_power: null }, now).state, "unknown");
  assert.equal(chargingStatus({ ...row, end_date: now }, now).state, "ended");
  assert.equal(chargingStatus(null, now), null);
});
