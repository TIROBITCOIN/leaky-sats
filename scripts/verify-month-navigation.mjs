import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

// 1. month.ts has navigation functions
const monthSrc = readFileSync("src/lib/month.ts", "utf8");
assert.match(monthSrc, /addMonthsToMonthKey/, "addMonthsToMonthKey exists");
assert.match(monthSrc, /getPreviousMonthKey/, "getPreviousMonthKey exists");
assert.match(monthSrc, /getNextMonthKey/, "getNextMonthKey exists");
assert.match(monthSrc, /isCurrentMonth/, "isCurrentMonth exists");
assert.match(monthSrc, /getYearFromMonthKey/, "getYearFromMonthKey exists");
assert.match(monthSrc, /monthKeyToAnchorDate/, "monthKeyToAnchorDate exists");

// 2. HomePage uses selectedMonth state
const homePage = readFileSync("src/components/home/HomePage.tsx", "utf8");
assert.match(homePage, /selectedMonth/, "HomePage has selectedMonth state");
assert.match(homePage, /setSelectedMonth/, "HomePage has setSelectedMonth");

// 3. HomePage renders the shared MonthSelector with selectedMonth.
// Phase 11.1: the month selector moved out of LedgerHeader and is now rendered directly by
// HomePage, positioned below the balance card — LedgerHeader no longer needs a selectedMonth prop.
const headerSrc = readFileSync("src/components/home/LedgerHeader.tsx", "utf8");
assert.match(homePage, /<MonthSelector\s+selectedMonth={selectedMonth}/, "HomePage renders MonthSelector with selectedMonth");

// 4. Settlement month is used as the default when no valid month is selected.
// Phase 10: selectedMonth moved from local useState to a ?month= URL search param.
// Phase 11: that logic now lives in the shared src/lib/useSelectedMonth.ts hook (used by both
// HomePage and StatsPage) instead of being duplicated inline in each page component.
assert.match(homePage, /useSelectedMonth/, "HomePage uses the shared useSelectedMonth hook");
const useSelectedMonthSrc = readFileSync("src/lib/useSelectedMonth.ts", "utf8");
assert.match(
  useSelectedMonthSrc,
  /useSelectedMonth\(defaultMonthKey: string\)/,
  "useSelectedMonth accepts defaultMonthKey"
);
assert.match(
  useSelectedMonthSrc,
  /selectedMonth = isValidMonthKey\(monthParam\) \? monthParam : defaultMonthKey/,
  "a valid month query takes priority and otherwise useSelectedMonth uses defaultMonthKey"
);
assert.match(
  useSelectedMonthSrc,
  /if \(next === defaultMonthKey\) params\.delete\("month"\)/,
  "setSelectedMonth removes the query param relative to defaultMonthKey"
);
assert.match(
  homePage,
  /getSettlementMonthKeyForDate\(new Date\(\)\.toISOString\(\), settlementDay\)/,
  "HomePage derives its default month from today's settlement period"
);
assert.match(
  homePage,
  /useSelectedMonth\(defaultSettlementMonthKey\)/,
  "HomePage passes the settlement month default to useSelectedMonth"
);
const statsPageSrc = readFileSync("src/components/stats/StatsPage.tsx", "utf8");
assert.match(
  statsPageSrc,
  /useSelectedMonth\(defaultSettlementMonthKey\)/,
  "StatsPage passes the settlement month default to useSelectedMonth"
);
// Phase 12: anchorDate/monthKeyToAnchorDate was replaced by a settlement-period range
// (src/lib/settlement.ts getSettlementPeriod), since income/expense now follow the settlement
// day instead of the plain calendar month.
assert.match(homePage, /period\s*=\s*getSettlementPeriod\(selectedMonth, settlementDay\)/, "period derived from selectedMonth and settlementDay");
assert.match(homePage, /calculateMonthlyLivingCashflow\(\s*data\.txns,\s*categoriesById,\s*period,?\s*\)/, "living cashflow derived from the settlement period");
assert.match(homePage, /const netKrw = incomeKrw - expenseKrw/, "home net cashflow uses settlement-period income and expense");
assert.match(
  homePage,
  /<InOutCards[\s\S]*incomeKrw={incomeKrw}[\s\S]*expenseKrw={expenseKrw}[\s\S]*netKrw={netKrw}[\s\S]*btcKRW={data\.btcKRW}/,
  "HomePage passes settlement-period values explicitly to InOutCards"
);
const inOutCardsSrc = readFileSync("src/components/home/InOutCards.tsx", "utf8");
assert.doesNotMatch(inOutCardsSrc, /\bd\.(income|expense)\b/, "InOutCards does not display LedgerData income or expense");

