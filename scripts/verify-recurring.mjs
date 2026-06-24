import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import ts from "typescript";

const source = readFileSync("src/lib/recurringRules.ts", "utf8");
const entry = readFileSync("src/components/transaction/TransactionEntryPage.tsx", "utf8");
assert.match(source, /myledger\.recurringRules\.v1/, "recurring rules use a versioned key");
assert.match(source, /myledger\.recurringMaterialized\.v1/, "materialized months use a versioned key");
assert.match(source, /try\s*\{[\s\S]*localStorage\.getItem/, "loads guard storage access");
assert.match(source, /catch\s*\{/, "invalid storage falls back safely");
assert.match(entry, /markRecurringMaterialized/, "the transaction that creates a rule marks its settlement month");

const compiled = ts.transpileModule(source, {
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
const recurring = await import(moduleUrl);

assert.equal(recurring.normalizeRecurringDay(-3), 1, "days below range clamp to 1");
assert.equal(recurring.normalizeRecurringDay(31), 28, "days above range clamp to 28");
assert.equal(recurring.normalizeRecurringDay(12.6), 13, "days are rounded");

storage.setItem(recurring.RECURRING_RULES_KEY, "{broken");
assert.deepEqual(recurring.listRecurringRules(), [], "broken JSON falls back to an empty rule list");
storage.setItem(recurring.RECURRING_RULES_KEY, JSON.stringify([{ id: "bad" }]));
assert.deepEqual(recurring.listRecurringRules(), [], "invalid rules are rejected");

const rule = recurring.addRecurringRule({
  title: "월세",
  cat: "housing",
  isIncome: false,
  dayOfMonth: 31,
  lastAmount: 500000,
});
assert.equal(rule.dayOfMonth, 28, "stored rule day is normalized");
assert.equal(recurring.listRecurringRules().length, 1, "valid rule persists");

assert.equal(recurring.markRecurringMaterialized(rule.id, "2026-07"), true, "first confirmation is recorded");
assert.equal(recurring.markRecurringMaterialized(rule.id, "2026-07"), false, "duplicate month confirmation is blocked");
assert.equal(recurring.isRecurringMaterialized(rule.id, "2026-07"), true, "materialized state survives reload");

assert.equal(
  recurring.mapRecurringRuleDate({ startDate: "2026-06-17", endDate: "2026-07-16" }, 20),
  "2026-06-20",
  "rule day maps to the starting calendar month when inside the settlement period"
);
assert.equal(
  recurring.mapRecurringRuleDate({ startDate: "2026-06-17", endDate: "2026-07-16" }, 10),
  "2026-07-10",
  "rule day maps to the ending calendar month when inside the settlement period"
);

console.log("verify:recurring passed");
