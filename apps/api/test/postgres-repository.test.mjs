import assert from "node:assert/strict";
import test from "node:test";
import { PostgresRepository } from "../src/postgres-repository.mjs";

test("vehicle overview maps all four TeslaMate TPMS readings", async () => {
  const repository = Object.create(PostgresRepository.prototype);
  repository.vehicleModelName = null;
  repository.pool = {
    async query(sql) {
      assert.match(sql, /tire\.tpms_pressure_fl/);
      assert.match(sql, /tire\.tpms_pressure_fr/);
      assert.match(sql, /tire\.tpms_pressure_rl/);
      assert.match(sql, /tire\.tpms_pressure_rr/);
      return {
        rows: [{
          id: 1,
          display_name: "Model Y",
          marketing_name: "Long Range",
          model: "Y",
          state: "online",
          battery_level: 68,
          estimated_range_km: 286,
          estimated_max_range_km: 420,
          estimated_battery_capacity_kwh: 78.4,
          tire_pressure_fl: "2.8",
          tire_pressure_fr: "2.9",
          tire_pressure_rl: "2.7",
          tire_pressure_rr: "2.8",
          tire_pressure_updated_at: new Date("2026-09-10T10:09:08.855Z"),
          odometer_km: 28_416.7,
          software_version: "2026.8.3.6",
          update_status: "unknown",
          last_updated_at: new Date("2026-09-10T10:09:08.855Z"),
          latitude: null,
          longitude: null
        }]
      };
    }
  };

  const [vehicle] = await repository.listVehicles();

  assert.deepEqual(
    {
      frontLeft: vehicle.tirePressureFrontLeftBar,
      frontRight: vehicle.tirePressureFrontRightBar,
      rearLeft: vehicle.tirePressureRearLeftBar,
      rearRight: vehicle.tirePressureRearRightBar
    },
    { frontLeft: 2.8, frontRight: 2.9, rearLeft: 2.7, rearRight: 2.8 }
  );
});
