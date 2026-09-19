import pg from "pg";
import { chargingStatus } from "./charging-status.mjs";

const { Pool } = pg;

// TeslaMate stores its UTC timestamps in PostgreSQL `timestamp without time zone`
// columns. PostgreSQL's default Node parser treats those values as local time,
// which shifts every snapshot by the Mac's UTC offset. Interpret them explicitly
// as UTC before returning ISO 8601 to iOS.
pg.types.setTypeParser(1114, (value) => new Date(`${value}Z`));

const number = (value) => value === null || value === undefined ? null : Number(value);
const shortLocationName = (value, fallback) => value?.split(",")[0]?.trim() || fallback;
const modelName = (row) => {
  const model = row.model ? `Model ${row.model}` : null;
  return [model, row.marketing_name].filter(Boolean).join(" · ") || null;
};

function vehicle(row) {
  return {
    id: String(row.id),
    displayName: row.display_name ?? row.marketing_name ?? row.model ?? "Tesla",
    modelName: modelName(row),
    state: row.state ?? "unknown",
    batteryLevelPercent: row.battery_level === null ? null : Number(row.battery_level),
    estimatedRangeKm: number(row.estimated_range_km),
    estimatedMaxRangeKm: number(row.estimated_max_range_km),
    estimatedBatteryCapacityKwh: number(row.estimated_battery_capacity_kwh),
    tirePressureFrontLeftBar: number(row.tire_pressure_fl),
    tirePressureFrontRightBar: number(row.tire_pressure_fr),
    tirePressureRearLeftBar: number(row.tire_pressure_rl),
    tirePressureRearRightBar: number(row.tire_pressure_rr),
    tirePressureUpdatedAt: row.tire_pressure_updated_at,
    odometerKm: number(row.odometer_km),
    softwareVersion: row.software_version,
    updateStatus: row.update_status,
    lastUpdatedAt: row.last_updated_at,
    location: row.latitude === null ? null : { latitude: number(row.latitude), longitude: number(row.longitude), precision: "exact" }
  };
}

export class PostgresRepository {
  constructor(databaseUrl, vehicleModelName = null) {
    this.pool = new Pool({ connectionString: databaseUrl, max: 4, application_name: "tesla-companion" });
    this.vehicleModelName = vehicleModelName;
  }

  async listVehicles() {
    const { rows } = await this.pool.query(`
      SELECT c.id, c.name AS display_name, c.marketing_name, c.model,
             p.battery_level, p.est_battery_range_km AS estimated_range_km,
             CASE WHEN p.usable_battery_level > 0 THEN p.est_battery_range_km / p.usable_battery_level * 100 END AS estimated_max_range_km,
             tire.tpms_pressure_fl AS tire_pressure_fl,
             tire.tpms_pressure_fr AS tire_pressure_fr,
             tire.tpms_pressure_rl AS tire_pressure_rl,
             tire.tpms_pressure_rr AS tire_pressure_rr,
             tire.date AS tire_pressure_updated_at,
             p.odometer AS odometer_km, p.date AS last_updated_at, p.latitude, p.longitude,
             s.state, u.version AS software_version,
             CASE WHEN u.version IS NULL THEN 'unavailable' ELSE 'unknown' END AS update_status,
             capacity.estimated_battery_capacity_kwh
      FROM cars c
      LEFT JOIN LATERAL (SELECT * FROM positions WHERE car_id = c.id ORDER BY date DESC LIMIT 1) p ON true
      LEFT JOIN LATERAL (SELECT state FROM states WHERE car_id = c.id ORDER BY start_date DESC LIMIT 1) s ON true
      LEFT JOIN LATERAL (SELECT version FROM updates WHERE car_id = c.id ORDER BY start_date DESC LIMIT 1) u ON true
      LEFT JOIN LATERAL (
        SELECT date, tpms_pressure_fl, tpms_pressure_fr, tpms_pressure_rl, tpms_pressure_rr
        FROM positions
        WHERE car_id = c.id
          AND (tpms_pressure_fl IS NOT NULL OR tpms_pressure_fr IS NOT NULL
            OR tpms_pressure_rl IS NOT NULL OR tpms_pressure_rr IS NOT NULL)
        ORDER BY date DESC LIMIT 1
      ) tire ON true
      LEFT JOIN LATERAL (
        SELECT charge_energy_added / NULLIF(end_battery_level - start_battery_level, 0) * 100 AS estimated_battery_capacity_kwh
        FROM charging_processes
        WHERE car_id = c.id AND charge_energy_added IS NOT NULL AND end_battery_level - start_battery_level >= 10
        ORDER BY end_date DESC LIMIT 1
      ) capacity ON true
      ORDER BY c.display_priority NULLS LAST, c.id`);
    return rows.map((row) => ({
      ...vehicle(row),
      // TeslaMate reports this car as the generic `Y`; preserve the owner's
      // confirmed six-seat YL variant as a display-only override.
      modelName: this.vehicleModelName ?? modelName(row)
    }));
  }