const ledgerCss = readFileSync("src/styles/ledger.css", "utf8");
assert.doesNotMatch(
  ledgerCss,
  /\.ldg-price-col\s*\{[^}]*display:\s*contents/s,
  "price columns do not use display: contents"
);
assert.match(
  ledgerCss,
  /\.ldg-price-col\s*\{[^}]*display:\s*flex[^}]*flex-direction:\s*column/s,
  "each price column keeps its label and value vertically grouped"
);

// 5. SellNeededCard calculation connected via selectedMonth
const sellCardSrc = readFileSync("src/components/home/SellNeededCard.tsx", "utf8");
assert.match(sellCardSrc, /selectedMonth/, "SellNeededCard accepts selectedMonth");

// 6. MonthlySellSummaryCard accepts selectedMonth
const monthlyCardSrc = readFileSync("src/components/home/MonthlySellSummaryCard.tsx", "utf8");
assert.match(monthlyCardSrc, /selectedMonth/, "MonthlySellSummaryCard accepts selectedMonth");

// 7. YearlySellSummaryCard uses year from selectedMonth
const yearlyCardSrc = readFileSync("src/components/home/YearlySellSummaryCard.tsx", "utf8");
assert.match(yearlyCardSrc, /year/, "YearlySellSummaryCard accepts year prop");
assert.match(homePage, /getYearFromMonthKey\(selectedMonth\)/, "year derived from selectedMonth");

// 8. SellConfirmModal accepts selectedMonth
const modalSrc = readFileSync("src/components/home/SellConfirmModal.tsx", "utf8");
assert.match(modalSrc, /selectedMonth/, "SellConfirmModal accepts selectedMonth");
assert.match(modalSrc, /month: selectedMonth/, "SellConfirmModal saves record with selectedMonth");

// 9. UI has prev/next month buttons.
// Phase 11: the small inline 〈/〉 buttons that used to live directly in LedgerHeader moved into
// the shared MonthSelector component (src/components/common/MonthSelector.tsx).
// Phase 11.1: HomePage renders MonthSelector itself (not via LedgerHeader) — LedgerHeader is now
// limited to wallet name / block-height display.
assert.match(homePage, /MonthSelector/, "HomePage renders the shared MonthSelector");
assert.doesNotMatch(headerSrc, /MonthSelector/, "LedgerHeader no longer renders MonthSelector (Phase 11.1)");
const monthSelectorSrc = readFileSync("src/components/common/MonthSelector.tsx", "utf8");
assert.match(monthSelectorSrc, /이전 달|〈/, "prev button exists in MonthSelector");
assert.match(monthSelectorSrc, /다음 달|〉/, "next button exists in MonthSelector");
assert.match(monthSelectorSrc, /getPreviousMonthKey/, "MonthSelector moves to the previous month");
assert.match(monthSelectorSrc, /getNextMonthKey/, "MonthSelector moves to the next month");

// 10. NaN/Infinity defense maintained
const sellCalcSrc = readFileSync("src/lib/sellCalculator.ts", "utf8");
assert.match(sellCalcSrc, /Number\.isFinite/, "NaN/Infinity defense in sellCalculator");
assert.match(sellCalcSrc, /Math\.max\(0/, "max(0,...) defense in sellCalculator");

console.log("verify:month passed");
