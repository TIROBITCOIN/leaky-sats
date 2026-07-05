import assert from "node:assert/strict";
import { readFileSync, existsSync } from "node:fs";
import { join } from "node:path";

const root = process.cwd();
const manifestPath = join(root, "public", "manifest.webmanifest");
const swPath = join(root, "public", "sw.js");
const indexPath = join(root, "index.html");
const registerPath = join(root, "src", "registerServiceWorker.ts");
const installPromptPath = join(root, "src", "components", "pwa", "InstallPrompt.tsx");
const offlineBadgePath = join(root, "src", "components", "pwa", "OfflineBadge.tsx");

assert.equal(existsSync(manifestPath), true, "manifest.webmanifest exists");
const manifest = JSON.parse(readFileSync(manifestPath, "utf8"));
assert.equal(manifest.name, "My Ledger", "manifest name");
assert.equal(manifest.short_name, "Ledger", "manifest short_name");
assert.equal(manifest.start_url, "/", "manifest start_url");
assert.equal(manifest.display, "standalone", "manifest display");
assert.equal(manifest.theme_color, "#f4f3ef", "manifest theme_color");
assert.equal(manifest.background_color, "#f4f3ef", "manifest background_color");
assert.ok(Array.isArray(manifest.icons) && manifest.icons.length >= 3, "manifest icons");

for (const icon of manifest.icons) {
  assert.equal(existsSync(join(root, "public", icon.src.replace(/^\//, ""))), true, `icon exists: ${icon.src}`);
}

assert.equal(existsSync(swPath), true, "service worker exists");
const sw = readFileSync(swPath, "utf8");
// The cache version is stamped per-deploy at build time so browsers always detect a new SW
// (no more manual cache-name bumps).
assert.match(sw, /myledger-shell-/, "service worker cache name is namespaced");
assert.match(sw, /__BUILD_ID__/, "service worker cache version is a build-time placeholder (stamped per deploy)");
assert.match(sw, /self\.skipWaiting\(\)/, "service worker skips waiting on install");
assert.match(sw, /self\.clients\.claim\(\)/, "service worker claims clients on activate");
assert.match(sw, /mode === "navigate"/, "service worker navigation handling");
assert.match(sw, /url\.pathname\.startsWith\("\/api\/"\)/, "service worker does not cache same-origin API routes");
assert.doesNotMatch(sw, /client\.navigate\(client\.url\)/, "service worker does not bypass the client-side deferred reload guard");

// Build stamps the SW cache version with a content hash of the app shell.
const buildSwPath = join(root, "scripts", "build-sw.mjs");
assert.equal(existsSync(buildSwPath), true, "build-sw stamping script exists");
const buildSw = readFileSync(buildSwPath, "utf8");
assert.match(buildSw, /__BUILD_ID__/, "build-sw replaces the cache version placeholder");
const pkg = JSON.parse(readFileSync(join(root, "package.json"), "utf8"));
assert.match(pkg.scripts.build, /build-sw\.mjs/, "build runs the service worker stamping step");

const index = readFileSync(indexPath, "utf8");
assert.match(index, /<link rel="manifest" href="\/manifest\.webmanifest"/, "index manifest link");
assert.match(index, /<meta name="theme-color" content="#f4f3ef"/, "index theme-color");
assert.match(index, /apple-mobile-web-app-capable/, "apple mobile meta");

assert.equal(existsSync(registerPath), true, "service worker registration file exists");
const register = readFileSync(registerPath, "utf8");
assert.match(register, /serviceWorker/, "service worker registration code");
assert.match(register, /import\.meta\.env\.PROD/, "production-only registration");
assert.match(register, /updateViaCache:\s*"none"/, "service worker registration bypasses cached sw.js checks");
// Client auto-reloads when a new service worker takes control, and polls for updates so an
// already-open (installed) session picks up new deploys.
assert.match(register, /controllerchange/, "client reloads when a new service worker takes control");
assert.match(register, /requestReloadAfterSellSave/, "client defers service worker reloads while a sell save is in progress");
assert.match(register, /registration\.update\(\)/, "client polls for service worker updates");

const saveInProgressPath = join(root, "src", "lib", "sellSaveInProgress.ts");
assert.equal(existsSync(saveInProgressPath), true, "sell save-in-progress helper exists");
const saveInProgress = readFileSync(saveInProgressPath, "utf8");
assert.match(saveInProgress, /__ldgSaveInProgress/, "save helper uses a global save-in-progress flag");
assert.match(saveInProgress, /__ldgPendingReloadAfterSave/, "save helper tracks a deferred reload");
assert.match(saveInProgress, /setSellSaveInProgress/, "save helper exports a setter");
assert.match(saveInProgress, /requestReloadAfterSellSave/, "save helper exports a deferred reload requester");
assert.match(saveInProgress, /window\.location\.reload\(\)/, "save helper performs the deferred reload");

assert.equal(existsSync(installPromptPath), true, "install prompt component exists");
assert.equal(existsSync(offlineBadgePath), true, "offline badge component exists");

console.log("verify:pwa passed");
