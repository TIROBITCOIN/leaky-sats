import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const swSrc = readFileSync("public/sw.js", "utf8");

assert.match(swSrc, /clients\.matchAll/, "service worker enumerates open clients on activation");
assert.match(swSrc, /includeUncontrolled:\s*true/, "service worker includes uncontrolled PWA windows");
assert.match(swSrc, /client\.navigate\(url\.href\)/, "service worker navigates open clients to the freshly cached app");
assert.match(swSrc, /myledger-sw-version/, "service worker avoids repeating the same forced navigation for one cache version");

console.log("verify:pwa-client-refresh passed");
