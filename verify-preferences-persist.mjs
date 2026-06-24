import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import ts from "typescript";

const preferencesPath = "src/lib/preferences.ts";
assert.equal(existsSync(preferencesPath), true, "preferences storage module exists");

const preferences = readFileSync(preferencesPath, "utf8");
const ledger = readFileSync("src/state/LedgerContext.tsx", "utf8");
const backup = readFileSync("src/lib/backup.ts", "utf8");
const format = readFileSync("src/lib/format.ts", "utf8");

assert.match(preferences, /myledger\.currency\.v1/, "currency uses a versioned localStorage key");
assert.match(preferences, /myledger\.refreshInterval\.v1/, "refresh interval uses a versioned localStorage key");
assert.match(preferences, /try\s*\{[\s\S]*localStorage\.getItem/, "preference loads guard localStorage access");
assert.match(preferences, /catch\s*\{/, "preference loads fall back after storage errors");
assert.match(preferences, /value === "KRW" \|\| value === "BTC"/, "currency load validates the allowed values");
assert.match(preferences, /30_000[\s\S]*60_000[\s\S]*300_000/, "refresh interval whitelist is explicit");
assert.match(preferences, /ALLOWED_REFRESH_INTERVALS\.includes/, "refresh interval load validates against the whitelist");

assert.match(ledger, /currency:\s*loadCurrency\(\)/, "initial currency loads from persistence");
assert.match(ledger, /refreshIntervalMs:\s*loadRefreshInterval\(\)/, "initial refresh interval loads from persistence");
assert.match(ledger, /saveCurrency\(state\.currency\)/, "currency changes are persisted");
assert.match(ledger, /saveRefreshInterval\(state\.refreshIntervalMs\)/, "refresh interval changes are persisted");
assert.match(
  ledger,
  /refreshIntervalMs:\s*normalizeRefreshInterval\(action\.ms\)/,
  "refresh interval actions are clamped to the whitelist"
);

assert.match(format, /myledger\.displayUnit\.v1/, "BTC/sats display unit remains independently persisted");
assert.match(backup, /CURRENCY_STORAGE_KEY/, "backup includes currency preference");
assert.match(backup, /REFRESH_INTERVAL_STORAGE_KEY/, "backup includes refresh interval preference");
assert.match(backup, /currency:\s*CURRENCY_STORAGE_KEY/, "currency is part of BACKUP_KEYS");
assert.match(backup, /refreshInterval:\s*REFRESH_INTERVAL_STORAGE_KEY/, "refresh interval is part of BACKUP_KEYS");
assert.match(backup, /saveCurrency\(payload\.data\[CURRENCY_STORAGE_KEY\]\)/, "backup restore validates currency");
assert.match(backup, /saveRefreshInterval\(Number\(payload\.data\[REFRESH_INTERVAL_STORAGE_KEY\]\)\)/, "backup restore validates refresh interval");

const compiled = ts.transpileModule(preferences, {
  compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 },
}).outputText;
const moduleUrl = `data:text/javascript;base64,${Buffer.from(compiled).toString("base64")}`;

class MemoryStorage {
  #items = new Map();

  getItem(key) {
    return this.#items.has(key) ? this.#items.get(key) : null;
  }

  setItem(key, value) {
    this.#items.set(key, String(value));
  }
}

const storage = new MemoryStorage();
globalThis.localStorage = storage;
const persisted = await import(moduleUrl);

assert.equal(persisted.loadCurrency(), "KRW", "currency defaults to KRW");
persisted.saveCurrency("BTC");
assert.equal(persisted.loadCurrency(), "BTC", "BTC currency survives reload");
storage.setItem(persisted.CURRENCY_STORAGE_KEY, "USD");
assert.equal(persisted.loadCurrency(), "KRW", "invalid currency falls back safely");

for (const interval of [30_000, 60_000, 300_000]) {
  persisted.saveRefreshInterval(interval);
  assert.equal(persisted.loadRefreshInterval(), interval, `${interval} refresh interval survives reload`);
}
storage.setItem(persisted.REFRESH_INTERVAL_STORAGE_KEY, "1000");
assert.equal(persisted.loadRefreshInterval(), 60_000, "too-small refresh interval falls back to one minute");
assert.equal(persisted.saveRefreshInterval(Number.NaN), 60_000, "invalid refresh interval is normalized before save");

console.log("verify:preferences-persist passed");
