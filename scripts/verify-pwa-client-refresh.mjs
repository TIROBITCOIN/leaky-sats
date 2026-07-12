import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const swSrc = readFileSync("public/sw.js", "utf8");
const registerSrc = readFileSync("src/registerServiceWorker.ts", "utf8");
const reloadGateSrc = readFileSync("src/lib/reloadGate.ts", "utf8");
const appLockGateSrc = readFileSync("src/components/security/AppLockGate.tsx", "utf8");

// The service worker used to force-navigate every open client (client.navigate()) the moment
// a new version activated. That fired from the SW thread with zero awareness of app state and
// could race the PIN lock screen's just-mounted keypad, leaving it visible but unresponsive.
// The single reload path is now the window-side controllerchange listener, gated by
// reloadGate.ts so it defers while the lock screen (or an in-flight save) is up.
assert.match(swSrc, /self\.clients\.claim\(\)/, "service worker claims open clients on activation");
assert.doesNotMatch(
  swSrc,
  /client\.navigate\(/,
  "service worker must not force-navigate open clients (this raced the PIN lock screen and left it inert)"
);

assert.match(registerSrc, /controllerchange/, "app listens for the new service worker taking control");
assert.match(registerSrc, /requestReload\(\)/, "controllerchange reload goes through the lock-aware reload gate");

assert.match(reloadGateSrc, /export function setReloadBlocked/, "reloadGate exposes a way to block/unblock the deploy reload");
assert.match(reloadGateSrc, /export function requestReload/, "reloadGate exposes the gated reload trigger");

assert.match(
  appLockGateSrc,
  /setReloadBlocked\("app-lock"/,
  "AppLockGate blocks the deploy-triggered reload while the PIN screen is showing"
);

console.log("verify:pwa-client-refresh passed");
