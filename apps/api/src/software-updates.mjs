import mqtt from "mqtt";

const fields = ["version", "update_available", "update_version", "healthy"];
const version = (value) => /^\d{4}\.\d+(?:\.\d+)*$/.test(value?.split(/\s+/)[0] ?? "")
  ? value.split(/\s+/)[0] : null;

function compareVersions(left, right) {
  const a = left.split(".").map(Number);
  const b = right.split(".").map(Number);
  for (let i = 0; i < Math.max(a.length, b.length); i++) {
    const difference = (a[i] ?? 0) - (b[i] ?? 0);
    if (difference) return difference;
  }
  return 0;
}

// Retained messages are last reported observations. Receipt time does not
// indicate when the vehicle was polled by TeslaMate.
export class SoftwareUpdateMonitor {
  constructor(client, topicPrefix = "teslamate", clock = () => new Date()) {
    this.client = client;
    this.prefix = `${topicPrefix}/cars/`;
    this.clock = clock;
    this.cars = new Map();
    this.connected = false;
    client.on("connect", () => {
      this.cars.clear();
      this.connected = true;
      client.subscribe(fields.map((field) => `${this.prefix}+/${field}`), { qos: 1 }, (error, grants) => {
        if (error || grants?.some((grant) => grant.qos === 128)) this.invalidate();
      });
    });
    for (const event of ["close", "offline", "error"]) client.on(event, () => this.invalidate());
    client.on("message", (topic, payload) => {
      if (!this.connected || !topic.startsWith(this.prefix)) return;
      const [id, field, extra] = topic.slice(this.prefix.length).split("/");
      if (!id || extra !== undefined || !fields.includes(field)) return;
      const car = this.cars.get(id) ?? {};
      car[field] = payload.toString().trim();
      if (field === "update_available") car.receivedAt = this.clock().toISOString();
      this.cars.set(id, car);
    });
  }

  invalidate() {
    this.connected = false;
    this.cars.clear();
  }

  overview(vehicle) {
    const car = this.connected ? this.cars.get(String(vehicle.id)) : null;
    const reported = version(car?.version);
    const recorded = version(vehicle.softwareVersion);
    // A broker may replay old retained values after an installation has already
    // been recorded in PostgreSQL. Never regress the installed version.
    const current = reported && (!recorded || compareVersions(reported, recorded) >= 0)
      ? reported : vehicle.softwareVersion;
    const installed = version(current);
    const target = version(car?.update_version);
    const targetIsNewer = Boolean(installed && target && compareVersions(target, installed) > 0);
    let status = "unknown";
    if (car?.healthy !== "false") {
      if (car?.update_available === "true") {
        status = installed && target && !targetIsNewer ? "no_update" : "available";
      } else if (car?.update_available === "false") {
        // TeslaMate only maps a subset of Tesla's `software_update.status`
        // values to `true`, so a vehicle that already downloaded an update can
        // still report `update_available=false`. The target version the
        // vehicle itself reports is authoritative: a newer one means the
        // update is pending.
        status = targetIsNewer ? "available" : "no_update";
      }
    }
    return {
      ...vehicle,
      softwareVersion: current,
      updateStatus: status,
      availableSoftwareVersion: status === "available" ? target : null,
      softwareUpdateReceivedAt: status === "unknown" ? null : car.receivedAt
    };
  }

  close() {
    this.invalidate();
    this.client.end(true);
  }
}

export function createSoftwareUpdateMonitor(environment = process.env) {
  if (environment.DATA_SOURCE !== "postgres" || !environment.TESLAMATE_MQTT_URL) return null;
  const client = mqtt.connect(environment.TESLAMATE_MQTT_URL, {
    reconnectPeriod: 5000,
    connectTimeout: 5000,
    username: environment.TESLAMATE_MQTT_USERNAME || undefined,
    password: environment.TESLAMATE_MQTT_PASSWORD || undefined
  });
  return new SoftwareUpdateMonitor(client, environment.TESLAMATE_MQTT_TOPIC_PREFIX || "teslamate");
}
