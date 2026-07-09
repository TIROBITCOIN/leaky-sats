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

// ---- 1. Custom amount keypad: no click-through to TabBar / settings ----
assert.match(keypad, /createPortal/, "AmountKeypad portals out of the form tree");
assert.match(keypad, /querySelector\("\.app-frame"\)/, "keypad portals into .app-frame to cover the tab bar");
assert.match(keypad, /stopPropagation/, "keypad stops event propagation to NavLinks");
assert.doesNotMatch(
  keypad,
  /onPointerDown=\{\(event\) => \{\s*event\.preventDefault\(\);\s*press/,
  "keypad does not use pointerdown+preventDefault (iOS click-through to settings)"
);
assert.match(keypad, /onClick=\{onKeyClick/, "keypad keys use onClick with stopPropagation");

assert.match(entry, /AmountKeypad/, "transaction entry mounts AmountKeypad");
assert.match(entry, /ldg-amount-field/, "amount uses a dedicated wrapper for click ownership");
assert.match(entry, /readOnly/, "amount input stays readOnly");
assert.match(entry, /inputMode="none"/, "amount input opts out of the system numeric keypad");
assert.match(entry, /onMouseDown=\{[\s\S]*preventDefault/, "amount mousedown blocks focus/keyboard");
assert.match(entry, /stopPropagation/, "amount open path stops propagation");
assert.match(entry, /useState\(true\)/, "amount keypad opens by default on the entry form");
assert.match(formsCss, /\.ldg-amount-keypad-root/, "keypad sheet CSS exists");
assert.match(formsCss, /z-index:\s*1100/, "keypad stacks above tab bar and action sheets");
assert.match(formsCss, /pointer-events:\s*auto/, "keypad root receives pointer events (no fall-through)");
assert.match(formsCss, /body\.ldg-amount-keypad-open \.ldg-tabbar/, "tab bar is inert while keypad is open");
assert.match(formsCss, /\.ldg-amount-field/, "amount field wrapper styles exist");
assert.match(
  formsCss,
  /\.ldg-amount-field \.ldg-amount-display[\s\S]*pointer-events:\s*none/,
  "amount input ignores direct hits; wrapper owns the click"
);

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

// ---- 3. Card type scale via CSS variables ----
assert.match(tokensCss, /--ldg-card-label-weight:\s*400/, "card label weight token is regular");
assert.match(tokensCss, /--ldg-card-main-weight:\s*600/, "card main weight token is 600");
assert.match(tokensCss, /--ldg-card-sub-weight:\s*400/, "card sub weight token is regular");
const homeMainSelectors = [".ldg-balance-main", ".ldg-inout-main", ".ldg-net-value", ".ldg-sell-sats-primary"];
for (const selector of homeMainSelectors) {
  const escaped = selector.replace(/\./g, "\\.");
  assert.match(
    ledgerCss,
    new RegExp(`${escaped}\\s*\\{[\\s\\S]*?font-weight:\\s*var\\(--ldg-card-main-weight`),
    `${selector} uses the card main weight token`
  );
}

// ---- 4. Recurring due-date gate ----
assert.match(recurringSrc, /export function isRecurringDue/, "isRecurringDue helper exists");
assert.match(recurringSrc, /export function listDuePendingRecurringRules/, "listDuePendingRecurringRules exists");
assert.match(pendingCard, /listDuePendingRecurringRules/, "pending card uses due-aware listing");
assert.doesNotMatch(pendingCard, /isCurrentSettlementMonth/, "pending card no longer hides all non-current months");

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
assert.equal(recurring.isRecurringDue(julyPeriod, 15, "2026-07-09"), false, "future due stays hidden");
assert.equal(recurring.isRecurringDue(julyPeriod, 15, "2026-07-15"), true, "due on today is visible");

console.log("verify:t28-ui passed");
