import { mkdir, readFile, writeFile } from "node:fs/promises";

const root = new URL("../", import.meta.url);
const types = {
  "index.html": "text/html; charset=utf-8",
  "app.js": "text/javascript; charset=utf-8",
  "round.js": "text/javascript; charset=utf-8",
  "venues.js": "text/javascript; charset=utf-8",
  "styles.css": "text/css; charset=utf-8",
  "sw.js": "text/javascript; charset=utf-8",
  "manifest.webmanifest": "application/manifest+json",
  "icon-192.png": "image/png",
  "icon-512.png": "image/png",
  "apple-touch-icon.png": "image/png",
  "venue-photos.jpg": "image/jpeg",
  "outing-photos.jpg": "image/jpeg",
};
const assets = {};
for (const [file, type] of Object.entries(types)) {
  const bytes = await readFile(new URL(`dist/${file}`, root));
  assets[`/${file}`] = [type, bytes.toString("base64")];
}

const rules = await readFile(new URL("dist/round.js", root), "utf8");
const profiles = await readFile(new URL("worker/profiles.js", root), "utf8");
const worker = await readFile(new URL("worker/index.js", root), "utf8");
const profileImport = 'import { RoundError } from "../dist/round.js";';
const workerImports = 'import { RoundError, applyAction, createRound, member, outingLabels, recordActivity, viewOf } from "../dist/round.js";\n'
  + 'import { accountOf, handleAccount } from "./profiles.js";';
if (!worker.startsWith(workerImports) || !profiles.startsWith(profileImport)) {
  throw new Error("Missing shared module imports in Worker source.");
}
const destination = new URL("dist/server/", root);
await mkdir(destination, { recursive: true });
await writeFile(new URL("index.js", destination),
  `${rules}\n${profiles.slice(profileImport.length)}\n${worker.slice(workerImports.length)}\nexport default createWorker(${JSON.stringify(assets)});\n`);
