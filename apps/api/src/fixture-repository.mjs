const now = new Date();
const isoMinutesAgo = (minutes) => new Date(now.getTime() - minutes * 60_000).toISOString();

const vehicle = {
  id: "demo-model-y",
  displayName: "Model Y",
  modelName: "Model Y · 长续航全轮驱动",
  state: "parked",
  batteryLevelPercent: 68,
  estimatedRangeKm: 286,
  estimatedMaxRangeKm: 420,
  estimatedBatteryCapacityKwh: 78.4,
  odometerKm: 28_416.7,
  softwareVersion: "2026.8.3.6",
  updateStatus: "unknown",
  lastUpdatedAt: isoMinutesAgo(4),
  location: { latitude: 31.2304, longitude: 121.4737, precision: "city" }
};

const drives = [
  {
    id: "drive-20260725-01", vehicleId: vehicle.id, startedAt: "2026-07-25T09:10:00Z",
    endedAt: "2026-07-25T09:52:00Z", distanceKm: 31.8, durationMinutes: 42,
    energyUsedKwh: 4.92, averageConsumptionWhPerKm: 155, startSocPercent: 72,
    endSocPercent: 65, startAddress: "静安区", endAddress: "浦东新区"
  },
  {
    id: "drive-20260724-01", vehicleId: vehicle.id, startedAt: "2026-07-24T10:30:00Z",
    endedAt: "2026-07-24T11:08:00Z", distanceKm: 24.3, durationMinutes: 38,
    energyUsedKwh: 3.94, averageConsumptionWhPerKm: 162, startSocPercent: 80,
    endSocPercent: 74, startAddress: "浦东新区", endAddress: "徐汇区"
  }
];

const charges = [
  {
    id: "charge-20260723-01", vehicleId: vehicle.id, startedAt: "2026-07-23T14:20:00Z",
    endedAt: "2026-07-23T15:04:00Z", addedEnergyKwh: 28.4, startSocPercent: 24,
    endSocPercent: 71, chargingType: "dc", locationName: "Tesla 超级充电站（上海）",
    durationMinutes: 44, maxChargingPowerKw: 120, location: { latitude: 31.2304, longitude: 121.4737 },
    consumedEnergyKwh: 29.8, chargingEfficiencyPercent: 95.3,
    cost: { amount: 38.06, currency: "CNY", source: "user" }
  }
];

const parkingSessions = [
  {
    id: "parking-current", vehicleId: vehicle.id, startedAt: isoMinutesAgo(135), endedAt: null,
    durationMinutes: 135, isActive: true, locationKey: "address:demo-office",
    locationName: "静安区", location: { latitude: 31.2304, longitude: 121.4737 }
  },
  {
    id: "parking-previous", vehicleId: vehicle.id, startedAt: "2026-07-24T11:08:00Z",
    endedAt: "2026-07-25T09:10:00Z", durationMinutes: 1322, isActive: false,
    locationKey: "address:demo-home", locationName: "浦东新区",
    location: { latitude: 31.221, longitude: 121.544 }
  }
];

export class FixtureRepository {
  async listVehicles() { return [vehicle]; }
  async getOverview(id) { return id === vehicle.id ? vehicle : null; }
  async listDrives(id) { return id === vehicle.id ? drives : []; }
  async getDrive(id) { return drives.find((drive) => drive.id === id) ?? null; }
  async listParkingSessions(id) { return id === vehicle.id ? parkingSessions : []; }
  async getChargingStatus() { return null; }
  async listCharges(id) { return id === vehicle.id ? charges : []; }
  async getReport(vehicleId) {
    if (vehicleId !== vehicle.id) return null;
    return {
      period: { start: "2026-07-01T00:00:00Z", end: "2026-08-01T00:00:00Z" },
      metrics: { distanceKm: 482.6, drivingMinutes: 781, energyUsedKwh: 78.1, averageConsumptionWhPerKm: 162, chargedEnergyKwh: 122.8, chargingCost: { amount: 165.42, currency: "CNY" }, costPer100Km: 34.27, estimatedBatteryCapacityKwh: 78.4, estimatedMaxRangeKm: 420 },
      insight: "演示数据：本月平均能耗为 162 Wh/km。接入真实数据后会生成个人化洞察。"
    };
  }
}