  async getOverview(id) {
    const vehicles = await this.listVehicles();
    return vehicles.find((item) => item.id === String(id)) ?? null;
  }

  async listDrives(vehicleId, periodStart = null, periodEnd = null, driveId = null) {
    const { rows } = await this.pool.query(`
      SELECT d.id, d.car_id, d.start_date AS started_at, d.end_date AS ended_at,
             d.distance AS distance_km, d.duration_min AS duration_minutes,
             GREATEST(energy.net_energy_kwh, 0) AS energy_used_kwh,
             CASE WHEN d.distance > 0 AND energy.net_energy_kwh IS NOT NULL THEN ROUND(GREATEST(energy.net_energy_kwh, 0) * 1000 / d.distance)::int END AS average_consumption_wh_per_km,
             sp.battery_level AS start_soc_percent, ep.battery_level AS end_soc_percent,
             d.outside_temp_avg AS outside_temp_celsius,
             d.inside_temp_avg AS inside_temp_celsius,
             d.speed_max AS max_speed_kph,
             d.ascent AS ascent_meters,
             d.descent AS descent_meters,
             sp.latitude AS start_latitude, sp.longitude AS start_longitude,
             ep.latitude AS end_latitude, ep.longitude AS end_longitude,
             COALESCE(sa.display_name, sg.name, '未知起点') AS start_address,
             COALESCE(ea.display_name, eg.name, '未知终点') AS end_address
      FROM drives d
      JOIN cars c ON c.id = d.car_id
      LEFT JOIN positions sp ON sp.id = d.start_position_id
      LEFT JOIN positions ep ON ep.id = d.end_position_id
      LEFT JOIN addresses sa ON sa.id = d.start_address_id
      LEFT JOIN addresses ea ON ea.id = d.end_address_id
      LEFT JOIN geofences sg ON sg.id = d.start_geofence_id
      LEFT JOIN geofences eg ON eg.id = d.end_geofence_id
      LEFT JOIN LATERAL (
        SELECT SUM(((sample.power + sample.previous_power) / 2.0) * EXTRACT(EPOCH FROM (sample.date - sample.previous_date)) / 3600.0) AS net_energy_kwh
        FROM (
          SELECT date, power,
                 LAG(date) OVER (ORDER BY date) AS previous_date,
                 LAG(power) OVER (ORDER BY date) AS previous_power
          FROM positions WHERE drive_id = d.id
        ) sample
        WHERE sample.previous_date IS NOT NULL AND sample.date - sample.previous_date < interval '10 seconds'
      ) energy ON true
      WHERE d.car_id = $1
        AND ($2::timestamptz IS NULL OR d.start_date >= ($2::timestamptz AT TIME ZONE 'UTC'))
        AND ($3::timestamptz IS NULL OR d.start_date < ($3::timestamptz AT TIME ZONE 'UTC'))
        AND ($4::bigint IS NULL OR d.id = $4)
      ORDER BY d.start_date DESC
      LIMIT 200`, [vehicleId, periodStart, periodEnd, driveId]);
    return rows.map((row) => ({
      id: String(row.id),
      vehicleId: String(row.car_id),
      startedAt: row.started_at,
      endedAt: row.ended_at,
      distanceKm: number(row.distance_km),
      durationMinutes: number(row.duration_minutes),
      energyUsedKwh: number(row.energy_used_kwh),
      averageConsumptionWhPerKm: number(row.average_consumption_wh_per_km),
      startSocPercent: number(row.start_soc_percent),
      endSocPercent: number(row.end_soc_percent),
      outsideTempCelsius: number(row.outside_temp_celsius),
      insideTempCelsius: number(row.inside_temp_celsius),
      maxSpeedKph: number(row.max_speed_kph),
      ascentMeters: number(row.ascent_meters),
      descentMeters: number(row.descent_meters),
      startAddress: row.start_address,
      endAddress: row.end_address,
      startLocationName: shortLocationName(row.start_address, "出发地"),
      endLocationName: shortLocationName(row.end_address, "目的地"),
      startLocation: row.start_latitude === null ? null : { latitude: number(row.start_latitude), longitude: number(row.start_longitude) },
      endLocation: row.end_latitude === null ? null : { latitude: number(row.end_latitude), longitude: number(row.end_longitude) }
    }));
  }

