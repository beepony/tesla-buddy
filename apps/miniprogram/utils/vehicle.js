// Presentation helpers for the vehicle overview shared by several pages.
const format = require("./format.js");

function stateTitle(state) {
  switch ((state || "").toLowerCase()) {
    case "online": case "driving": return "在线";
    case "charging": return "充电中";
    case "asleep": return "休眠";
    default: return "离线";
  }
}

function updateTitle(status) {
  if (status === "available") return "有更新";
  if (status === "no_update") return "暂无更新";
  return "更新状态未知";
}

function present(vehicle, refreshError) {
  const tire = (value) => (value == null ? "—" : format.fixed(value, 1));
  return {
    id: vehicle.id,
    name: vehicle.displayName,
    model: vehicle.modelName || "Tesla 车辆",
    state: stateTitle(vehicle.state),
    stateKey: (vehicle.state || "").toLowerCase(),
    range: vehicle.estimatedRangeKm == null ? "—" : format.fixed(vehicle.estimatedRangeKm, 0),
    battery: vehicle.batteryLevelPercent == null ? "—" : `${vehicle.batteryLevelPercent}%`,
    batteryPercent: vehicle.batteryLevelPercent || 0,
    updatedAt: format.relative(vehicle.lastUpdatedAt) || "等待首条快照",
    tireDetail: `${format.relative(vehicle.tirePressureUpdatedAt) || "车辆唤醒后更新"} · bar`,
    tires: {
      fl: tire(vehicle.tirePressureFrontLeftBar), fr: tire(vehicle.tirePressureFrontRightBar),
      rl: tire(vehicle.tirePressureRearLeftBar), rr: tire(vehicle.tirePressureRearRightBar)
    },
    capacity: format.withUnit(vehicle.estimatedBatteryCapacityKwh, 1, "kWh"),
    maxRange: format.withUnit(vehicle.estimatedMaxRangeKm, 0, "km"),
    odometer: format.withUnit(vehicle.odometerKm, 0, "km"),
    software: vehicle.softwareVersion || "暂无记录",
    updateTitle: refreshError ? "更新状态待刷新" : updateTitle(vehicle.updateStatus),
    hasUpdate: !refreshError && vehicle.updateStatus === "available"
  };
}

module.exports = { present, stateTitle, updateTitle };
