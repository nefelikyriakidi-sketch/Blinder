import { createServer } from "node:http";
import { readFile } from "node:fs/promises";
import { DatabaseSync } from "node:sqlite";

await import("./build.mjs");
const { default: worker } = await import("../dist/server/index.js");
const database = new DatabaseSync(":memory:");
database.exec(await readFile(new URL("../drizzle/0000_rooms.sql", import.meta.url), "utf8"));

const DB = {
  prepare(sql) {
    const statement = database.prepare(sql);
    return { bind: (...params) => ({
      first: () => statement.get(...params),
      run: async () => ({ meta: statement.run(...params) }),
    }) };
  },
};
const port = Number(process.argv[2] ?? 8093);
const base = `http://127.0.0.1:${port}`;
createServer(async (incoming, outgoing) => {
  try {
    const method = incoming.method;
    const options = { method, headers: incoming.headers };
    if (!["GET", "HEAD"].includes(method)) Object.assign(options, { body: incoming, duplex: "half" });
    const request = new Request(new URL(incoming.url, base), options);
    const response = await worker.fetch(request, { DB }, { waitUntil: () => {} });
    outgoing.writeHead(response.status, Object.fromEntries(response.headers));
    outgoing.end(Buffer.from(await response.arrayBuffer()));
  } catch {
    outgoing.writeHead(500).end("Preview failed");
  }
}).listen(port, "127.0.0.1", () => console.log(`Blinder preview at ${base}`));