  async getDrive(id) {
    const { rows } = await this.pool.query("SELECT car_id FROM drives WHERE id = $1", [id]);
    if (!rows[0]) return null;
    const [drive] = await this.listDrives(rows[0].car_id, null, null, id);
    if (!drive) return null;
    const route = await this.pool.query(`
      WITH ordered_route AS (
        SELECT latitude, longitude, date,
               ROW_NUMBER() OVER (ORDER BY date) AS point_number,
               COUNT(*) OVER () AS point_count
        FROM positions
        WHERE drive_id = $1 AND latitude IS NOT NULL AND longitude IS NOT NULL
      )
      SELECT latitude, longitude
      FROM ordered_route
      WHERE point_number = 1
         OR point_number = point_count
         OR MOD(point_number - 1, GREATEST(CEIL(point_count / 800.0)::bigint, 1)) = 0
      ORDER BY date`, [id]);
    return {
      ...drive,
      route: route.rows.map((position) => ({
        latitude: number(position.latitude),
        longitude: number(position.longitude)
      }))
    };
  }

  async listParkingSessions(vehicleId) {
    const { rows } = await this.pool.query(`
      WITH ordered_drives AS (
        SELECT d.*,
               LEAD(d.start_date) OVER (PARTITION BY d.car_id ORDER BY d.start_date) AS next_drive_started_at
        FROM drives d
        WHERE d.car_id = $1
      )
      SELECT d.id, d.car_id, d.end_date AS started_at,
             d.next_drive_started_at AS ended_at,
             d.end_address_id, d.end_geofence_id,
             COALESCE(a.display_name, g.name, '未知停车地点') AS location_name,
             p.latitude, p.longitude
      FROM ordered_drives d
      LEFT JOIN addresses a ON a.id = d.end_address_id
      LEFT JOIN geofences g ON g.id = d.end_geofence_id
      LEFT JOIN positions p ON p.id = d.end_position_id
      WHERE d.end_date IS NOT NULL
      ORDER BY d.end_date DESC
      LIMIT 200`, [vehicleId]);

    return rows.map((row) => {
      const startedAt = new Date(row.started_at);
      const endedAt = row.ended_at === null ? null : new Date(row.ended_at);
      const durationMinutes = Math.max(0, ((endedAt ?? new Date()) - startedAt) / 60_000);
      const locationKey = row.end_address_id !== null
        ? `address:${row.end_address_id}`
        : row.end_geofence_id !== null
          ? `geofence:${row.end_geofence_id}`
          : `drive:${row.id}`;
      return {
        id: String(row.id),
        vehicleId: String(row.car_id),
        startedAt,
        endedAt,
        durationMinutes,
        isActive: endedAt === null,
        locationKey,
        locationName: shortLocationName(row.location_name, "停车地点"),
        location: row.latitude === null ? null : {
          latitude: number(row.latitude),
          longitude: number(row.longitude)
        }
      };
    });
  }

  async getChargingStatus(vehicleId) {
    const { rows } = await this.pool.query(`
      SELECT cp.id, cp.car_id, cp.start_date, cp.end_date,
             cp.end_battery_level, cp.charge_energy_added,
             ch.date AS sample_date, ch.battery_level, ch.charger_power,
             ch.charge_energy_added AS sample_energy
      FROM charging_processes cp
      LEFT JOIN LATERAL (
        SELECT date, battery_level, charger_power, charge_energy_added
        FROM charges WHERE charging_process_id = cp.id ORDER BY date DESC, id DESC LIMIT 1
      ) ch ON true
      WHERE cp.car_id = $1 ORDER BY cp.start_date DESC, cp.id DESC LIMIT 1`, [vehicleId]);
    return chargingStatus(rows[0]);
  }

