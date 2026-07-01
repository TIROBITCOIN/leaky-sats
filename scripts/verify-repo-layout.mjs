import assert from "node:assert/strict";
import { existsSync, readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";

const root = process.cwd();
const removedPrototypeFiles = [
  "app.jsx",
  "myledger.jsx",
  "tweaks-panel.jsx",
  "styles.css",
  "myledger.css",
  "SPEC.md",
  "Lightning Strike.html",
  "DESIGN_FIXES.md",
];

for (const file of removedPrototypeFiles) {
  assert.equal(existsSync(join(root, file)), false, `${file} is removed from the repository root`);
}

assert.equal(existsSync(join(root, ".thumbnail")), true, "unclassified .thumbnail asset remains intentionally untouched");

const rootVerifyScripts = readdirSync(root).filter((file) => /^verify-.*\.mjs$/.test(file));
assert.deepEqual(rootVerifyScripts, [], "verify scripts no longer live in the repository root");

const scriptFiles = readdirSync(join(root, "scripts")).filter((file) => /^verify-.*\.mjs$/.test(file));
assert.ok(scriptFiles.length >= 19, "verify scripts are collected under scripts/");

const pkg = JSON.parse(readFileSync(join(root, "package.json"), "utf8"));
const verifyCommands = Object.entries(pkg.scripts).filter(([name]) => name.startsWith("verify:"));
assert.ok(verifyCommands.length > 0, "package.json exposes verification commands");
for (const [name, command] of verifyCommands) {
  const isAggregator = /(^|\s)npm run /.test(command) || command.includes("&&");
  if (isAggregator) continue;

  assert.match(command, /^node scripts\/verify-.*\.mjs$/, `${name} points to scripts/`);
}

console.log("verify:repo-layout passed");
