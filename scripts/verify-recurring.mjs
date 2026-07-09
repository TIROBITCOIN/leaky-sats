import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import ts from "typescript";

const source = readFileSync("src/lib/recurringRules.ts", "utf8");
const monthSource = readFileSync("src/lib/month.ts", "utf8");
const entry = readFileSync("src/components/transaction/TransactionEntryPage.tsx", "utf8");
const pendingCard = readFileSync("src/components/home/RecurringPendingCard.tsx", "utf8");
const settings = readFileSync("src/components/settings/RecurringRulesSettings.tsx", "utf8");
assert.match(source, /myledger\.recurringRules\.v1/, "recurring rules use a versioned key");
assert.match(source, /myledger\.recurringMaterialized\.v1/, "materialized months use a versioned key");
assert.match(source, /try\s*\{[\s\S]*localStorage\.getItem/, "loads guard storage access");
assert.match(source, /catch\s*\{/, "invalid storage falls back safely");
assert.match(entry, /markRecurringMaterialized/, "the transaction that creates a rule marks its settlement month");
assert.match(
  entry,
  /getRecurringRuleById\(editingTxn\.recurringRuleId\)[\s\S]*findRecurringRule\([\s\S]*normalizeRecurringDay/,
  "transaction edit finds a recurring rule by stored id before falling back to stored transaction fields"
);
assert.match(entry, /recurringRuleId:\s*rule\.id|recurringRuleId\s*=\s*rule\.id/, "created recurring transactions keep the rule id");
assert.match(pendingCard, /recurringRuleId:\s*rule\.id/, "pending recurring confirmations store the rule id on the created transaction");
assert.match(source, /export function getRecurringRuleById/, "recurring rules can be looked up by id");
assert.match(
  entry,
  /useState\(\(\) => matchingRecurringRule !== null\)/,
  "matching recurring transactions initialize the checkbox as checked"
);
assert.match(
  entry,
  /matchingRecurringRule\s*\?\s*updateRecurringRule\(matchingRecurringRule\.id, ruleInput\)[\s\S]*addRecurringRule\(ruleInput\)/,
  "transaction edit updates a matched rule by id and only creates when no rule matches"
);
assert.match(
  entry,
  /if \(editingTxn\)[\s\S]*if \(createRecurring\)[\s\S]*markRecurringMaterialized/,
  "transaction edit updates the transaction and materializes its recurring rule"
);
assert.doesNotMatch(
  entry.match(/if \(editingTxn\)[\s\S]*?navigate\(-1\);/)?.[0] ?? "",
  /deleteRecurringRule/,
  "unchecking during transaction edit does not delete the existing recurring rule"
);
assert.match(entry, /체크를 꺼도 기존 반복 규칙은 유지됩니다/, "edit copy explains that unchecking preserves the rule");
assert.match(
  entry,
  /반복 항목 삭제는 설정 &gt; 반복 항목 관리에서 할 수 있습니다/,
  "edit copy directs recurring deletion to settings"
);
assert.match(
  entry,
  /반복 예정 항목으로 등록/,
  "transaction entry describes recurring rules as scheduled items"
);
assert.match(
  entry,
  /다음 달부터는 금액을 확인한 뒤 거래로 추가합니다/,
  "transaction entry explains that future amounts require confirmation"
);
assert.match(pendingCard, /이번 달 금액/, "pending rules provide a monthly amount input");
assert.match(pendingCard, /최근 입력 금액/, "lastAmount is described as the most recent entered amount");
assert.match(
  pendingCard,
  /if \(!markRecurringMaterialized\(rule\.id, selectedMonth\)\)/,
  "confirmation claims the rule and month before creating a transaction"
);
assert.ok(
  pendingCard.indexOf("markRecurringMaterialized(rule.id, selectedMonth)") <
    pendingCard.indexOf("addTxn({"),
  "materialization is recorded before transaction creation to block duplicate clicks"
);
assert.match(
  pendingCard,
  /updateRecurringRule\(rule\.id, \{ lastAmount: amount \}\)/,
  "confirmed amount becomes the next suggested amount"
);
assert.match(
  pendingCard,
  /const handleSkip[\s\S]*markRecurringMaterialized\(ruleId, selectedMonth\)[\s\S]*};/,
  "skip records the month as handled"
);
assert.doesNotMatch(
  pendingCard.match(/const handleSkip[\s\S]*?};/)?.[0] ?? "",
  /addTxn|updateRecurringRule/,
  "skip does not create a transaction or change lastAmount"
);
assert.match(settings, /다음 입력 때 기본 제안/, "settings describe lastAmount as a suggestion");

const compilerOptions = { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 };
const compiledMonth = ts.transpileModule(monthSource, {
  compilerOptions,
}).outputText;
const monthModuleUrl = `data:text/javascript;base64,${Buffer.from(compiledMonth).toString("base64")}`;
const compiled = ts.transpileModule(source, {
  compilerOptions,
}).outputText.replace('"./month"', `"${monthModuleUrl}"`);
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
assert.equal(recurring.normalizeRecurringDay(31), 31, "the 31st is supported");
assert.equal(recurring.normalizeRecurringDay(32), 31, "days above range clamp to 31");
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
assert.equal(rule.dayOfMonth, 31, "stored rule supports the 31st");
assert.equal(recurring.listRecurringRules().length, 1, "valid rule persists");
assert.equal(
  recurring.findRecurringRule({
    title: "월세",
    cat: "housing",
    isIncome: false,
    dayOfMonth: recurring.normalizeRecurringDay(31),
  })?.id,
  rule.id,
  "a transaction with matching title, category, flow, and normalized day finds its recurring rule"
);
assert.equal(
  recurring.findRecurringRule({
    title: "관리비",
    cat: "housing",
    isIncome: false,
    dayOfMonth: 31,
  }),
  null,
  "a non-recurring transaction does not match a different recurring rule"
);
recurring.updateRecurringRule(rule.id, { lastAmount: 980000 });
assert.equal(
  recurring.listRecurringRules()[0].lastAmount,
  980000,
  "the confirmed amount becomes the rule's next suggestion"
);

const editedRule = recurring.upsertRecurringRule(
  {
    title: "월세",
    cat: "housing",
    isIncome: false,
    dayOfMonth: 31,
  },
  {
    title: "주거비",
    cat: "housing",
    isIncome: false,
    dayOfMonth: 30,
    lastAmount: 990000,
  }
);
assert.equal(editedRule.id, rule.id, "editing a matching transaction updates its recurring rule");
assert.equal(recurring.listRecurringRules().length, 1, "editing does not duplicate a matching recurring rule");
assert.equal(editedRule.title, "주거비", "edited title is saved to the recurring rule");
assert.equal(editedRule.dayOfMonth, 30, "edited day is saved to the recurring rule");
const editedAgain = recurring.upsertRecurringRule(
  {
    title: "주거비",
    cat: "housing",
    isIncome: false,
    dayOfMonth: 30,
  },
  {
    title: "주거비",
    cat: "housing",
    isIncome: false,
    dayOfMonth: 30,
    lastAmount: 1200000,
  }
);
assert.equal(editedAgain.id, rule.id, "repeated edits keep updating the same recurring rule");
assert.equal(recurring.listRecurringRules().length, 1, "repeated edits do not create duplicate recurring rules");
assert.equal(
  recurring.listRecurringRules()[0].lastAmount,
  1200000,
  "editing a matched recurring transaction updates lastAmount"
);

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
assert.equal(
  recurring.mapRecurringRuleDate({ startDate: "2026-01-31", endDate: "2026-02-27" }, 31),
  "2026-01-31",
  "31st rule uses January 31 when it is inside the settlement period"
);
assert.equal(
  recurring.mapRecurringRuleDate({ startDate: "2026-02-28", endDate: "2026-03-30" }, 31),
  "2026-02-28",
  "31st rule falls back to February 28 in a common year"
);
assert.equal(
  recurring.mapRecurringRuleDate({ startDate: "2028-02-29", endDate: "2028-03-30" }, 31),
  "2028-02-29",
  "31st rule falls back to February 29 in a leap year"
);
assert.equal(
  recurring.mapRecurringRuleDate({ startDate: "2026-02-28", endDate: "2026-03-29" }, 30),
  "2026-02-28",
  "30th rule falls back to February month end"
);
assert.equal(
  recurring.mapRecurringRuleDate({ startDate: "2026-02-28", endDate: "2026-03-28" }, 29),
  "2026-02-28",
  "29th rule falls back to February 28 in a common year"
);
assert.equal(
  recurring.mapRecurringRuleDate({ startDate: "2028-02-29", endDate: "2028-03-28" }, 29),
  "2028-02-29",
  "29th rule uses February 29 in a leap year"
);

assert.equal(
  recurring.getRecurringDueDate({ startDate: "2026-07-01", endDate: "2026-07-31" }, 12),
  "2026-07-12",
  "getRecurringDueDate mirrors mapRecurringRuleDate for calendar months"
);
assert.equal(
  recurring.isRecurringDue({ startDate: "2026-07-01", endDate: "2026-07-31" }, 20, "2026-07-10"),
  false,
  "isRecurringDue hides rules before their due date"
);
assert.equal(
  recurring.isRecurringDue({ startDate: "2026-07-01", endDate: "2026-07-31" }, 20, "2026-07-20"),
  true,
  "isRecurringDue shows rules on or after their due date"
);
assert.equal(
  recurring.isRecurringDue({ startDate: "2026-08-01", endDate: "2026-08-31" }, 1, "2026-07-15"),
  false,
  "isRecurringDue hides next-month items when previewing early"
);

const dueRule = recurring.addRecurringRule({
  title: "구독료",
  cat: "subscription",
  isIncome: false,
  dayOfMonth: 3,
  lastAmount: 12000,
});
const laterRule = recurring.addRecurringRule({
  title: "관리비",
  cat: "housing",
  isIncome: false,
  dayOfMonth: 10,
  lastAmount: 80000,
});
const dueList = recurring.listDuePendingRecurringRules(
  "2026-07",
  { startDate: "2026-07-01", endDate: "2026-07-31" },
  "2026-07-05"
);
assert.deepEqual(
  dueList.map((item) => item.id),
  [dueRule.id],
  "listDuePendingRecurringRules returns only due, non-materialized rules in date order"
);
assert.ok(
  !dueList.some((item) => item.id === laterRule.id),
  "not-yet-due rules stay out of the pending list"
);

console.log("verify:recurring passed");
