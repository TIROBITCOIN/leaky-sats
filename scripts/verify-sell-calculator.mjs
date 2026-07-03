import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import ts from "typescript";

const root = process.cwd();

// 1. held BTC localStorage key exists in utility
const heldBtcPath = "src/lib/heldBtc.ts";
assert.ok(existsSync(heldBtcPath), "heldBtc.ts exists");
const heldBtcSrc = readFileSync(heldBtcPath, "utf8");
assert.match(heldBtcSrc, /myledger\.heldBtc\.v1/, "held BTC localStorage key defined");

// 2. sell calculator utility exists
const sellCalcPath = "src/lib/sellCalculator.ts";
assert.ok(existsSync(sellCalcPath), "sellCalculator.ts exists");
const sellCalcSrc = readFileSync(sellCalcPath, "utf8");
assert.match(sellCalcSrc, /calculateMonthlyLivingCashflow/, "calculateMonthlyLivingCashflow exists");
assert.match(sellCalcSrc, /calculateRemainingLivingCashflow/, "calculateRemainingLivingCashflow exists");
assert.match(sellCalcSrc, /calculateSellNeeded/, "calculateSellNeeded exists");

// DCA / BTC 留ㅼ닔??嫄곕옒 ?먯껜??吏異쒖씠吏留??앺솢鍮?遺議?怨꾩궛?먯꽌???쒖쇅?쒕떎.
const monthSrc = readFileSync("src/lib/month.ts", "utf8");
const compilerOptions = { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 };
const compiledMonth = ts.transpileModule(monthSrc, { compilerOptions }).outputText;
const monthModuleUrl = `data:text/javascript;base64,${Buffer.from(compiledMonth).toString("base64")}`;
const compiledSellCalculator = ts
  .transpileModule(sellCalcSrc, { compilerOptions })
  .outputText.replace('"./month"', `"${monthModuleUrl}"`);
const sellCalculatorModuleUrl = `data:text/javascript;base64,${Buffer.from(compiledSellCalculator).toString("base64")}`;
const sellCalculator = await import(sellCalculatorModuleUrl);
assert.equal(typeof sellCalculator.applyAccountBalance, "function", "applyAccountBalance is exported");

const surplusSellNeeded = sellCalculator.calculateSellNeeded({
  incomeKrw: 3_000_000,
  expenseKrw: 2_000_000,
  btcKrw: 150_000_000,
  heldBtc: 0.5,
});
assert.equal(surplusSellNeeded.totalDeficitKrw, 0, "surplus months have no original deficit");
assert.equal(surplusSellNeeded.deficitKrw, 0, "surplus months need no sale");

const settledSellNeeded = sellCalculator.calculateSellNeeded({
  incomeKrw: 2_000_000,
  expenseKrw: 3_000_000,
  btcKrw: 150_000_000,
  heldBtc: 0.5,
  confirmedCoverageKrw: 1_000_000,
});
assert.equal(settledSellNeeded.totalDeficitKrw, 1_000_000, "settled months preserve the original deficit");
assert.equal(settledSellNeeded.deficitKrw, 0, "full confirmed coverage clears the remaining deficit");

const partialSellNeeded = sellCalculator.calculateSellNeeded({
  incomeKrw: 2_000_000,
  expenseKrw: 3_000_000,
  btcKrw: 150_000_000,
  heldBtc: 0.5,
  confirmedCoverageKrw: 400_000,
});
assert.equal(partialSellNeeded.totalDeficitKrw, 1_000_000, "partial coverage preserves the original deficit");
assert.equal(partialSellNeeded.deficitKrw, 600_000, "partial confirmed coverage leaves a sale deficit");

const adjustedPartial = sellCalculator.applyAccountBalance(2_000_000, 500_000, 150_000_000);
assert.equal(adjustedPartial.accountBalanceKrw, 500_000, "account balance is preserved when valid");
assert.equal(adjustedPartial.requiredKrw, 2_000_000, "required KRW is preserved when valid");
assert.equal(adjustedPartial.sellKrw, 1_500_000, "balance reduces required sell KRW");
assert.equal(adjustedPartial.fullyCovered, false, "partial balance still requires a sale");
assert.equal(adjustedPartial.sellSats, Math.round((1_500_000 / 150_000_000) * 100_000_000), "balance-adjusted sats are rounded");

