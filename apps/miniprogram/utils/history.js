// Shared drive/charge caches so day and detail pages reuse the list the tab
// already loaded instead of fetching it again.
const api = require("./api.js");
const format = require("./format.js");

const cache = { drives: null, charges: null };

async function load(kind, force = false) {
  if (!force && cache[kind]) return cache[kind];
  const vehicle = await api.firstVehicle(force);
  if (!vehicle) throw new Error("尚未发现车辆");
  cache[kind] = await api.request(`/v1/vehicles/${encodeURIComponent(vehicle.id)}/${kind}`);
  return cache[kind];
}

function inMonth(items, month) {
  return items.filter((item) => format.isSameMonth(item.startedAt, month));
}

function onDay(items, key) {
  return items.filter((item) => format.dateKey(item.startedAt) === key);
}

function countByDay(items) {
  const counts = {};
  for (const item of items) {
    const key = format.dateKey(item.startedAt);
    counts[key] = (counts[key] || 0) + 1;
  }
  return counts;
}

function driveSummary(drives, title) {
  const distance = drives.reduce((sum, drive) => sum + drive.distanceKm, 0);
  const minutes = drives.reduce((sum, drive) => sum + drive.durationMinutes, 0);
  const energy = drives.reduce((sum, drive) => sum + (drive.energyUsedKwh || 0), 0);
  return {
    title,
    count: `${drives.length} 次行程`,
    metrics: [
      { value: `${format.fixed(distance, 1)} km`, label: "行驶距离" },
      { value: format.duration(minutes), label: "驾驶时间" },
      { value: `${format.fixed(energy, 2)} kWh`, label: "累计耗电" }
    ]
  };
}

function chargeSummary(charges, title) {
  const energy = charges.reduce((sum, charge) => sum + charge.addedEnergyKwh, 0);
  const hasDuration = charges.some((charge) => charge.durationMinutes != null);
  const minutes = charges.reduce((sum, charge) => sum + (charge.durationMinutes || 0), 0);
  const cost = format.sumCost(charges);
  return {
    title,
    count: `${charges.length} 次充电`,
    metrics: [
      { value: `${format.fixed(energy, 2)} kWh`, label: "充入电量" },
      { value: hasDuration ? format.duration(minutes) : "—", label: "充电时长" },
      { value: cost ? format.currency(cost) : "—", label: "充电费用" }
    ]
  };
}

function findDrive(id) {
  return (cache.drives || []).find((drive) => drive.id === id) || null;
}

function findCharge(id) {
  return (cache.charges || []).find((charge) => charge.id === id) || null;
}

module.exports = { load, inMonth, onDay, countByDay, driveSummary, chargeSummary, findDrive, findCharge, cache };
