// A missing/endless process is not proof the car is still charging: TeslaMate
// may have been shut down. Freshness is tied to the car sample, not the API call.
export function chargingStatus(row, now = new Date()) {
  if (!row) return null;
  const updatedAt = row.sample_date ?? row.end_date ?? row.start_date;
  const freshUntil = new Date(new Date(updatedAt).getTime() + 120_000);
  const ended = row.end_date != null;
  const stale = !ended && freshUntil <= now;
  const num = (v) => v == null ? null : Number(v);
  const power = num(row.charger_power);
  return {
    sessionId: String(row.id), vehicleId: String(row.car_id),
    startedAt: row.start_date, endedAt: row.end_date,
    updatedAt, freshUntil,
    state: ended ? "ended" : stale ? "stale" : power == null ? "unknown" : power > 0 ? "charging" : "paused",
    batteryPercent: num(row.battery_level ?? row.end_battery_level),
    powerKw: power, addedEnergyKwh: num(row.sample_energy ?? row.charge_energy_added),
    // Target SOC is not stored in this TeslaMate schema. Never assume 80/100%.
    targetPercent: null
  };
}