const adjustedLowerBalance = sellCalculator.applyAccountBalance(2_000_000, 200_000, 150_000_000);
assert.equal(adjustedLowerBalance.sellKrw, 1_800_000, "lower current balance increases sell KRW");

const adjustedCovered = sellCalculator.applyAccountBalance(2_000_000, 2_500_000, 150_000_000);
assert.equal(adjustedCovered.sellKrw, 0, "sufficient account balance removes sell KRW");
assert.equal(adjustedCovered.sellBtc, 0, "sufficient account balance removes sell BTC");
assert.equal(adjustedCovered.sellSats, 0, "sufficient account balance removes sell sats");
assert.equal(adjustedCovered.fullyCovered, true, "sufficient account balance is marked fully covered");

const adjustedNoBalance = sellCalculator.applyAccountBalance(2_000_000, 0, 150_000_000);
assert.equal(adjustedNoBalance.sellKrw, 2_000_000, "zero account balance keeps full required KRW");

const adjustedNegativeBalance = sellCalculator.applyAccountBalance(2_000_000, -100_000, 150_000_000);
assert.equal(adjustedNegativeBalance.accountBalanceKrw, 0, "negative account balance is clamped to zero");
assert.equal(adjustedNegativeBalance.sellKrw, 2_000_000, "negative account balance keeps full required KRW");

const adjustedNanBalance = sellCalculator.applyAccountBalance(2_000_000, NaN, 150_000_000);
assert.equal(adjustedNanBalance.accountBalanceKrw, 0, "NaN account balance is clamped to zero");
assert.equal(adjustedNanBalance.sellKrw, 2_000_000, "NaN account balance keeps full required KRW");

const adjustedZeroRate = sellCalculator.applyAccountBalance(2_000_000, 500_000, 0);
assert.equal(adjustedZeroRate.sellKrw, 1_500_000, "zero BTC rate still reports balance-adjusted KRW");
assert.equal(adjustedZeroRate.sellBtc, 0, "zero BTC rate produces zero BTC");
assert.equal(adjustedZeroRate.sellSats, 0, "zero BTC rate produces zero sats");
for (const [key, value] of Object.entries(adjustedZeroRate)) {
  if (typeof value === "number") assert.ok(Number.isFinite(value), `${key} is finite`);
}

const monthlyCashPath = "src/lib/monthlyCash.ts";
assert.ok(existsSync(monthlyCashPath), "monthlyCash.ts exists");
const monthlyCashSrc = readFileSync(monthlyCashPath, "utf8");
assert.match(monthlyCashSrc, /myledger\.monthlyCash\.v1/, "monthly cash localStorage key defined");
assert.match(monthlyCashSrc, /getMonthlyCash/, "getMonthlyCash is exported");
assert.match(monthlyCashSrc, /setMonthlyCash/, "setMonthlyCash is exported");

class MemoryStorage {
  #items = new Map();
  getItem(key) {
    return this.#items.has(key) ? this.#items.get(key) : null;
  }
  setItem(key, value) {
    this.#items.set(key, String(value));
  }
  removeItem(key) {
    this.#items.delete(key);
  }
}

globalThis.localStorage = new MemoryStorage();
const monthlyCash = await import(
  `data:text/javascript;base64,${Buffer.from(ts.transpileModule(monthlyCashSrc, { compilerOptions }).outputText).toString("base64")}`
);
monthlyCash.setMonthlyCash("2026-06", 500_000);
assert.equal(monthlyCash.getMonthlyCash("2026-06"), 500_000, "monthly cash round-trips by month");
monthlyCash.setMonthlyCash("2026-06", 0);
assert.equal(monthlyCash.getMonthlyCash("2026-06"), 0, "setting monthly cash to zero deletes the month value");
monthlyCash.setMonthlyCash("2026-07", 123_000);
monthlyCash.setMonthlyCash("2026-07", -1);
assert.equal(monthlyCash.getMonthlyCash("2026-07"), 123_000, "negative monthly cash values are rejected");
monthlyCash.setMonthlyCash("2026-07", NaN);
assert.equal(monthlyCash.getMonthlyCash("2026-07"), 123_000, "NaN monthly cash values are rejected");

