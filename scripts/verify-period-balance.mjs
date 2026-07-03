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

assert.equal(typeof sellCalc.isTxnSettled, "function", "isTxnSettled is exported");
assert.equal(
  typeof sellCalc.calculateUnsettledLivingCashflow,
  "function",
  "calculateUnsettledLivingCashflow is exported"
);
assert.equal(typeof sellCalc.calculateTheoreticalBalance, "function", "calculateTheoreticalBalance is exported");

const categoriesById = {
  salary: { id: "salary", label: "Salary", group: "income", flow: "income" },
  rent: { id: "rent", label: "Rent", group: "expense", flow: "expense" },
  card_bill: { id: "card_bill", label: "Card", group: "expense", flow: "expense" },
  btc_buy: { id: "btc_buy", label: "DCA", group: "invest", flow: "expense" },
};

const period = { startDate: "2026-07-01", endDate: "2026-07-31" };
const txns = [
  { id: 1, title: "Paid salary", cat: "salary", catLabel: "Salary", time: "", date: "2026-07-02T09:00", amount: 1_000_000, btcAt: 1, settled: true },
  { id: 2, title: "Paid rent", cat: "rent", catLabel: "Rent", time: "", date: "2026-07-02T10:00", amount: -300_000, btcAt: 1, settled: true },
  { id: 3, title: "Unpaid card", cat: "card_bill", catLabel: "Card", time: "", date: "2026-07-10T10:00", amount: -350_000, btcAt: 1, settled: false },
  { id: 4, title: "Unpaid bill", cat: "card_bill", catLabel: "Card", time: "", date: "2026-07-11T10:00", amount: -600_000, btcAt: 1, settled: false },
  { id: 5, title: "Unpaid loan", cat: "rent", catLabel: "Rent", time: "", date: "2026-07-12T10:00", amount: -1_100_000, btcAt: 1, settled: false },
  { id: 6, title: "Future income", cat: "salary", catLabel: "Salary", time: "", date: "2026-07-15T10:00", amount: 200_000, btcAt: 1, settled: false },
  { id: 7, title: "DCA", cat: "btc_buy", catLabel: "DCA", time: "", date: "2026-07-16T10:00", amount: -999_000, btcAt: 1, settled: false },
];

assert.equal(sellCalc.isTxnSettled({ ...txns[0], settled: false }, "2026-07-20"), false, "explicit settled=false wins");
assert.equal(sellCalc.isTxnSettled({ ...txns[0], settled: true }, "2026-07-20"), true, "explicit settled=true wins");
assert.equal(
  sellCalc.isTxnSettled({ ...txns[0], settled: undefined, date: "2026-07-01T00:00" }, "2026-07-02"),
  true,
  "missing settled falls back to past date"
);

assert.deepEqual(
  sellCalc.calculateUnsettledLivingCashflow(txns, categoriesById, period, "2026-07-03"),
  { incomeKrw: 200_000, expenseKrw: 2_050_000 },
  "unsettled living cashflow excludes settled and invest transactions"
);
assert.equal(
  sellCalc.calculateTheoreticalBalance({
    periodStartBalanceKrw: 500_000,
    txns,
    categoriesById,
    period,
    todayDateKey: "2026-07-03",
  }),
  1_200_000,
  "theoretical balance = period start balance + settled income - settled expense"
);

const result = sellCalc.calculateSellNeeded({
  incomeKrw: 200_000,
  expenseKrw: 2_050_000,
  theoreticalBalanceKrw: 1_200_000,
  btcKrw: 100_000_000,
  heldBtc: 1,
});
assert.equal(result.deficitKrw, 650_000, "requiredKrw = unsettled expense - unsettled income - theoretical balance");
assert.equal(result.sellSats, 650_000, "sell sats use current BTC price");

