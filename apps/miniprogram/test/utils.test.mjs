import assert from "node:assert/strict";
import { createRequire } from "node:module";
import test from "node:test";

const require = createRequire(import.meta.url);
const format = require("../utils/format.js");
const geo = require("../utils/geo.js");
const report = require("../utils/report.js");
const charging = require("../utils/charging.js");
const history = require("../utils/history.js");

test("formats durations and parking time like the iOS app", () => {
  assert.equal(format.duration(42), "42分钟");
  assert.equal(format.duration(60), "1小时");
  assert.equal(format.duration(135), "2小时15分");
  assert.equal(format.duration(null), "—");
  assert.equal(format.parkingDuration(1322), "22小时 2分钟");
  assert.equal(format.parkingDuration(3000), "2天 2小时");
  assert.equal(format.parkingDuration(5.9), "5分钟");
});

test("sums costs only when the currency matches", () => {
  assert.deepEqual(format.sumCost([{ cost: { amount: 1.5, currency: "CNY" } }, { cost: null }, { cost: { amount: 2, currency: "CNY" } }]), { amount: 3.5, currency: "CNY" });
  assert.equal(format.sumCost([{ cost: { amount: 1, currency: "CNY" } }, { cost: { amount: 1, currency: "USD" } }]), null);
  assert.equal(format.currency({ amount: 38.06, currency: "CNY" }), "¥38.06");
});

test("converts mainland WGS-84 coordinates to GCJ-02 and leaves others untouched", () => {
  const shanghai = geo.toGcj02({ latitude: 31.2304, longitude: 121.4737 });
  assert.ok(Math.abs(shanghai.latitude - 31.2304) > 0.001 && Math.abs(shanghai.latitude - 31.2304) < 0.01);
  assert.ok(Math.abs(shanghai.longitude - 121.4737) > 0.001 && Math.abs(shanghai.longitude - 121.4737) < 0.01);
  assert.deepEqual(geo.toGcj02({ latitude: 37.39, longitude: -122.08 }), { latitude: 37.39, longitude: -122.08 });
  assert.equal(geo.toGcj02(null), null);
});

test("report periods start on local day, Monday and month boundaries", () => {
  const anchor = new Date(2026, 9, 21, 15, 30); // Wednesday
  assert.deepEqual(report.interval("day", anchor), { start: new Date(2026, 9, 21), end: new Date(2026, 9, 22) });
  assert.deepEqual(report.interval("week", anchor), { start: new Date(2026, 9, 19), end: new Date(2026, 9, 26) });
  assert.deepEqual(report.interval("month", anchor), { start: new Date(2026, 9, 1), end: new Date(2026, 10, 1) });
  assert.equal(report.move("month", new Date(2026, 0, 31), 1).getMonth(), 1);
  assert.equal(report.detailRows("efficiency", null).rows[0].value, "暂无数据");
});

test("charging card marks stale samples instead of assuming the charge continues", () => {
  const status = {
    startedAt: "2026-10-21T08:00:00Z", updatedAt: "2026-10-21T09:00:00Z", freshUntil: "2026-10-21T09:02:00Z",
    endedAt: null, state: "charging", batteryPercent: 64, powerKw: 7.2, addedEnergyKwh: 12.34
  };
  const fresh = charging.present(status, null, false, new Date("2026-10-21T09:01:00Z"));
  assert.equal(fresh.badge, "正在充电");
  assert.equal(fresh.elapsed, "1小时1分");
  assert.equal(fresh.power, "7.2 kW");
  const stale = charging.present(status, null, false, new Date("2026-10-21T10:00:00Z"));
  assert.equal(stale.badge, "数据待刷新");
  assert.equal(stale.elapsed, "1小时0分");
  assert.equal(charging.present(null, null, false).active, false);
  assert.equal(charging.present(status, "离线", false).badge, "连接待恢复");
});

test("history summaries match the iOS month totals", () => {
  const drives = [
    { startedAt: "2026-07-25T09:10:00Z", distanceKm: 31.8, durationMinutes: 42, energyUsedKwh: 4.92 },
    { startedAt: "2026-07-24T10:30:00Z", distanceKm: 24.3, durationMinutes: 38, energyUsedKwh: null }
  ];
  const summary = history.driveSummary(drives, "2026年7月");
  assert.deepEqual(summary.metrics.map((metric) => metric.value), ["56.1 km", "1小时20分", "4.92 kWh"]);
  const charges = history.chargeSummary([{ addedEnergyKwh: 28.4, durationMinutes: null, cost: null }], "x");
  assert.deepEqual(charges.metrics.map((metric) => metric.value), ["28.40 kWh", "—", "—"]);
});
