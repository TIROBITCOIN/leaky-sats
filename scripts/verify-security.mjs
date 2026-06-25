import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

const root = process.cwd();
const appLockPath = join(root, "src", "lib", "appLock.ts");
const gatePath = join(root, "src", "components", "security", "AppLockGate.tsx");
const settingsPath = join(root, "src", "components", "security", "AppLockSettings.tsx");
const securityDocPath = join(root, "docs", "SECURITY.md");
const readmePath = join(root, "README.md");

assert.equal(existsSync(appLockPath), true, "src/lib/appLock.ts exists");
assert.equal(existsSync(gatePath), true, "AppLockGate component exists");
assert.equal(existsSync(settingsPath), true, "AppLockSettings component exists");
assert.equal(existsSync(securityDocPath), true, "SECURITY.md exists");

const appLock = readFileSync(appLockPath, "utf8");
const gate = readFileSync(gatePath, "utf8");
const settings = readFileSync(settingsPath, "utf8");
const securityDoc = readFileSync(securityDocPath, "utf8");
const readme = readFileSync(readmePath, "utf8");
const combinedDocs = `${securityDoc}\n${readme}`;

assert.match(appLock, /myledger\.appLock\.v1/, "app lock localStorage key is used");
assert.match(appLock, /crypto\.subtle/, "Web Crypto API is used");
assert.match(appLock, /PBKDF2/, "PBKDF2 is used for PIN hashing");
assert.match(appLock, /salt/, "salt is stored");
assert.match(appLock, /hash/, "hash is stored");
assert.match(appLock, /iterations/, "iterations are stored");
const storedConfigBlock = appLock.match(/const config: AppLockConfig = \{[\s\S]*?\n  \};/)?.[0] ?? "";
assert.doesNotMatch(storedConfigBlock, /\bpin\s*:/i, "PIN is not stored as a property");
assert.match(gate, /myledger-lock-now/, "manual lock event is handled");
assert.match(gate, /visibilitychange/, "background auto-lock handling exists");
assert.match(settings, /disableAppLock/, "PIN disable flow exists");
assert.match(settings, /changeAppLockPin/, "PIN change flow exists");

assert.match(combinedDocs, /localStorage-first|localStorage/, "localStorage privacy model is documented");
assert.match(combinedDocs, /DevTools/, "DevTools limitation is documented");
assert.match(combinedDocs, /캐주얼|casual/i, "casual protection limitation is documented");
assert.match(combinedDocs, /myledger\.appLock\.v1/, "app lock backup exclusion key is documented");
assert.match(combinedDocs, /myledger\.preRestoreBackup\.v1/, "pre-restore safety backup key is documented");
assert.match(combinedDocs, /백업 제외|backup/i, "backup exclusion policy is documented");
assert.match(combinedDocs, /시드|seed/i, "seed/private-key warning is documented");

console.log("verify:security passed");