const negativeBalanceResult = sellCalc.calculateSellNeeded({
  incomeKrw: 0,
  expenseKrw: 100_000,
  theoreticalBalanceKrw: -50_000,
  btcKrw: 100_000_000,
  heldBtc: 1,
});
assert.equal(negativeBalanceResult.deficitKrw, 150_000, "negative theoretical balance increases requiredKrw");

const periodBalancePath = join(root, "src/lib/periodStartBalance.ts");
assert.ok(existsSync(periodBalancePath), "periodStartBalance storage utility exists");
const periodBalanceSrc = readFileSync(periodBalancePath, "utf8");
assert.match(periodBalanceSrc, /myledger\.periodStartBalance\.v1/, "period start balance key is defined");
assert.match(periodBalanceSrc, /myledger\.monthlyCash\.v1/, "legacy monthly cash key is migrated");
assert.match(periodBalanceSrc, /removeItem\(MONTHLY_CASH_KEY\)/, "legacy monthly cash is removed after migration");

const typesSrc = readFileSync(join(root, "src/types.ts"), "utf8");
assert.match(typesSrc, /settled\?: boolean/, "Txn supports optional settled state");

const ledgerContext = readFileSync(join(root, "src/state/LedgerContext.tsx"), "utf8");
assert.match(ledgerContext, /periodStartBalances/, "LedgerContext stores balances by period key");
assert.match(ledgerContext, /setPeriodStartBalance/, "LedgerContext exposes start balance setter");
assert.match(ledgerContext, /setTxnSettled/, "LedgerContext exposes compact settlement toggle");

const homePage = readFileSync(join(root, "src/components/home/HomePage.tsx"), "utf8");
assert.match(homePage, /calculateTheoreticalBalance/, "HomePage calculates theoretical balance");
assert.doesNotMatch(homePage, /getMonthlyCash|monthlyCash/, "HomePage no longer reads monthly cash");
assert.doesNotMatch(homePage, /<InOutCards/, "HomePage removes top income/expense cards");

const sellCard = readFileSync(join(root, "src/components/home/SellNeededCard.tsx"), "utf8");
assert.match(sellCard, /왜 이 금액이죠/, "SellNeededCard has collapsed explanation trigger");
assert.match(sellCard, /aria-expanded/, "SellNeededCard exposes collapsible details state");
assert.match(sellCard, /잔고 미입력/, "SellNeededCard shows missing balance badge");
assert.doesNotMatch(sellCard, /monthlyCash|ldg-home-cash-field/, "SellNeededCard has no always-visible monthly cash input");

const modal = readFileSync(join(root, "src/components/home/SellConfirmModal.tsx"), "utf8");
assert.doesNotMatch(modal, /setMonthlyCash|getMonthlyCash|cashInput|통장 보유액/, "SellConfirmModal removes cash input path");
assert.match(modal, /result\.deficitKrw/, "SellConfirmModal uses the unified required amount");

const txnRow = readFileSync(join(root, "src/components/home/TxnRow.tsx"), "utf8");
assert.match(txnRow, /onSettledChange/, "TxnRow accepts settlement toggle callback");
assert.match(txnRow, /ldg-txn-settle-chip/, "TxnRow uses compact settlement chip");
assert.doesNotMatch(txnRow, /type="checkbox"/, "TxnRow does not render checkbox settlement UI");

const onboarding = readFileSync(join(root, "src/components/onboarding/OnboardingPrompt.tsx"), "utf8");
assert.match(onboarding, /지금 통장에 얼마 있어/, "first-run onboarding asks for current account balance");
assert.doesNotMatch(onboarding, /<ol|다시 보지 않기|자세히 보기/, "old multi-step onboarding is removed");

const backup = readFileSync(join(root, "src/lib/backup.ts"), "utf8");
assert.match(backup, /PERIOD_START_BALANCE_KEY/, "backup includes period start balances");
assert.doesNotMatch(backup, /monthlyCash:\s*MONTHLY_CASH_KEY/, "backup no longer exports monthly cash as an active key");

console.log("verify:period-balance passed");
