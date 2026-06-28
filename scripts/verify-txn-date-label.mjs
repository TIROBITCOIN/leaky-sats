import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const txnRow = readFileSync("src/components/home/TxnRow.tsx", "utf8");
const format = readFileSync("src/lib/format.ts", "utf8");

// TxnRow imports formatTxnTime
assert.match(txnRow, /import.*formatTxnTime.*from/, "TxnRow imports formatTxnTime");

// TxnRow uses getTxnDisplayTime helper instead of raw t.time
assert.match(txnRow, /getTxnDisplayTime/, "TxnRow uses getTxnDisplayTime helper");

// getTxnDisplayTime calls formatTxnTime(txn.date)
assert.match(txnRow, /formatTxnTime\(txn\.date\)/, "getTxnDisplayTime computes label from txn.date");

// getTxnDisplayTime has fallback to txn.time for old data
assert.match(txnRow, /return txn\.time/, "getTxnDisplayTime falls back to txn.time");

// TxnRow does not directly render t.time in JSX
const jsxSection = txnRow.slice(txnRow.indexOf("return ("));
assert.doesNotMatch(jsxSection, /\bt\.time\b/, "JSX does not directly render t.time");

// formatTxnTime still exists and computes relative labels
assert.match(format, /formatTxnTime/, "formatTxnTime exists in format.ts");
assert.match(format, /오늘/, "formatTxnTime produces 오늘 label");
assert.match(format, /어제/, "formatTxnTime produces 어제 label");

// formatTxnTime hides 00:00 time
assert.match(format, /hasTime/, "formatTxnTime checks for 00:00");
assert.match(format, /hh !== 0 \|\| mm !== 0/, "formatTxnTime treats 00:00 as no-time");
// Past dates also get time suffix when non-zero
assert.match(format, /월.*일.*timeSuffix/, "past dates include timeSuffix");

// Txn type still has time field (not removed for compatibility)
const types = readFileSync("src/types.ts", "utf8");
assert.match(types, /time:\s*string/, "Txn type retains time field for compatibility");

// LedgerContext still stores time on create/edit (backward compat)
const ctx = readFileSync("src/state/LedgerContext.tsx", "utf8");
assert.match(ctx, /time:\s*formatTxnTime\(input\.date\)/, "LedgerContext still stores time on txn create");

console.log("verify:txn-date-label passed");
