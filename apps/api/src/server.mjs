import { createServer } from "node:http";
import { createApp } from "./app.mjs";
import { createRepository } from "./repository.mjs";
import { createSoftwareUpdateMonitor } from "./software-updates.mjs";
import { createWechatNotifier, startSoftwareUpdateWatcher } from "./wechat.mjs";

const host = process.env.HOST ?? "127.0.0.1";
const port = Number(process.env.PORT ?? 8787);
const repository = createRepository();
const softwareUpdates = createSoftwareUpdateMonitor();
const wechat = createWechatNotifier();
const stopWatcher = startSoftwareUpdateWatcher({ repository, softwareUpdates, notifier: wechat });
const server = createServer(createApp(repository, undefined, undefined, softwareUpdates, wechat));
server.listen(port, host, () => console.log(`Tesla Companion API listening on http://${host}:${port}`));
for (const signal of ["SIGINT", "SIGTERM"]) {
  process.once(signal, () => {
    stopWatcher();
    softwareUpdates?.close();
    server.close(() => process.exit(0));
  });
}
