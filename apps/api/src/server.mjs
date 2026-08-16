import { createServer } from "node:http";
import { createApp } from "./app.mjs";
import { createRepository } from "./repository.mjs";

const host = process.env.HOST ?? "127.0.0.1";
const port = Number(process.env.PORT ?? 8787);
const server = createServer(createApp(createRepository()));
server.listen(port, host, () => console.log(`Tesla Companion API listening on http://${host}:${port}`));