  async listCharges(vehicleId) {
    const { rows } = await this.pool.query(`
      SELECT cp.id, cp.car_id, cp.start_date AS started_at, cp.end_date AS ended_at,
             cp.charge_energy_added AS added_energy_kwh, cp.charge_energy_used AS consumed_energy_kwh, cp.start_battery_level AS start_soc_percent,
             cp.end_battery_level AS end_soc_percent, cp.cost, cp.duration_min,
             COALESCE(a.display_name, g.name, '未知充电地点') AS location_name,
             p.latitude AS latitude, p.longitude AS longitude,
             power.max_power_kw,
             CASE WHEN EXISTS (SELECT 1 FROM charges ch WHERE ch.charging_process_id = cp.id AND ch.fast_charger_present) THEN 'dc' ELSE 'ac' END AS charging_type
      FROM charging_processes cp
      LEFT JOIN addresses a ON a.id = cp.address_id
      LEFT JOIN geofences g ON g.id = cp.geofence_id
      LEFT JOIN positions p ON p.id = cp.position_id
      LEFT JOIN LATERAL (SELECT MAX(charger_power) AS max_power_kw FROM charges WHERE charging_process_id = cp.id) power ON true
      WHERE cp.car_id = $1 AND cp.end_date IS NOT NULL
      ORDER BY cp.start_date DESC
      LIMIT 200`, [vehicleId]);
    return rows.map((row) => ({
      id: String(row.id), vehicleId: String(row.car_id), startedAt: row.started_at, endedAt: row.ended_at,
      addedEnergyKwh: number(row.added_energy_kwh), startSocPercent: number(row.start_soc_percent), endSocPercent: number(row.end_soc_percent),
      chargingType: row.charging_type, locationName: shortLocationName(row.location_name, "充电地点"), durationMinutes: number(row.duration_min),
      maxChargingPowerKw: number(row.max_power_kw), location: row.latitude === null ? null : { latitude: number(row.latitude), longitude: number(row.longitude) },
      consumedEnergyKwh: number(row.consumed_energy_kwh),
      chargingEfficiencyPercent: row.consumed_energy_kwh === null || number(row.consumed_energy_kwh) === 0 ? null : number(row.added_energy_kwh) / number(row.consumed_energy_kwh) * 100,
      cost: row.cost === null ? null : { amount: number(row.cost), currency: "CNY", source: "teslamate" }
    }));
  }

  async getReport(vehicleId, periodStart = null, periodEnd = null) {
    const [driveResult, chargeResult, drives, overview] = await Promise.all([
      this.pool.query("SELECT COALESCE(SUM(distance), 0) AS distance_km, COALESCE(SUM(duration_min), 0) AS driving_minutes, MIN(start_date) AS period_start, MAX(end_date) AS period_end FROM drives WHERE car_id = $1 AND ($2::timestamptz IS NULL OR start_date >= ($2::timestamptz AT TIME ZONE 'UTC')) AND ($3::timestamptz IS NULL OR start_date < ($3::timestamptz AT TIME ZONE 'UTC'))", [vehicleId, periodStart, periodEnd]),
      this.pool.query("SELECT COALESCE(SUM(charge_energy_added), 0) AS charged_energy_kwh, SUM(cost) AS charging_cost FROM charging_processes WHERE car_id = $1 AND ($2::timestamptz IS NULL OR start_date >= ($2::timestamptz AT TIME ZONE 'UTC')) AND ($3::timestamptz IS NULL OR start_date < ($3::timestamptz AT TIME ZONE 'UTC'))", [vehicleId, periodStart, periodEnd]),
      this.listDrives(vehicleId, periodStart, periodEnd),
      this.getOverview(vehicleId)
    ]);
    const distanceKm = number(driveResult.rows[0].distance_km) ?? 0;
    const chargedEnergyKwh = number(chargeResult.rows[0].charged_energy_kwh) ?? 0;
    const chargingCost = number(chargeResult.rows[0].charging_cost);
    const recentDrives = drives;
    const energyUsedKwh = recentDrives.reduce((sum, drive) => sum + (drive.energyUsedKwh ?? 0), 0);
    const drivesWithEnergy = recentDrives.filter((drive) => drive.energyUsedKwh !== null);
    const drivesWithTemperature = recentDrives.filter((drive) => drive.outsideTempCelsius !== null);
    const averageOutsideTempCelsius = drivesWithTemperature.length === 0 ? null : drivesWithTemperature.reduce((sum, drive) => sum + drive.outsideTempCelsius, 0) / drivesWithTemperature.length;
    return {
      period: { start: driveResult.rows[0].period_start, end: driveResult.rows[0].period_end },
      metrics: {
        distanceKm,
        drivingMinutes: number(driveResult.rows[0].driving_minutes) ?? 0,
        chargedEnergyKwh,
        chargingCost: chargingCost === null ? null : { amount: chargingCost, currency: "CNY" },
        costPer100Km: chargingCost === null || distanceKm === 0 ? null : chargingCost / distanceKm * 100,
        tripCount: recentDrives.length,
        energyUsedKwh: drivesWithEnergy.length === 0 ? null : energyUsedKwh,
        averageConsumptionWhPerKm: drivesWithEnergy.length === 0 || distanceKm === 0 ? null : Math.round(energyUsedKwh * 1000 / distanceKm),
        averageOutsideTempCelsius,
        estimatedBatteryCapacityKwh: overview?.estimatedBatteryCapacityKwh ?? null,
        estimatedMaxRangeKm: overview?.estimatedMaxRangeKm ?? null
      },
      recentRoutes: recentDrives.slice(0, 5).map((drive) => ({ startName: drive.startLocationName, endName: drive.endLocationName, distanceKm: drive.distanceKm })),
      insight: "基于最近 30 天 TeslaMate 数据计算。"
    };
  }
}