const livingCashflow = sellCalculator.calculateMonthlyLivingCashflow(
  [
    {
      id: 1,
      title: "Living expense",
      cat: "card_bill",
      catLabel: "Card bill",
      time: "",
      date: "2026-06-10T00:00",
      amount: -300_000,
      btcAt: 100_000_000,
    },
    {
      id: 2,
      title: "DCA / BTC buy",
      cat: "btc_buy",
      catLabel: "DCA / BTC buy",
      time: "",
      date: "2026-06-11T00:00",
      amount: -100_000,
      btcAt: 100_000_000,
    },
  ],
  {
    card_bill: { id: "card_bill", label: "Card bill", group: "expense", flow: "expense" },
    btc_buy: { id: "btc_buy", label: "DCA / BTC buy", group: "invest", flow: "expense" },
  },
  { startDate: "2026-06-01", endDate: "2026-06-30" }
);
assert.deepEqual(
  livingCashflow,
  { incomeKrw: 0, expenseKrw: 300_000 },
  "DCA / BTC 留ㅼ닔 is excluded from living expense and sell-needed inputs"
);

const remainingCashflow = sellCalculator.calculateRemainingLivingCashflow(
  [
    {
      id: 1,
      title: "Past salary",
      cat: "salary",
      catLabel: "Salary",
      time: "",
      date: "2026-07-02T09:00",
      amount: 2_000_000,
      btcAt: 100_000_000,
    },
    {
      id: 2,
      title: "Past rent",
      cat: "rent",
      catLabel: "Rent",
      time: "",
      date: "2026-07-02T10:00",
      amount: -900_000,
      btcAt: 100_000_000,
    },
    {
      id: 3,
      title: "Today card bill",
      cat: "card_bill",
      catLabel: "Card bill",
      time: "",
      date: "2026-07-03T12:00",
      amount: -500_000,
      btcAt: 100_000_000,
    },
    {
      id: 4,
      title: "Future bonus",
      cat: "salary",
      catLabel: "Salary",
      time: "",
      date: "2026-07-04T12:00",
      amount: 300_000,
      btcAt: 100_000_000,
    },
    {
      id: 5,
      title: "Future living expense",
      cat: "card_bill",
      catLabel: "Card bill",
      time: "",
      date: "2026-07-05T12:00",
      amount: -700_000,
      btcAt: 100_000_000,
    },
    {
      id: 6,
      title: "Future DCA",
      cat: "btc_buy",
      catLabel: "DCA / BTC buy",
      time: "",
      date: "2026-07-05T13:00",
      amount: -200_000,
      btcAt: 100_000_000,
    },
    {
      id: 7,
      title: "After period expense",
      cat: "card_bill",
      catLabel: "Card bill",
      time: "",
      date: "2026-08-01T12:00",
      amount: -1_000_000,
      btcAt: 100_000_000,
    },
  ],
  {
    salary: { id: "salary", label: "Salary", group: "income", flow: "income" },
    rent: { id: "rent", label: "Rent", group: "expense", flow: "expense" },
    card_bill: { id: "card_bill", label: "Card bill", group: "expense", flow: "expense" },
    btc_buy: { id: "btc_buy", label: "DCA / BTC buy", group: "invest", flow: "expense" },
  },
  { startDate: "2026-07-01", endDate: "2026-07-31" },
  "2026-07-03"
);
assert.deepEqual(
  remainingCashflow,
  { incomeKrw: 300_000, expenseKrw: 1_200_000 },
  "remaining sell-needed inputs include today and future living cashflow only"
);

const remainingSellNeeded = sellCalculator.calculateSellNeeded({
  incomeKrw: remainingCashflow.incomeKrw,
  expenseKrw: remainingCashflow.expenseKrw,
  btcKrw: 150_000_000,
  heldBtc: 0.5,
  confirmedCoverageKrw: 400_000,
});
assert.equal(
  remainingSellNeeded.deficitKrw,
  500_000,
  "sell-needed KRW = remaining expenses - account balance - remaining income"
);
assert.equal(
  remainingSellNeeded.sellSats,
  Math.round((500_000 / 150_000_000) * 100_000_000),
  "remaining sell-needed sats are based on the current BTC price"
);

