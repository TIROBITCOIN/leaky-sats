import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import ts from "typescript";

const root = process.cwd();
const read = (file) => readFileSync(join(root, file), "utf8");
const compilerOptions = { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 };
const moduleUrl = (source) =>
  `data:text/javascript;base64,${Buffer.from(ts.transpileModule(source, { compilerOptions }).outputText).toString("base64")}`;

const monthUrl = moduleUrl(read("src/lib/month.ts"));
const sellCalcSrc = read("src/lib/sellCalculator.ts");
const sellCalc = await import(moduleUrl(sellCalcSrc.replace('"./month"', `"${monthUrl}"`)));

const categoriesById = {
  salary: { id: "salary", label: "Salary", group: "income", flow: "income", icon: "wallet", fg: "#16a34a" },
  rent: { id: "rent", label: "Rent", group: "expense", flow: "expense", icon: "home", fg: "#ef4444" },
  card: { id: "card", label: "Card", group: "expense", flow: "expense", icon: "card", fg: "#f97316" },
  btc_buy: { id: "btc_buy", label: "BTC Buy", group: "invest", flow: "expense", icon: "bitcoin", fg: "#f7931a" },
};

const period = { startDate: "2026-07-01", endDate: "2026-07-31" };
const txns = [
  { id: 1, title: "Income", cat: "salary", catLabel: "Salary", time: "", date: "2026-07-01T09:00", amount: 6_276_123, btcAt: 1 },
  { id: 2, title: "Old expense", cat: "rent", catLabel: "Rent", time: "", date: "2026-07-02T09:00", amount: -3_000_000, btcAt: 1 },
  { id: 3, title: "Future expense", cat: "card", catLabel: "Card", time: "", date: "2026-07-29T09:00", amount: -5_100_976, btcAt: 1 },
  { id: 4, title: "Invest", cat: "btc_buy", catLabel: "BTC Buy", time: "", date: "2026-07-30T09:00", amount: -999_999, btcAt: 1 },
];

const totals = sellCalc.calculateMonthlyLivingCashflow(txns, categoriesById, period);
assert.deepEqual(totals, { incomeKrw: 6_276_123, expenseKrw: 8_100_976 }, "period totals include all period living txns and exclude invest");

const result = sellCalc.calculateSellNeeded({
  incomeKrw: totals.incomeKrw,
  expenseKrw: totals.expenseKrw,
  btcKrw: 100_000_000,
  heldBtc: 1,
});
assert.equal(result.netKrw, -1_824_853, "netKrw = period income - period expense");
assert.equal(result.deficitKrw, 1_824_853, "sell needed KRW is full-period deficit");
assert.equal(result.sellSats, 1_824_853, "sats are rounded from sellNeededKrw / btcKrw");

const surplus = sellCalc.calculateSellNeeded({ incomeKrw: 10_000, expenseKrw: 9_999, btcKrw: 100_000_000, heldBtc: 1 });
assert.equal(surplus.deficitKrw, 0, "surplus periods require no sale");
assert.equal(surplus.sellSats, 0, "surplus periods require zero sats");

assert.doesNotMatch(
  sellCalcSrc,
  /calculateRemainingLivingCashflow|calculateUnsettledLivingCashflow|calculateTheoreticalBalance|isTxnSettled|theoreticalBalanceKrw|applyAccountBalance/,
  "sellCalculator has no date-filter, settled, or account-balance sale path",
);
assert.match(sellCalcSrc, /Math\.max\(0,\s*expenseKrw\s*-\s*incomeKrw\)/, "sellNeededKrw uses period expense minus income");

const homePage = read("src/components/home/HomePage.tsx");
assert.match(homePage, /calculateMonthlyLivingCashflow\(/, "HomePage uses full-period living totals");
assert.doesNotMatch(homePage, /OnboardingPrompt|periodStartBalance|periodStartBalances|calculateUnsettledLivingCashflow|monthlyCash|setPeriodActualBalance/, "HomePage has no balance prompt or unsettled sale path");

const typesSrc = read("src/types.ts");
assert.doesNotMatch(typesSrc, /settled\?:\s*boolean/, "transaction types no longer expose settled");

const modal = read("src/components/home/SellConfirmModal.tsx");
assert.match(modal, /carryoverBalanceKrw/, "modal keeps carryover balance as KRW input");
assert.match(modal, /premiumPct/, "modal keeps P2P premium input");
assert.match(modal, /networkFeeSats/, "modal keeps network fee sats input");
assert.match(modal, /finalSats/, "modal calculates final sats");
assert.match(modal, /tradeSats/, "modal calculates trade sats before fee");
assert.match(modal, /fetchRecommendedNetworkFeeSats/, "modal loads mempool fee default on open");
assert.match(modal, /UTXO/, "modal warns that UTXO count can affect fees");
assert.doesNotMatch(modal, /exchange|거래소|sellUnit|handleUnitToggle|1-input 1-output|monthlyCash|통장 보유액/, "modal has no exchange toggle, old unit toggle, or monthly cash path");

const sellCard = read("src/components/home/SellNeededCard.tsx");
assert.doesNotMatch(sellCard, /unsettledIncomeKrw|unsettledExpenseKrw|theoreticalBalanceKrw|actualBalance|왜 이 금액|ldg-actual-balance-field/, "home sell card has no T20 details or balance input");

assert.equal(existsSync(join(root, "api/mempool-fees.ts")), true, "mempool fee proxy exists");
const mempoolProxy = read("api/mempool-fees.ts");
assert.match(mempoolProxy, /https:\/\/mempool\.space\/api\/v1\/fees\/recommended/, "mempool proxy fetches recommended fees");
assert.match(mempoolProxy, /fastestFee/, "mempool proxy uses fastestFee");
assert.match(mempoolProxy, /140/, "mempool fee estimate uses 140 vB");
assert.match(mempoolProxy, /feeSats/, "mempool proxy returns feeSats");

assert.equal(existsSync(join(root, "src/lib/networkFees.ts")), true, "network fee client exists");
const networkFees = read("src/lib/networkFees.ts");
assert.match(networkFees, /DEFAULT_NETWORK_FEE_SATS\s*=\s*500/, "network fee fallback is 500 sats");
assert.match(networkFees, /fetch\("\/api\/mempool-fees"\)/, "network fee client calls same-origin proxy");

const preferences = read("src/lib/preferences.ts");
assert.match(preferences, /DEFAULT_REFRESH_INTERVAL_MS\s*=\s*1_000/, "default price refresh interval is one second");
assert.match(preferences, /MIN_REFRESH_INTERVAL_MS\s*=\s*1_000/, "minimum price refresh interval is one second");
assert.doesNotMatch(preferences, /30_000|60_000|300_000|ALLOWED_REFRESH_INTERVALS/, "old interval whitelist is removed");

const settings = read("src/components/settings/SettingsPage.tsx");
assert.doesNotMatch(settings, /30_000|60_000|300_000|INTERVALS|새로고침 주기|30초|1분|5분/, "settings no longer exposes price interval choices");

const upbitProxy = read("api/upbit.ts");
assert.match(upbitProxy, /inFlight/, "Upbit proxy dedupes concurrent requests");
assert.match(upbitProxy, /CACHE_TTL_MS\s*=\s*1_000/, "Upbit proxy cache TTL supports one second polling");

const backup = read("src/lib/backup.ts");
assert.doesNotMatch(backup, /MONTHLY_CASH_KEY|PERIOD_START_BALANCE_KEY|monthlyCash|periodStartBalance/, "backup ignores legacy monthly cash and period balance data");

console.log("verify:final-sell-flow passed");
