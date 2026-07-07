import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import ts from "typescript";

const root = process.cwd();
const source = readFileSync(join(root, "src/lib/btcSellRecords.ts"), "utf8");
const compilerOptions = { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 };
const moduleUrl = `data:text/javascript;base64,${Buffer.from(
  ts.transpileModule(source, { compilerOptions }).outputText,
).toString("base64")}`;

const storage = new Map();
let failWrites = false;

globalThis.localStorage = {
  getItem(key) {
    return storage.has(key) ? storage.get(key) : null;
  },
  setItem(key, value) {
    if (failWrites) {
      throw new Error("simulated localStorage write failure");
    }
    storage.set(key, value);
  },
  removeItem(key) {
    storage.delete(key);
  },
  clear() {
    storage.clear();
  },
};

const records = await import(moduleUrl);
const baseRecord = {
  month: "2026-07",
  date: "2026-07-07",
  btcSold: 0.01,
  satsSold: 1_000_000,
  btcKrwAtSell: 100_000_000,
  krwCovered: 1_000_000,
  deficitKrwAtConfirm: 1_000_000,
  deductedFromHeldBtc: true,
  deductedBtcAmount: 0.01,
};

failWrites = true;
assert.equal(
  records.addBtcSellRecord(baseRecord),
  null,
  "addBtcSellRecord must report failed persistence instead of pretending success",
);

failWrites = false;
const saved = records.addBtcSellRecord(baseRecord);
assert.ok(saved, "addBtcSellRecord returns the record after successful persistence");

failWrites = true;
assert.equal(
  records.updateBtcSellRecord(saved.id, { krwCovered: 1_100_000 }),
  null,
  "updateBtcSellRecord must report failed persistence",
);
assert.equal(
  records.getBtcSellRecordById(saved.id)?.krwCovered,
  1_000_000,
  "failed update must leave the stored record unchanged",
);

assert.equal(records.deleteBtcSellRecord(saved.id), false, "deleteBtcSellRecord must report failed persistence");
assert.ok(records.getBtcSellRecordById(saved.id), "failed delete must leave the stored record available");

console.log("verify:sell-save passed");
