import assert from "node:assert/strict";
import test from "node:test";
import { createApp } from "../src/app.mjs";
import { FixtureRepository } from "../src/fixture-repository.mjs";
import { PostgresRepository } from "../src/postgres-repository.mjs";

async function request(path) {
  let status;
  let payload;
  const response = {
    writeHead(code) { status = code; },
    end(body) { payload = JSON.parse(body); }
  };
  await createApp(new FixtureRepository())(
    { method: "GET", url: path, headers: { host: "localhost" } },
    response
  );
  return { status, body: payload };
}

test("drive detail returns an ordered route with matching endpoints", async () => {
  const { status, body } = await request("/v1/drives/drive-20260725-01");

  assert.equal(status, 200);
  assert.ok(body.data.route.length >= 2);
  assert.deepEqual(body.data.route[0], body.data.startLocation);
  assert.deepEqual(body.data.route.at(-1), body.data.endLocation);
});

test("Postgres drive detail loads route positions in timestamp order", async () => {
  const repository = Object.create(PostgresRepository.prototype);
  const queries = [];
  repository.pool = {
    async query(sql, values) {
      queries.push({ sql, values });
      if (sql.startsWith("SELECT car_id")) return { rows: [{ car_id: 1 }] };
      if (sql.includes("WHERE drive_id = $1 AND latitude IS NOT NULL")) {
        assert.match(sql, /ROW_NUMBER\(\) OVER \(ORDER BY date\)/);
        assert.match(sql, /point_count \/ 800\.0/);
        return {
          rows: [
            { latitude: "31.2304", longitude: "121.4737" },
            { latitude: "31.221", longitude: "121.544" }
          ]
        };
      }
      if (sql.includes("FROM drives d")) {
        assert.deepEqual(values, [1, null, null, "42"]);
        return {
          rows: [{
            id: 42,
            car_id: 1,
            started_at: new Date("2026-09-19T01:00:00Z"),
            ended_at: new Date("2026-09-19T01:30:00Z"),
            distance_km: "20.5",
            duration_minutes: 30,
            energy_used_kwh: "3.2",
            average_consumption_wh_per_km: 156,
            start_latitude: "31.2304",
            start_longitude: "121.4737",
            end_latitude: "31.221",
            end_longitude: "121.544",
            start_address: "静安区",
            end_address: "浦东新区"
          }]
        };
      }
      throw new Error(`Unexpected query: ${sql}`);
    }
  };

  const drive = await repository.getDrive("42");

  assert.deepEqual(drive.route, [
    { latitude: 31.2304, longitude: 121.4737 },
    { latitude: 31.221, longitude: 121.544 }
  ]);
  assert.match(queries.at(-1).sql, /ORDER BY date/);
});
