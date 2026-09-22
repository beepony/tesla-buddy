import assert from "node:assert/strict";
import { EventEmitter } from "node:events";
import test from "node:test";
import { SoftwareUpdateMonitor, createSoftwareUpdateMonitor } from "../src/software-updates.mjs";

const vehicle = { id: "1", softwareVersion: "2026.8.3.6 abc123", batteryLevelPercent: 68 };
function setup(prefix = "teslamate", subscribeError = null) {
  const client = new EventEmitter();
  client.subscribe = (topics, options, callback) => callback(subscribeError);
  client.end = () => {};
  const monitor = new SoftwareUpdateMonitor(client, prefix, () => new Date("2026-09-06T09:00:00Z"));
  client.emit("connect");
  const send = (field, value, id = "1") => client.emit("message", `${prefix}/cars/${id}/${field}`, Buffer.from(value));
  return { client, monitor, send, overview: () => monitor.overview(vehicle) };
}

test("missing and invalid availability signals stay unknown", () => {
  const { overview, send } = setup();
  assert.equal(overview().updateStatus, "unknown");
  send("update_version", "2026.26.1");
  for (const value of ["", "null", "unknown", "TRUE", "1"]) {
    send("update_available", value);
    assert.equal(overview().updateStatus, "unknown");
    assert.equal(overview().softwareUpdateReceivedAt, null);
  }
  send("update_version", "2026.8.3.6");
  send("update_available", "false");
  assert.equal(overview().updateStatus, "no_update");
  assert.equal(overview().availableSoftwareVersion, null);
});

test("a target version newer than the installed one is an update even when the availability flag is off", () => {
  const { overview, send } = setup();
  send("update_version", "2026.26.200.11");
  send("update_available", "false");
  assert.equal(overview().updateStatus, "available");
  assert.equal(overview().availableSoftwareVersion, "2026.26.200.11");
  assert.equal(overview().softwareUpdateReceivedAt, "2026-09-06T09:00:00.000Z");
});

test("a pending update clears once the installed version catches up with the target", () => {
  const { overview, send } = setup();
  send("update_version", "2026.26.200.11");
  send("update_available", "false");
  assert.equal(overview().updateStatus, "available");
  send("version", "2026.26.200.11");
  assert.equal(overview().updateStatus, "no_update");
  assert.equal(overview().availableSoftwareVersion, null);
});

test("an equal, older or malformed target version never reports an update", () => {
  const { overview, send } = setup();
  send("update_available", "false");
  for (const value of ["2026.8.3.6", "2026.7.1", "invalid", ""]) {
    send("update_version", value);
    assert.equal(overview().updateStatus, "no_update");
    assert.equal(overview().availableSoftwareVersion, null);
  }
});

test("reports the vehicle's update, handles either topic order and clears it after installation", () => {
  for (const availabilityFirst of [true, false]) {
    const { send, overview } = setup();
    if (availabilityFirst) send("update_available", "true");
    send("update_version", "2026.26.1 deadbeef");
    send("update_available", "true");
    assert.equal(overview().updateStatus, "available");
    assert.equal(overview().availableSoftwareVersion, "2026.26.1");
    assert.equal(overview().softwareUpdateReceivedAt, "2026-09-06T09:00:00.000Z");
    assert.equal(overview().batteryLevelPercent, 68);
    send("version", "2026.26.1");
    assert.equal(overview().softwareVersion, "2026.26.1");
    assert.equal(overview().updateStatus, "no_update");
    assert.equal(overview().availableSoftwareVersion, null);
    send("update_available", "false");
    assert.equal(overview().updateStatus, "no_update");
  }
});

test("missing target version does not hide an explicit update, and cleared payload removes old target", () => {
  const { send, overview } = setup();
  send("update_available", "true");
  for (const value of ["", "null", "invalid", "2026.26.1"]) {
    send("update_version", value);
    assert.equal(overview().updateStatus, "available");
    assert.equal(overview().availableSoftwareVersion, value === "2026.26.1" ? value : null);
  }
  send("update_version", "");
  assert.equal(overview().availableSoftwareVersion, null);
});

test("numeric comparison suppresses retained versions already installed, including hash suffixes", () => {
  const { monitor, send } = setup();
  send("version", "2026.8.3.6");
  send("update_available", "true");
  send("update_version", "2026.9.1");
  const installed = { ...vehicle, softwareVersion: "2026.26.1 hash" };
  assert.equal(monitor.overview(installed).softwareVersion, installed.softwareVersion);
  assert.equal(monitor.overview(installed).updateStatus, "no_update");
  send("update_version", "2026.26.1.0");
  assert.equal(monitor.overview(installed).updateStatus, "no_update");
  send("update_version", "2026.26.2");
  assert.equal(monitor.overview(installed).updateStatus, "available");
});

test("disconnect, failed subscriptions and unhealthy logger cannot report a confirmed status", () => {
  for (const event of ["close", "offline", "error"]) {
    const { client, send, overview } = setup();
    send("update_available", "true");
    client.emit(event);
    assert.equal(overview().updateStatus, "unknown");
    client.emit("connect");
    assert.equal(overview().updateStatus, "unknown");
    send("update_available", "false");
    assert.equal(overview().updateStatus, "no_update");
    send("healthy", "false");
    assert.equal(overview().updateStatus, "unknown");
  }
  const failed = setup("teslamate", new Error("subscription denied"));
  failed.send("update_available", "true");
  assert.equal(failed.overview().updateStatus, "unknown");
});

test("namespaced topics and vehicle ids remain isolated", () => {
  const { client, send, overview, monitor } = setup("teslamate/home");
  send("update_available", "true", "2");
  client.emit("message", "teslamate/cars/1/update_available", Buffer.from("true"));
  send("update_available/extra", "true");
  assert.equal(overview().updateStatus, "unknown");
  assert.equal(monitor.overview({ ...vehicle, id: "2" }).updateStatus, "available");
  send("update_available", "false");
  assert.equal(overview().updateStatus, "no_update");
  monitor.close();
  assert.equal(overview().updateStatus, "unknown");
});

test("mock mode and missing broker configuration do not create connections", () => {
  assert.equal(createSoftwareUpdateMonitor({ DATA_SOURCE: "mock", TESLAMATE_MQTT_URL: "mqtt://unused" }), null);
  assert.equal(createSoftwareUpdateMonitor({ DATA_SOURCE: "postgres" }), null);
});
