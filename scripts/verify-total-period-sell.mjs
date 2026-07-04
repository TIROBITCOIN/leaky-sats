import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import ts from "typescript";

const root = process.cwd();
const compilerOptions = { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 };
const moduleUrl = (source) =>
  `data:text/javascript;base64,${Buffer.from(ts.transpileModule(source, { compilerOptions }).outputText).toString("base64")}`;

const monthUrl = moduleUrl(readFileSync(join(root, "src/lib/month.ts"), "utf8"));
const sellCalcSrc = readFileSync(join(root, "src/lib/sellCalculator.ts"), "utf8");
const sellCalc = await import(moduleUrl(sellCalcSrc.replace('"./month"', `"${monthUrl}"`)));

const categoriesById = {
  salary: { id: "salary", label: "Salary", group: "income", flow: "income" },
  living: { id: "living", label: "Living", group: "expense", flow: "expense" },
  btc_buy: { id: "btc_buy", label: "DCA", group: "invest", flow: "expense" },
};

const period = { startDate: "2026-07-01", endDate: "2026-07-31" };
const txns = [
  { id: 1, title: "Income", cat: "salary", catLabel: "Salary", time: "", date: "2026-07-01T09:00", amount: 6_276_123, btcAt: 1 },
  { id: 2, title: "Expense", cat: "living", catLabel: "Living", time: "", date: "2026-07-02T09:00", amount: -8_100_976, btcAt: 1 },
  { id: 3, title: "DCA", cat: "btc_buy", catLabel: "DCA", time: "", date: "2026-07-03T09:00", amount: -999_999, btcAt: 1 },
];

assert.equal(typeof sellCalc.calculateMonthlyLivingCashflow, "function", "period cashflow helper exists");
assert.deepEqual(
  sellCalc.calculateMonthlyLivingCashflow(txns, categoriesById, period),
  { incomeKrw: 6_276_123, expenseKrw: 8_100_976 },
  "period cashflow uses full settlement-period income/expense and excludes invest"
);

const deficit = sellCalc.calculateSellNeeded({
  incomeKrw: 6_276_123,
  expenseKrw: 8_100_976,
  btcKrw: 100_000_000,
  heldBtc: 1,
});
assert.equal(deficit.netKrw, -1_824_853, "netKrw = period income - period expense");
assert.equal(deficit.deficitKrw, 1_824_853, "sell-needed KRW = max(0, period expense - period income)");
assert.equal(deficit.sellSats, 1_824_853, "sell sats use current BTC/KRW");

const surplus = sellCalc.calculateSellNeeded({
  incomeKrw: 8_100_976,
  expenseKrw: 6_276_123,
  btcKrw: 100_000_000,
  heldBtc: 1,
});
assert.equal(surplus.deficitKrw, 0, "surplus periods need no sell");
assert.equal(surplus.sellBtc, 0, "surplus periods sell 0 BTC");
assert.equal(surplus.sellSats, 0, "surplus periods sell 0 sats");

assert.doesNotMatch(sellCalcSrc, /theoreticalBalanceKrw|calculateTheoreticalBalance|calculateUnsettledLivingCashflow|isTxnSettled/, "sellCalculator has no balance or settled calculation path");

const homePage = readFileSync(join(root, "src/components/home/HomePage.tsx"), "utf8");
assert.match(homePage, /calculateMonthlyLivingCashflow/, "HomePage uses full period cashflow");
assert.match(homePage, /<InOutCards/, "HomePage keeps the income/expense/net cards");
assert.doesNotMatch(homePage, /calculateRemainingLivingCashflow|calculateUnsettledLivingCashflow|periodStartBalance|monthlyCash|OnboardingPrompt/, "HomePage has no remaining-date, period-balance, onboarding, or monthly cash path");

const sellCard = readFileSync(join(root, "src/components/home/SellNeededCard.tsx"), "utf8");
assert.match(sellCard, /판매해야 하는 비트코인/, "SellNeededCard keeps the existing card label");
assert.doesNotMatch(sellCard, /monthlyCash|periodStartBalance|왜 이 금액이죠|ldg-actual-balance-field/, "SellNeededCard has no balance input or T20 collapsed-details UI");

const modal = readFileSync(join(root, "src/components/home/SellConfirmModal.tsx"), "utf8");
assert.doesNotMatch(modal, /monthlyCash|setMonthlyCash|getMonthlyCash|cashInput|통장 보유액|periodStartBalance/, "SellConfirmModal has no account-balance input path");
assert.match(modal, /result\.deficitKrw/, "SellConfirmModal saves the unified sell-needed amount");

const typesSrc = readFileSync(join(root, "src/types.ts"), "utf8");
assert.doesNotMatch(typesSrc, /settled\?: boolean/, "Txn has no settled field");

const srcFiles = [
  "src/state/LedgerContext.tsx",
  "src/components/home/TxnRow.tsx",
  "src/components/home/TxnsCard.tsx",
  "src/components/transaction/TxnListPage.tsx",
  "src/components/transaction/SwipeableRow.tsx",
  "src/styles/ledger.css",
];
for (const file of srcFiles) {
  const text = readFileSync(join(root, file), "utf8");
  assert.doesNotMatch(text, /setTxnSettled|isTxnSettled|settled|ldg-txn-settle-chip/, `${file} has no settled toggle path`);
}

assert.ok(!existsSync(join(root, "src/lib/monthlyCash.ts")), "monthly cash storage utility is removed");
assert.ok(!existsSync(join(root, "src/lib/periodStartBalance.ts")), "period start balance storage utility is removed");

const backup = readFileSync(join(root, "src/lib/backup.ts"), "utf8");
assert.doesNotMatch(backup, /MONTHLY_CASH_KEY|PERIOD_START_BALANCE_KEY|monthlyCash|periodStartBalance/, "backup ignores legacy monthly cash data");

console.log("verify:total-period-sell passed");
