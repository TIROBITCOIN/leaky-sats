import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import ts from "typescript";

const read = (path) => readFileSync(path, "utf8");

const formsCss = read("src/styles/forms.css");
const ledgerCss = read("src/styles/ledger.css");
const tokensCss = read("src/styles/tokens.css");
const formatSrc = read("src/lib/format.ts");
const recurringSrc = read("src/lib/recurringRules.ts");
const entry = read("src/components/transaction/TransactionEntryPage.tsx");
const keypad = read("src/components/transaction/AmountKeypad.tsx");
const sellModal = read("src/components/home/SellConfirmModal.tsx");
const pendingCard = read("src/components/home/RecurringPendingCard.tsx");

// ---- 1. Custom amount keypad (no system numeric keyboard on amount) ----
assert.match(keypad, /createPortal/, "AmountKeypad portals to body");
assert.match(keypad, /ldg-amount-keypad/, "AmountKeypad uses keypad styles");
assert.match(keypad, /formatKrwInput/, "keypad writes formatted amounts");
assert.match(keypad, /onPointerDown/, "keypad uses pointer events for reliable iOS taps");
assert.match(entry, /AmountKeypad/, "transaction entry mounts AmountKeypad");
// iOS: readOnly <input> still summons the system keyboard — amount must be a button
assert.match(entry, /<button[\s\S]*ldg-amount-display/, "amount display is a button, not an input");
assert.match(entry, /useState\(true\)/, "amount keypad opens by default on the entry form");
assert.match(entry, /ldg-amount-display/, "amount field uses the custom display class");
assert.match(entry, /onFocusCapture=\{closeKeypad\}/, "text fields close the amount keypad on focus");
assert.doesNotMatch(
  entry,
  /ldg-amount-display[\s\S]{0,200}readOnly|readOnly[\s\S]{0,200}ldg-amount-display/,
  "amount display is not a readOnly input"
);
assert.match(formsCss, /\.ldg-amount-keypad\s*\{/, "keypad sheet CSS exists");
assert.match(formsCss, /z-index:\s*1100/, "keypad stacks above tab bar and action sheets");
assert.match(formsCss, /body\.ldg-amount-keypad-open/, "open keypad reserves bottom space");
assert.match(formsCss, /button\.ldg-amount-display/, "amount display button styles exist");

// ---- 2. Amount formatting helpers still shared ----
assert.match(formatSrc, /export function formatKrwInput/, "formatKrwInput helper exists");
assert.match(formatSrc, /export function parseKrwInput/, "parseKrwInput helper exists");
assert.match(sellModal, /formatKrwInput/, "sell modal formats amount with thousand separators");
assert.match(pendingCard, /formatKrwInput/, "recurring card formats amount with thousand separators");

const compilerOptions = { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 };
const compiledFormat = ts.transpileModule(formatSrc, { compilerOptions }).outputText;
const formatModuleUrl = `data:text/javascript;base64,${Buffer.from(compiledFormat).toString("base64")}`;
const format = await import(formatModuleUrl);
assert.equal(format.formatKrwInput("1234567"), "1,234,567", "formatKrwInput adds thousand separators");
assert.equal(format.parseKrwInput("1,234,567"), 1234567, "parseKrwInput reads formatted strings");

// ---- 3. Card type scale via CSS variables (labels regular, main minimal) ----
assert.match(tokensCss, /--ldg-card-label-weight:\s*400/, "card label weight token is regular");
assert.match(tokensCss, /--ldg-card-main-weight:\s*600/, "card main weight token is 600");
assert.match(tokensCss, /--ldg-card-sub-weight:\s*400/, "card sub weight token is regular");
assert.match(tokensCss, /T28 card type scale/, "card scale documents before/after intent");

const homeMainSelectors = [
  ".ldg-balance-main",
  ".ldg-inout-main",
  ".ldg-net-value",
  ".ldg-sell-sats-primary",
  ".ldg-settlement-done",
];
for (const selector of homeMainSelectors) {
  const escaped = selector.replace(/\./g, "\\.");
  assert.match(
    ledgerCss,
    new RegExp(`${escaped}\\s*\\{[\\s\\S]*?font-weight:\\s*var\\(--ldg-card-main-weight`),
    `${selector} uses the card main weight token`
  );
}
assert.match(
  ledgerCss,
  /\.ldg-label\s*\{[\s\S]*?font-weight:\s*var\(--ldg-card-label-weight/,
  "card labels use the regular label weight token"
);
assert.match(
  ledgerCss,
  /\.ldg-sell-krw-secondary\s*\{[\s\S]*?font-weight:\s*var\(--ldg-card-sub-weight/,
  "sell KRW secondary uses the sub weight token"
);
assert.match(
  ledgerCss,
  /\.ldg-done-val strong\s*\{[\s\S]*?font-weight:\s*var\(--ldg-card-main-weight/,
  "completed sell strong value uses main weight token"
);
// Heavy nonstandard weights must not remain on home card primaries
for (const selector of [".ldg-balance-main", ".ldg-net-value", ".ldg-sell-sats-primary"]) {
  const block = ledgerCss.match(new RegExp(`${selector.replace(/\./g, "\\.")}\\s*\\{[^}]+\\}`))?.[0] ?? "";
  for (const weight of [650, 700, 750, 800, 850]) {
    assert.doesNotMatch(block, new RegExp(`font-weight:\\s*${weight}`), `${selector} must not hardcode ${weight}`);
  }
}

// ---- 4. Recurring: due-date gate (not "current month only") ----
assert.match(recurringSrc, /export function isRecurringDue/, "isRecurringDue helper exists");
assert.match(recurringSrc, /export function listDuePendingRecurringRules/, "listDuePendingRecurringRules exists");
assert.match(recurringSrc, /export function getRecurringDueDate/, "getRecurringDueDate exists");
assert.match(pendingCard, /listDuePendingRecurringRules/, "pending card uses due-aware listing");
assert.match(pendingCard, /getRecurringDueDate|mapRecurringRuleDate/, "pending card keeps due date mapping");
assert.doesNotMatch(pendingCard, /isCurrentSettlementMonth/, "pending card no longer hides all non-current months");
assert.doesNotMatch(
  pendingCard,
  /getSettlementMonthKeyForDate/,
  "pending card no longer gates only on current settlement month"
);
// Sort by due date is applied in the pure helper
assert.match(
  recurringSrc,
  /listDuePendingRecurringRules[\s\S]*\.sort\([\s\S]*dueA\.localeCompare\(dueB\)/,
  "due pending rules are sorted by due date"
);

// Runtime due-date checks
const monthSrc = read("src/lib/month.ts");
const compiledMonth = ts.transpileModule(monthSrc, { compilerOptions }).outputText;
const monthModuleUrl = `data:text/javascript;base64,${Buffer.from(compiledMonth).toString("base64")}`;
const compiledRecurring = ts
  .transpileModule(recurringSrc, { compilerOptions })
  .outputText.replace('"./month"', `"${monthModuleUrl}"`);
const recurringModuleUrl = `data:text/javascript;base64,${Buffer.from(compiledRecurring).toString("base64")}`;

class MemoryStorage {
  #items = new Map();
  getItem(key) {
    return this.#items.has(key) ? this.#items.get(key) : null;
  }
  setItem(key, value) {
    this.#items.set(key, String(value));
  }
}
globalThis.localStorage = new MemoryStorage();
const recurring = await import(recurringModuleUrl);

const julyPeriod = { startDate: "2026-07-01", endDate: "2026-07-31" };
assert.equal(
  recurring.isRecurringDue(julyPeriod, 15, "2026-07-09"),
  false,
  "future due date in the selected month stays hidden"
);
assert.equal(
  recurring.isRecurringDue(julyPeriod, 15, "2026-07-15"),
  true,
  "due date on today becomes visible"
);
assert.equal(
  recurring.isRecurringDue(julyPeriod, 5, "2026-07-09"),
  true,
  "past due date in the selected month stays visible until handled"
);
assert.equal(
  recurring.isRecurringDue({ startDate: "2026-08-01", endDate: "2026-08-31" }, 5, "2026-07-09"),
  false,
  "next-month preview does not show items before their due date"
);

const early = recurring.addRecurringRule({
  title: "보험",
  cat: "housing",
  isIncome: false,
  dayOfMonth: 5,
  lastAmount: 10000,
});
const mid = recurring.addRecurringRule({
  title: "월세",
  cat: "housing",
  isIncome: false,
  dayOfMonth: 12,
  lastAmount: 500000,
});
const future = recurring.addRecurringRule({
  title: "구독",
  cat: "subscription",
  isIncome: false,
  dayOfMonth: 28,
  lastAmount: 9000,
});
// today=7/15 → day 5·12 due, day 28 not yet
const listed = recurring.listDuePendingRecurringRules("2026-07", julyPeriod, "2026-07-15");
assert.deepEqual(
  listed.map((r) => r.id),
  [early.id, mid.id],
  "only due rules are listed and sorted by due day (5 then 12); day 28 stays hidden"
);
assert.ok(!listed.some((r) => r.id === future.id), "not-yet-due rule is excluded");
assert.equal(
  recurring.markRecurringMaterialized(early.id, "2026-07"),
  true,
  "materialized keys still work with the due filter"
);
assert.deepEqual(
  recurring.listDuePendingRecurringRules("2026-07", julyPeriod, "2026-07-15").map((r) => r.id),
  [mid.id],
  "materialized rules drop out without breaking remaining due items"
);

console.log("verify:t28-ui passed");
