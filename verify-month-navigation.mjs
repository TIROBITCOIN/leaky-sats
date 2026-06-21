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

// 3. LedgerHeader accepts selectedMonth prop
const headerSrc = readFileSync("src/components/home/LedgerHeader.tsx", "utf8");
assert.match(headerSrc, /selectedMonth/, "LedgerHeader accepts selectedMonth");

// 4. getCurrentMonthKey used as the default when no month is selected, selectedMonth for calculations
// Phase 10: selectedMonth moved from local useState to a ?month= URL search param so the entry
// screen (and the tab bar) can read which month Home was showing, but it still falls back to
// getCurrentMonthKey() when no/invalid month param is present.
assert.match(
  homePage,
  /selectedMonth = isValidMonthKey\(monthParam\) \? monthParam : getCurrentMonthKey\(\)/,
  "selectedMonth defaults to getCurrentMonthKey when no month param is present"
);
assert.match(homePage, /anchorDate.*=.*monthKeyToAnchorDate\(selectedMonth\)/, "anchorDate derived from selectedMonth");

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

// 9. UI has prev/next month buttons
assert.match(headerSrc, /onPrevMonth/, "LedgerHeader has onPrevMonth");
assert.match(headerSrc, /onNextMonth/, "LedgerHeader has onNextMonth");
assert.match(headerSrc, /이전 달|〈/, "prev button exists in header");
assert.match(headerSrc, /다음 달|〉/, "next button exists in header");

// 10. NaN/Infinity defense maintained
const sellCalcSrc = readFileSync("src/lib/sellCalculator.ts", "utf8");
assert.match(sellCalcSrc, /Number\.isFinite/, "NaN/Infinity defense in sellCalculator");
assert.match(sellCalcSrc, /Math\.max\(0/, "max(0,...) defense in sellCalculator");

console.log("verify:month passed");
