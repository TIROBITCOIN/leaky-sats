import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const entry = readFileSync("src/components/transaction/TransactionEntryPage.tsx", "utf8");
const forms = readFileSync("src/styles/forms.css", "utf8");

assert.doesNotMatch(entry, /type="datetime-local"/, "transaction entry no longer renders a datetime-local input");
assert.match(entry, /type="date"/, "transaction entry uses a date-only input");
assert.match(entry, /ldg-field ldg-date-field/, "date input uses an overflow-safe wrapper");
assert.match(
  entry,
  /if \(editingTxn\) return editingTxn\.date\.slice\(0, 10\)/,
  "editing displays only the stored transaction date"
);
assert.match(entry, /getTodayDateKey\(\)/, "new transactions default to today's date without a month query");
assert.match(
  entry,
  /getDefaultDateKeyForPeriod\(period\)/,
  "month query keeps the settlement-period default date policy"
);
assert.match(entry, /const storedDate = `\$\{date\}T00:00`/, "date-only state is converted to a compatible stored datetime");
assert.match(
  entry,
  /addTxn\(\{[\s\S]*date: storedDate/,
  "new transactions save the compatible datetime value"
);
assert.match(
  entry,
  /updateTxn\(editingTxn\.id,[\s\S]*date: storedDate/,
  "edited transactions save the compatible datetime value"
);
assert.match(
  entry,
  /getSettlementMonthKeyForDate\(storedDate, loadSettlementDay\(\)\)/,
  "recurring materialization uses the compatible stored datetime"
);
assert.match(entry, /Number\(date\.slice\(8, 10\)\)/, "recurring day still derives from the date-only state");

assert.match(
  forms,
  /\.ldg-field\s*\{[^}]*min-width:\s*0/s,
  "date field wrapper can shrink inside mobile cards"
);
assert.match(
  forms,
  /\.ldg-input,[\s\S]*?width:\s*100%;[^}]*max-width:\s*100%;[^}]*min-width:\s*0;[^}]*box-sizing:\s*border-box/s,
  "shared inputs stay within their mobile container"
);
assert.match(
  forms,
  /\.ldg-amount-input\s*\{[^}]*width:\s*100%;[^}]*max-width:\s*100%;[^}]*min-width:\s*0;[^}]*box-sizing:\s*border-box/s,
  "amount input also uses the safe mobile box model"
);
assert.match(
  forms,
  /\.ldg-date-field\s*\{[^}]*overflow:\s*hidden/s,
  "date field clips any remaining iOS native control overflow"
);
assert.match(
  forms,
  /\.ldg-input\[type="date"\]\s*\{[^}]*inline-size:\s*100%;[^}]*max-inline-size:\s*100%;[^}]*min-inline-size:\s*0;[^}]*-webkit-appearance:\s*none/s,
  "date input overrides the iOS native intrinsic width"
);
assert.match(
  forms,
  /::-webkit-date-and-time-value\s*\{[^}]*min-width:\s*0;[^}]*text-align:\s*left/s,
  "iOS date value can shrink and stays aligned inside the field"
);

console.log("verify:date-input passed");
