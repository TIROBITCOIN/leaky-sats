import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";

// COPYRIGHT.md exists
assert.equal(existsSync("COPYRIGHT.md"), true, "COPYRIGHT.md exists");

// NOTICE.md exists
assert.equal(existsSync("NOTICE.md"), true, "NOTICE.md exists");

// README.md contains repository URL
const readme = readFileSync("README.md", "utf8");
assert.match(readme, /https:\/\/github\.com\/TIROBITCOIN\/leaky-sats/, "README.md contains repository URL");

// appMeta.ts contains TIROBITCOIN and repositoryUrl
const appMeta = readFileSync("src/constants/appMeta.ts", "utf8");
assert.match(appMeta, /TIROBITCOIN/, "appMeta.ts contains TIROBITCOIN");
assert.match(appMeta, /repositoryUrl/, "appMeta.ts contains repositoryUrl");

// Settings or Help page references APP_META.copyright (renders © 2026 TIROBITCOIN at runtime)
const settings = readFileSync("src/components/settings/SettingsPage.tsx", "utf8");
const help = readFileSync("src/components/settings/HelpPage.tsx", "utf8");
const hasCopyright =
  (/APP_META\.copyright/.test(settings) || /APP_META\.copyright/.test(help)) &&
  /© 2026 TIROBITCOIN/.test(appMeta);
assert.equal(hasCopyright, true, "APP_META.copyright with © 2026 TIROBITCOIN is used in Settings or Help");

console.log("verify:ownership passed");
