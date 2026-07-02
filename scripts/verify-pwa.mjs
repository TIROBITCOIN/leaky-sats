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
assert.match(sw, /myledger-shell-v4/, "service worker cache name");
assert.match(sw, /mode === "navigate"/, "service worker navigation handling");
assert.match(sw, /url\.pathname\.startsWith\("\/api\/"\)/, "service worker does not cache same-origin API routes");

const index = readFileSync(indexPath, "utf8");
assert.match(index, /<link rel="manifest" href="\/manifest\.webmanifest"/, "index manifest link");
assert.match(index, /<meta name="theme-color" content="#f4f3ef"/, "index theme-color");
assert.match(index, /apple-mobile-web-app-capable/, "apple mobile meta");

assert.equal(existsSync(registerPath), true, "service worker registration file exists");
const register = readFileSync(registerPath, "utf8");
assert.match(register, /serviceWorker/, "service worker registration code");
assert.match(register, /import\.meta\.env\.PROD/, "production-only registration");

assert.equal(existsSync(installPromptPath), true, "install prompt component exists");
assert.equal(existsSync(offlineBadgePath), true, "offline badge component exists");

console.log("verify:pwa passed");
