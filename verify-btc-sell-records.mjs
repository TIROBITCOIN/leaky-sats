import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

// 1. myledger.btcSellRecords.v1 key used
const sellRecordsSrc = readFileSync("src/lib/btcSellRecords.ts", "utf8");
assert.match(sellRecordsSrc, /myledger\.btcSellRecords\.v1/, "btcSellRecords uses correct localStorage key");

// 2. btcSellRecords utility exists
assert.match(sellRecordsSrc, /BtcSellRecord/, "BtcSellRecord type exists");

// 3. add/list/summarize functions exist
assert.match(sellRecordsSrc, /addBtcSellRecord/, "addBtcSellRecord exists");
assert.match(sellRecordsSrc, /listBtcSellRecords/, "listBtcSellRecords exists");
assert.match(sellRecordsSrc, /listBtcSellRecordsByMonth/, "listBtcSellRecordsByMonth exists");
assert.match(sellRecordsSrc, /summarizeBtcSellRecordsByMonth/, "summarizeBtcSellRecordsByMonth exists");
assert.match(sellRecordsSrc, /summarizeBtcSellRecordsByYear/, "summarizeBtcSellRecordsByYear exists");
assert.match(sellRecordsSrc, /deleteBtcSellRecord/, "deleteBtcSellRecord exists");

// 4. Monthly summarize calculates totals
assert.match(sellRecordsSrc, /totalBtcSold/, "monthly summary has totalBtcSold");
assert.match(sellRecordsSrc, /totalKrwCovered/, "monthly summary has totalKrwCovered");

// 5. Yearly summarize calculates totals
assert.match(sellRecordsSrc, /totalSatsSold/, "yearly summary has totalSatsSold");

// 6. Remaining deficit calculation (confirmedCoverageKrw in sellCalculator)
const sellCalcSrc = readFileSync("src/lib/sellCalculator.ts", "utf8");
assert.match(sellCalcSrc, /confirmedCoverageKrw/, "sellCalculator accepts confirmedCoverageKrw");
assert.match(sellCalcSrc, /totalDeficitKrw/, "sellCalculator calculates totalDeficitKrw");
// Arithmetic: deficit = max(0, totalDeficit - coverage)
assert.match(sellCalcSrc, /Math\.max\(0, totalDeficitKrw - safeCoverage\)/, "remaining deficit = max(0, total - coverage)");

// 7. BTC/sats display unit formatter reused (fmtBtcValue)
const sellCardSrc = readFileSync("src/components/home/SellNeededCard.tsx", "utf8");
assert.match(sellCardSrc, /fmtBtcValue/, "SellNeededCard uses fmtBtcValue");
const monthlyCardSrc = readFileSync("src/components/home/MonthlySellSummaryCard.tsx", "utf8");
assert.match(monthlyCardSrc, /fmtBtcValue/, "MonthlySellSummaryCard uses fmtBtcValue");
const yearlyCardSrc = readFileSync("src/components/home/YearlySellSummaryCard.tsx", "utf8");
assert.match(yearlyCardSrc, /fmtBtcValue/, "YearlySellSummaryCard uses fmtBtcValue");

// 8. SellNeededCard has "BTC 판매 반영" button
assert.match(sellCardSrc, /BTC 판매 반영/, "SellNeededCard has BTC 판매 반영 button");

// 9. Modal has required fields
const modalSrc = readFileSync("src/components/home/SellConfirmModal.tsx", "utf8");
assert.match(modalSrc, /판매.*BTC|판매.*sats/, "modal has sell BTC/sats input");
assert.match(modalSrc, /충당 원화/, "modal has krwCovered input");
assert.match(modalSrc, /BTC\/KRW/, "modal has BTC/KRW input");
assert.match(modalSrc, /보유 BTC에서 차감/, "modal has deduct checkbox");

// 10. Saving deducts from heldBtc
assert.match(modalSrc, /setHeldBtc/, "modal calls setHeldBtc for deduction");
assert.match(modalSrc, /Math\.max\(0/, "deduction does not go below 0");

// 11. backup.ts includes btcSellRecords
const backupSrc = readFileSync("src/lib/backup.ts", "utf8");
assert.match(backupSrc, /myledger\.btcSellRecords\.v1/, "backup includes btcSellRecords key");

// 12. appLock is not in backup
assert.doesNotMatch(backupSrc, /myledger\.appLock\.v1/, "appLock is not in backup");

// 13. Tab text-decoration removed
const tabbarCss = readFileSync("src/styles/tabbar.css", "utf8");
assert.match(tabbarCss, /text-decoration:\s*none/, "tab has text-decoration: none");

// 14. Home month display uses month utilities.
// Phase 11: month-label rendering lives in the shared MonthSelector component.
// Phase 11.1: HomePage renders MonthSelector directly below the balance card (not inside
// LedgerHeader anymore) — LedgerHeader is no longer responsible for month display.
const homePageSrc = readFileSync("src/components/home/HomePage.tsx", "utf8");
assert.match(homePageSrc, /MonthSelector/, "HomePage renders the shared MonthSelector");
const monthSelectorSrc = readFileSync("src/components/common/MonthSelector.tsx", "utf8");
assert.match(monthSelectorSrc, /getMonthLabel|getCurrentMonthLabel/, "MonthSelector uses month label utility");
const monthSrc = readFileSync("src/lib/month.ts", "utf8");
assert.match(monthSrc, /getCurrentMonthLabel/, "month.ts exports getCurrentMonthLabel");
assert.match(monthSrc, /getCurrentMonthKey/, "month.ts exports getCurrentMonthKey");
assert.match(monthSrc, /new Date/, "month utilities use current date");

console.log("verify:sell-records passed");
