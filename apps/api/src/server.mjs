import { createServer } from "node:http";
import { createApp } from "./app.mjs";
import { createRepository } from "./repository.mjs";
import { createSoftwareUpdateMonitor } from "./software-updates.mjs";

const host = process.env.HOST ?? "127.0.0.1";
const port = Number(process.env.PORT ?? 8787);
const softwareUpdates = createSoftwareUpdateMonitor();
const server = createServer(createApp(createRepository(), undefined, undefined, softwareUpdates));
server.listen(port, host, () => console.log(`Tesla Companion API listening on http://${host}:${port}`));
for (const signal of ["SIGINT", "SIGTERM"]) {
  process.once(signal, () => {
    softwareUpdates?.close();
    server.close(() => process.exit(0));
  });
}
