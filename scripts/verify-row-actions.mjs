import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const swipeableRow = readFileSync("src/components/transaction/SwipeableRow.tsx", "utf8");
const txnRow = readFileSync("src/components/home/TxnRow.tsx", "utf8");
const consumers = [
  "src/components/home/TxnsCard.tsx",
  "src/components/transaction/TxnListPage.tsx",
  "src/components/stats/SelectedDayTransactions.tsx",
].map((path) => readFileSync(path, "utf8"));

assert.match(swipeableRow, /createPortal/, "row actions render through a portal");
assert.match(swipeableRow, /txn\?: Txn/, "SwipeableRow accepts optional transaction details");
assert.match(swipeableRow, /document\.body/, "portal escapes the transaction list overflow");
assert.match(swipeableRow, /event\.key === "Escape"/, "Escape closes the action sheet");
assert.doesNotMatch(swipeableRow, /className="ldg-txn-menu"/, "clipped dropdown menu is removed");
assert.match(txnRow, /t\.memo/, "transaction rows expose a memo indicator");
for (const source of consumers) {
  assert.match(source, /txn=\{t\}/, "each transaction list passes transaction details to the sheet");
}

console.log("verify:row-actions passed");
