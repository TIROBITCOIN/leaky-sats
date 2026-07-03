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

// 6. Remaining deficit calculation (monthlyCashKrw in sellCalculator)
const sellCalcSrc = readFileSync("src/lib/sellCalculator.ts", "utf8");
assert.match(sellCalcSrc, /monthlyCashKrw/, "sellCalculator accepts monthlyCashKrw");
assert.match(sellCalcSrc, /totalDeficitKrw/, "sellCalculator calculates totalDeficitKrw");
// Arithmetic: deficit = max(0, totalDeficit - monthly cash)
assert.match(sellCalcSrc, /Math\.max\(0, totalDeficitKrw - safeMonthlyCash\)/, "remaining deficit = max(0, total - monthly cash)");

// 7. BTC/sats display unit formatter reused (fmtBtcValue)
const sellCardSrc = readFileSync("src/components/home/SellNeededCard.tsx", "utf8");
assert.match(sellCardSrc, /fmtBtcValue/, "SellNeededCard uses fmtBtcValue");
const monthlyCardSrc = readFileSync("src/components/home/MonthlySellSummaryCard.tsx", "utf8");
assert.match(monthlyCardSrc, /fmtBtcValue/, "MonthlySellSummaryCard uses fmtBtcValue");
const yearlyCardSrc = readFileSync("src/components/home/YearlySellSummaryCard.tsx", "utf8");
assert.match(yearlyCardSrc, /fmtBtcValue/, "YearlySellSummaryCard uses fmtBtcValue");

// 8. SellNeededCard has "BTC ?먮ℓ ?뺤젙" button (Phase 12: renamed from 諛섏쁺 to ?뺤젙)
assert.match(sellCardSrc, /BTC 판매 확정/, "SellNeededCard has BTC 판매 확정 button");

// 9. Modal has required automated sell fields
const modalSrc = readFileSync("src/components/home/SellConfirmModal.tsx", "utf8");
assert.match(modalSrc, /판매량 확정/, "modal uses the sell amount confirmation title");
assert.match(modalSrc, /실제 판매량/, "modal shows actual sell amount");
assert.doesNotMatch(modalSrc, /자동 판매량/, "modal no longer uses old automatic sell amount label");
assert.match(modalSrc, /sellSats/, "modal calculates sats automatically");
assert.match(modalSrc, /sellBtc/, "modal calculates BTC automatically");
assert.match(modalSrc, /krwCovered:\s*sellKrw/, "modal saves auto-calculated krwCovered");
assert.match(modalSrc, /현재 시세/, "modal shows current BTC price");
assert.match(modalSrc, /btcKrwAtSell:\s*currentBtcKrw/, "modal snapshots current BTC price on save");
assert.doesNotMatch(modalSrc, /보유 BTC에서 차감/, "modal no longer has deduct checkbox");

// 10. Saving deducts from heldBtc
assert.match(modalSrc, /setHeldBtc/, "modal calls setHeldBtc for deduction");
assert.match(modalSrc, /Math\.max\(0/, "deduction does not go below 0");
assert.match(
  modalSrc,
  /const heldBtcAtSave = getHeldBtc\(\);[\s\S]*if \(sellBtc > availableHeldBtcAtSave\) \{[\s\S]*setError\("보유 BTC보다 많이 판매할 수 없습니다\."\);[\s\S]*return;/,
  "handleSave rechecks held BTC and returns before saving an overheld sale"
);
assert.match(modalSrc, /disabled=\{[^}]*overHeld[^}]*\}/, "save button is disabled while a deducted sale exceeds held BTC");
assert.match(
  modalSrc,
  /const overHeld = Number\.isFinite\(sellBtc\) && sellBtc > availableHeldBtc/,
  "overheld blocking always applies to sales"
);
assert.match(modalSrc, /deductedFromHeldBtc:\s*true/, "saved records are always marked deducted from held BTC");
assert.match(modalSrc, /deductedBtcAmount:\s*sellBtc/, "saved records snapshot the deducted BTC amount");

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
// LedgerHeader anymore) ??LedgerHeader is no longer responsible for month display.
const homePageSrc = readFileSync("src/components/home/HomePage.tsx", "utf8");
assert.match(homePageSrc, /MonthSelector/, "HomePage renders the shared MonthSelector");
const monthSelectorSrc = readFileSync("src/components/common/MonthSelector.tsx", "utf8");
assert.match(monthSelectorSrc, /getMonthLabel|getCurrentMonthLabel/, "MonthSelector uses month label utility");
const monthSrc = readFileSync("src/lib/month.ts", "utf8");
assert.match(monthSrc, /getCurrentMonthLabel/, "month.ts exports getCurrentMonthLabel");
assert.match(monthSrc, /getCurrentMonthKey/, "month.ts exports getCurrentMonthKey");
assert.match(monthSrc, /new Date/, "month utilities use current date");

console.log("verify:sell-records passed");
