import { timingSafeEqual } from "node:crypto";

const json = (response, status, value) => {
  response.writeHead(status, { "content-type": "application/json; charset=utf-8", "cache-control": "no-store" });
  response.end(JSON.stringify(value));
};

const isAuthorized = (request, apiToken) => {
  if (!apiToken) return true;
  const actual = Buffer.from(request.headers.authorization ?? "");
  const expected = Buffer.from(`Bearer ${apiToken}`);
  return actual.length === expected.length && timingSafeEqual(actual, expected);
};

export function createApp(repository, clock = () => new Date(), apiToken = process.env.TESLA_BUDDY_API_TOKEN) {
  return async (request, response) => {
    const url = new URL(request.url, `http://${request.headers.host ?? "localhost"}`);
    if (request.method !== "GET") return json(response, 405, { error: "method_not_allowed" });
    if (url.pathname === "/health") return json(response, 200, { status: "ok", checkedAt: clock().toISOString(), dataSource: process.env.DATA_SOURCE ?? "mock" });
    if (url.pathname.startsWith("/v1/") && !isAuthorized(request, apiToken)) {
      return json(response, 401, { error: "unauthorized" });
    }
    if (url.pathname === "/v1/vehicles") return json(response, 200, { data: await repository.listVehicles() });

    const overview = url.pathname.match(/^\/v1\/vehicles\/([^/]+)\/overview$/);
    if (overview) {
      const data = await repository.getOverview(decodeURIComponent(overview[1]));
      return data ? json(response, 200, { data }) : json(response, 404, { error: "vehicle_not_found" });
    }
    const drives = url.pathname.match(/^\/v1\/vehicles\/([^/]+)\/drives$/);
    if (drives) return json(response, 200, { data: await repository.listDrives(decodeURIComponent(drives[1])) });
    const parkingSessions = url.pathname.match(/^\/v1\/vehicles\/([^/]+)\/parking-sessions$/);
    if (parkingSessions) return json(response, 200, { data: await repository.listParkingSessions(decodeURIComponent(parkingSessions[1])) });
    const drive = url.pathname.match(/^\/v1\/drives\/([^/]+)$/);
    if (drive) {
      const data = await repository.getDrive(decodeURIComponent(drive[1]));
      return data ? json(response, 200, { data }) : json(response, 404, { error: "drive_not_found" });
    }
    const charging = url.pathname.match(/^\/v1\/vehicles\/([^/]+)\/charging-status$/);
    if (charging) return json(response, 200, { data: await repository.getChargingStatus(decodeURIComponent(charging[1])) });
    const charges = url.pathname.match(/^\/v1\/vehicles\/([^/]+)\/charges$/);
    if (charges) return json(response, 200, { data: await repository.listCharges(decodeURIComponent(charges[1])) });
    if (url.pathname === "/v1/reports/summary") {
      const vehicleId = url.searchParams.get("vehicleId");
      if (!vehicleId) return json(response, 400, { error: "vehicle_id_required" });
      const data = await repository.getReport(vehicleId, url.searchParams.get("start"), url.searchParams.get("end"));
      return data ? json(response, 200, { data }) : json(response, 404, { error: "vehicle_not_found" });
    }
    return json(response, 404, { error: "not_found" });
  };
}