// 3-6. Arithmetic verification (inline calculation tests)
// Test: income 2,500,000 / expense 3,000,000 / btcKrw 96,700,000
const income = 2_500_000;
const expense = 3_000_000;
const btcKrw = 96_700_000;
const heldBtc = 0.12345678;
const net = income - expense;
assert.equal(net, -500_000, "net is -500,000");
const deficit = Math.abs(net);
assert.equal(deficit, 500_000, "deficit is 500,000");
const sellBtc = deficit / btcKrw;
assert.ok(Math.abs(sellBtc - 500000 / 96700000) < 1e-12, "sellBtc matches 500000/96700000");
const sellSats = Math.round(sellBtc * 100_000_000);
assert.equal(sellSats, Math.round((500000 / 96700000) * 100_000_000), "sats calculation matches");

// netKrw positive ??sellBtc should be 0
const posNet = 100_000;
const posDeficit = posNet < 0 ? Math.abs(posNet) : 0;
assert.equal(posDeficit, 0, "positive net has no deficit");
const posSellBtc = posDeficit / btcKrw;
assert.equal(posSellBtc, 0, "positive net means no sell needed");

// btcKrw = 0 ??safe handling, no NaN/Infinity
const zeroRateSell = 0 > 0 ? deficit / 0 : 0;
assert.ok(Number.isFinite(zeroRateSell), "zero rate produces finite result");

// 8. SettingsPage has held BTC input
const settingsPage = readFileSync("src/components/settings/SettingsPage.tsx", "utf8");
assert.match(settingsPage, /heldBtcInput/, "SettingsPage has held BTC UI");

// 9. Home screen has held BTC display
const homePage = readFileSync("src/components/home/HomePage.tsx", "utf8");
assert.match(homePage, /heldBtc/, "HomePage references heldBtc");
assert.match(homePage, /getMonthlyCash/, "HomePage reads monthly cash");
assert.match(homePage, /calculateRemainingLivingCashflow/, "HomePage calculates remaining cashflow for sell-needed amount");
assert.match(
  homePage,
  /confirmedCoverageKrw:\s*monthlyCash/,
  "HomePage uses account balance as the sell-needed coverage"
);
assert.doesNotMatch(
  homePage,
  /confirmedCoverageKrw:\s*monthlySellSummary\.totalKrwCovered\s*\+\s*monthlyCash/,
  "HomePage does not use total settlement sales to calculate sell-needed amount"
);
assert.match(homePage, /monthlyCash=\{monthlyCash\}/, "HomePage passes monthly cash to children");
assert.match(homePage, /onMonthlyCashChanged=\{refreshAfterSellChange\}/, "HomePage refreshes after monthly cash changes");

const balanceCard = readFileSync("src/components/home/BalanceCard.tsx", "utf8");
assert.match(balanceCard, /heldBtc/, "BalanceCard shows held BTC");

// 10. Home screen has sell-needed card
assert.ok(existsSync("src/components/home/SellNeededCard.tsx"), "SellNeededCard exists");
const sellCard = readFileSync("src/components/home/SellNeededCard.tsx", "utf8");
assert.match(homePage, /SellNeededCard/, "HomePage includes SellNeededCard");

