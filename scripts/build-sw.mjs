import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { createHash } from "node:crypto";
import { join } from "node:path";

// Stamp the built service worker (dist/sw.js) with a per-deploy cache version so browsers always
// detect a new service worker and refresh the app shell. Runs after `vite build` copies public/sw.js
// (with the __BUILD_ID__ placeholder) into dist/.
const dist = join(process.cwd(), "dist");
const swPath = join(dist, "sw.js");
const indexPath = join(dist, "index.html");

if (!existsSync(swPath)) {
  console.error("[build-sw] dist/sw.js not found — run `vite build` first");
  process.exit(1);
}

// Prefer Vercel's commit SHA so every deployed commit stamps a distinct service worker, even when
// only static assets outside index.html changed. Local builds fall back to the built app shell hash.
const indexHtml = existsSync(indexPath) ? readFileSync(indexPath, "utf8") : "";
const buildId =
  process.env.VERCEL_GIT_COMMIT_SHA?.slice(0, 12) ??
  createHash("sha256").update(indexHtml).digest("hex").slice(0, 12);

let sw = readFileSync(swPath, "utf8");
if (!sw.includes("__BUILD_ID__")) {
  console.error("[build-sw] placeholder __BUILD_ID__ not found in dist/sw.js");
  process.exit(1);
}
sw = sw.split("__BUILD_ID__").join(buildId);
writeFileSync(swPath, sw);
console.log(`[build-sw] stamped service worker cache version: ${buildId}`);
