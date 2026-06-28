import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const txnRow = readFileSync("src/components/home/TxnRow.tsx", "utf8");
const format = readFileSync("src/lib/format.ts", "utf8");

// TxnRow imports formatTxnDateLabel (date-only, no time)
assert.match(txnRow, /import.*formatTxnDateLabel.*from/, "TxnRow imports formatTxnDateLabel");

// TxnRow uses getTxnDisplayTime helper instead of raw t.time
assert.match(txnRow, /getTxnDisplayTime/, "TxnRow uses getTxnDisplayTime helper");

// getTxnDisplayTime calls formatTxnDateLabel(txn.date)
assert.match(txnRow, /formatTxnDateLabel\(txn\.date\)/, "getTxnDisplayTime uses formatTxnDateLabel");

// getTxnDisplayTime has fallback to txn.time for old data
assert.match(txnRow, /return txn\.time/, "getTxnDisplayTime falls back to txn.time");

// TxnRow does not directly render t.time in JSX
const jsxSection = txnRow.slice(txnRow.indexOf("return ("));
assert.doesNotMatch(jsxSection, /\bt\.time\b/, "JSX does not directly render t.time");

// formatTxnDateLabel exists and returns date-only labels
assert.match(format, /formatTxnDateLabel/, "formatTxnDateLabel exists in format.ts");
assert.match(format, /export const formatTxnDateLabel/, "formatTxnDateLabel is exported");

// formatTxnDateLabel does NOT include time suffix
const fnMatch = format.match(/export const formatTxnDateLabel[\s\S]*?^};/m);
assert.ok(fnMatch, "formatTxnDateLabel function body found");
const fnBody = fnMatch[0];
assert.doesNotMatch(fnBody, /timeSuffix/, "formatTxnDateLabel has no timeSuffix");
assert.doesNotMatch(fnBody, /getHours|getMinutes/, "formatTxnDateLabel does not use hours/minutes");
assert.match(fnBody, /오늘/, "formatTxnDateLabel produces 오늘");
assert.match(fnBody, /어제/, "formatTxnDateLabel produces 어제");
assert.match(fnBody, /월.*일/, "formatTxnDateLabel produces M월 D일");

// formatTxnTime still exists (used for storage in LedgerContext)
assert.match(format, /export const formatTxnTime/, "formatTxnTime still exists");

// Txn type still has time field (not removed for compatibility)
const types = readFileSync("src/types.ts", "utf8");
assert.match(types, /time:\s*string/, "Txn type retains time field for compatibility");

// LedgerContext still stores time on create/edit (backward compat)
const ctx = readFileSync("src/state/LedgerContext.tsx", "utf8");
assert.match(ctx, /time:\s*formatTxnTime\(input\.date\)/, "LedgerContext still stores time on txn create");

console.log("verify:txn-date-label passed");