const sellConfirmModal = readFileSync("src/components/home/SellConfirmModal.tsx", "utf8");
assert.match(sellConfirmModal, /applyAccountBalance/, "SellConfirmModal imports or uses applyAccountBalance");
assert.match(sellConfirmModal, /통장 보유액/, "SellConfirmModal has monthly cash label");
assert.match(sellConfirmModal, /setMonthlyCash/, "SellConfirmModal persists monthly cash on save");
assert.match(sellConfirmModal, /통장 보유액만 저장/, "SellConfirmModal can save monthly cash without a sell record");
assert.match(sellConfirmModal, /판매량 확정/, "SellConfirmModal title is 판매량 확정");
assert.doesNotMatch(sellConfirmModal, /BTC 판매 확정/, "SellConfirmModal no longer uses old BTC 판매 확정 title");
assert.doesNotMatch(sellConfirmModal, /정산기간/, "SellConfirmModal removes the settlement-period display row");
assert.match(sellConfirmModal, /실제 판매량/, "SellConfirmModal uses actual sale amount label");
assert.doesNotMatch(sellConfirmModal, /자동 판매량/, "SellConfirmModal removes old automatic sale amount label");
assert.match(sellConfirmModal, /ldg-sell-highlight/, "SellConfirmModal uses scoped sale highlight box");
const saleHighlight = sellConfirmModal.match(/<div className="ldg-sell-highlight">([\s\S]*?)<\/div>\s*<div className="ldg-modal-rate-row">/)?.[1] ?? "";
assert.ok(saleHighlight.length > 0, "SellConfirmModal sale highlight box can be inspected");
assert.match(saleHighlight, /sellSats\.toLocaleString\("en-US"\)/, "sale highlight shows sats");
assert.match(saleHighlight, /fmtKRW\(sellKrw\)/, "sale highlight shows KRW amount");
assert.doesNotMatch(saleHighlight, /formatBtcFixed|BTC/, "sale highlight does not show BTC helper text");
assert.match(sellConfirmModal, /현재 시세/, "SellConfirmModal shows current price row");
assert.match(sellConfirmModal, /ldg-modal-rate-row[\s\S]*formatKrwWon\(currentBtcKrw\)/, "current price row is display-only text");
const rateRow = sellConfirmModal.match(/<div className="ldg-modal-rate-row">([\s\S]*?)<\/div>/)?.[1] ?? "";
assert.ok(rateRow.length > 0, "SellConfirmModal current price row can be inspected");
assert.doesNotMatch(rateRow, /<input/, "current price row is not an input");
assert.match(
  sellConfirmModal,
  /통장에 가용 가능한 원화가 있으면 입력해주세요\. 부족분에서 차감됩니다\./,
  "SellConfirmModal has the requested monthly-cash helper copy"
);
assert.doesNotMatch(sellConfirmModal, /통장 보유액 반영 후 실제 판매/, "SellConfirmModal removes duplicate cash-adjusted sale copy");
assert.match(sellConfirmModal, /통장으로 충분 · 판매 불필요/, "SellConfirmModal shows no-sale-needed copy when fully covered");
assert.doesNotMatch(sellConfirmModal, /보유 BTC에서 차감/, "SellConfirmModal removes held-BTC deduction checkbox copy");
assert.doesNotMatch(sellConfirmModal, /const \[deduct/, "SellConfirmModal no longer has user-controlled deduct state");
assert.doesNotMatch(sellConfirmModal, /type="checkbox"[\s\S]{0,300}deduct/, "SellConfirmModal removes deduct checkbox input");
assert.doesNotMatch(sellConfirmModal, /if\s*\(\s*deduct\b/, "SellConfirmModal does not guard held-BTC updates behind deduct");
assert.match(
  sellConfirmModal,
  /overHeld\s*=\s*Number\.isFinite\(sellBtc\)\s*&&\s*sellBtc\s*>\s*availableHeldBtc/,
  "SellConfirmModal always checks over-held sales"
);
assert.match(
  sellConfirmModal,
  /sellBtc\s*>\s*availableHeldBtcAtSave[\s\S]{0,140}보유 BTC보다 많이 판매할 수 없습니다/,
  "SellConfirmModal blocks saving sales above held BTC"
);
assert.match(sellConfirmModal, /deductedFromHeldBtc:\s*true/, "SellConfirmModal records sales as deducted from held BTC");
assert.match(sellConfirmModal, /deductedBtcAmount:\s*sellBtc/, "SellConfirmModal records the deducted BTC amount");
assert.match(sellConfirmModal, /setHeldBtc\(Math\.max\(0,\s*current\s*-\s*sellBtc\)\)/, "new sales always deduct from held BTC");
assert.match(
  sellConfirmModal,
  /disabled=\{[^}]*fullyCovered[^}]*\}/,
  "fullyCovered participates in the save button disabled condition"
);
assert.doesNotMatch(
  sellConfirmModal,
  /판매 당시 BTC 가격[\s\S]{0,500}<input/,
  "sell-time BTC price is no longer editable"
);
assert.doesNotMatch(
  sellConfirmModal,
  /판매할 비트코인[\s\S]{0,1400}<input/,
  "sell BTC amount is no longer editable"
);
assert.doesNotMatch(sellConfirmModal, /충당 원화[\s\S]{0,500}<input/, "KRW covered amount is no longer editable");
const balanceSetItemCalls = [...sellConfirmModal.matchAll(/localStorage\.setItem\s*\(([\s\S]*?)\)/g)].filter((match) =>
  match[1].includes("balanceInput")
);
assert.equal(balanceSetItemCalls.length, 0, "balanceInput is not persisted to localStorage");

assert.match(sellCard, /정산 완료/, "SellNeededCard has settlement-complete branch");
assert.match(sellCard, /everHadDeficit\s*=\s*totalDeficitKrw\s*>\s*0/, "SellNeededCard tracks whether a deficit originally existed");
assert.match(sellCard, /if\s*\(\s*!everHadDeficit\s*\)\s*return\s+null/, "SellNeededCard hides itself when no deficit ever existed");
assert.match(
  sellCard,
  /settled\s*=\s*everHadDeficit\s*&&\s*deficitKrw\s*===\s*0/,
  "SellNeededCard requires an original deficit before showing settlement complete"
);
assert.match(sellCard, /needSell\s*=\s*deficitKrw\s*>\s*0/, "SellNeededCard keeps an explicit need-sell state");
assert.match(sellCard, /ldg-settlement-done/, "SellNeededCard uses settlement-complete headline class");
assert.match(sellCard, /monthlyCash/, "SellNeededCard displays monthly cash");
assert.match(sellCard, /monthlySellSummary/, "SellNeededCard displays actual monthly sale summary");
assert.match(sellCard, /sats/, "SellNeededCard displays sats alongside BTC");
const completedBranch = sellCard.match(/settled \? \(\s*<>\s*([\s\S]*?)\s*<\/>\s*\) : needSell \? \(/)?.[1] ?? "";
assert.ok(completedBranch.length > 0, "SellNeededCard settlement-complete branch can be inspected");
assert.doesNotMatch(completedBranch, /이번 달/, "settlement-complete labels omit this-month wording");
assert.doesNotMatch(completedBranch, /이미 반영|총 부족분/, "settlement-complete branch omits reflected/total-deficit line");
assert.doesNotMatch(completedBranch, /BtcAndSats/, "settlement-complete branch does not reuse duplicate BTC/sats helper");
for (const label of ["예상 판매량", "통장 보유액", "실제 판매량", "판매 후 BTC"]) {
  assert.match(completedBranch, new RegExp(label), `settlement-complete branch shows ${label}`);
}
assert.match(completedBranch, /formatDoneBtc/, "settlement-complete branch uses fixed 8-decimal BTC formatting");
assert.match(
  completedBranch,
  /label="판매 후 BTC"[\s\S]{0,220}formatDoneBtc\(result\.heldBtc\)/,
  "settlement-complete after-sale BTC uses current held BTC"
);
assert.doesNotMatch(
  completedBranch,
  /label="판매 후 BTC"[\s\S]{0,220}formatDoneBtc\(actualSoldBtc\)/,
  "settlement-complete after-sale BTC does not repeat actual sale BTC"
);

const ledgerCss = readFileSync("src/styles/ledger.css", "utf8");
assert.match(ledgerCss, /\.ldg-done-row/, "settlement-complete rows have scoped layout class");
assert.match(ledgerCss, /\.ldg-done-label[\s\S]*white-space:\s*nowrap/, "settlement-complete labels do not wrap");
assert.match(ledgerCss, /\.ldg-done-val[\s\S]*text-align:\s*right/, "settlement-complete values are right-aligned");

// 11. backup.ts includes heldBtc key
const backup = readFileSync("src/lib/backup.ts", "utf8");
assert.match(backup, /myledger\.heldBtc\.v1/, "backup includes heldBtc key");
assert.match(backup, /MONTHLY_CASH_KEY/, "backup includes monthly cash key");

// 12. appLock key is NOT in backup
assert.doesNotMatch(backup, /myledger\.appLock\.v1/, "appLock key is not in backup");

console.log("verify:sell passed");
