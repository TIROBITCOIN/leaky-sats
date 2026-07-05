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

// 6. Sell-needed calculation uses the full settlement-period deficit.
const sellCalcSrc = readFileSync("src/lib/sellCalculator.ts", "utf8");
assert.doesNotMatch(sellCalcSrc, /confirmedCoverageKrw|applyAccountBalance|calculateRemainingLivingCashflow/, "sellCalculator has no cash-balance coverage path");
assert.match(sellCalcSrc, /totalDeficitKrw/, "sellCalculator calculates totalDeficitKrw");
assert.match(sellCalcSrc, /Math\.max\(0, expenseKrw - incomeKrw\)/, "sell-needed KRW = max(0, period expense - period income)");

// 7. BTC/sats display formatters are reused.
const sellCardSrc = readFileSync("src/components/home/SellNeededCard.tsx", "utf8");
assert.match(sellCardSrc, /fmtSats/, "SellNeededCard uses sats as the primary sell amount");
const monthlyCardSrc = readFileSync("src/components/home/MonthlySellSummaryCard.tsx", "utf8");
assert.match(monthlyCardSrc, /fmtBtcValue/, "MonthlySellSummaryCard uses fmtBtcValue");
const yearlyCardSrc = readFileSync("src/components/home/YearlySellSummaryCard.tsx", "utf8");
assert.match(yearlyCardSrc, /fmtBtcValue/, "YearlySellSummaryCard uses fmtBtcValue");

// 8. SellNeededCard has the simplified sell button.
assert.match(sellCardSrc, />\s*판매\s*</, "SellNeededCard has the simplified sell button");
assert.match(sellCardSrc, /records:\s*BtcSellRecord\[\]/, "SellNeededCard receives sell records for completed-card actions");
assert.match(sellCardSrc, /onEditRecord:\s*\(record:\s*BtcSellRecord\) => void/, "SellNeededCard can request editing a sell record");
assert.match(sellCardSrc, /onDeleteRecord:\s*\(record:\s*BtcSellRecord\) => void/, "SellNeededCard can request deleting a sell record");
assert.match(sellCardSrc, /fmtSats\(record\.satsSold\)/, "completed sell card record rows use sats, not BTC decimal display");
assert.match(sellCardSrc, /aria-label="판매 기록 더보기"/, "completed sell card exposes a record action menu");
assert.match(sellCardSrc, />\s*수정\s*</, "completed sell card exposes an edit action");
assert.match(sellCardSrc, />\s*삭제\s*</, "completed sell card exposes a delete action");

// 9. Modal is the simplified single-amount sell form
const modalSrc = readFileSync("src/components/home/SellConfirmModal.tsx", "utf8");
assert.match(modalSrc, /판매할 금액/, "modal uses the simplified sell amount title");
assert.match(modalSrc, /≈ \{formatSats\(sats\)\}/, "modal shows a live sats conversion of the entered amount");
assert.doesNotMatch(modalSrc, /자동 판매량/, "modal no longer uses old automatic sell amount label");
assert.doesNotMatch(modalSrc, /carryover|premium|networkFee|tradeSats|finalSats/, "modal drops carryover/premium/network-fee/derived-sats fields");
assert.doesNotMatch(modalSrc, /이월 잔고|P2P 프리미엄|네트워크 수수료|실제 판매할 sats/, "modal drops the removed field labels");
assert.doesNotMatch(modalSrc, /fetchRecommendedNetworkFeeSats|UTXO/, "modal no longer loads mempool fees or warns about UTXOs");
assert.match(modalSrc, /sellBtc/, "modal converts the entered amount to BTC");
assert.match(modalSrc, /krwCovered:\s*amountKrw/, "modal saves the entered KRW amount as krwCovered");
assert.doesNotMatch(modalSrc, /실효가격/, "modal hides the effective BTC price row");
assert.match(modalSrc, /const \[isSaving,\s*setIsSaving\]\s*=\s*useState\(false\)/, "modal tracks an isSaving state");
assert.match(modalSrc, /savingRef/, "modal uses a synchronous saving ref to block rapid duplicate submits");
assert.match(modalSrc, /if \(savingRef\.current\) return;/, "handleSave returns immediately while a save is already running");
assert.match(modalSrc, /setSellSaveInProgress\(true\)/, "handleSave raises the global save-in-progress flag");
assert.match(modalSrc, /setSellSaveInProgress\(false\)/, "handleSave clears the global save-in-progress flag");
assert.match(modalSrc, /disabled=\{overHeld \|\| isSaving\}/, "save button is disabled while saving");
assert.match(modalSrc, /\{isSaving \? "저장 중\.\.\." : isEdit \? "수정 완료" : "판매 확정"\}/, "save button shows loading copy while saving");
assert.match(modalSrc, /const recalcBtcKrw = editRecord \? editRecord\.btcKrwAtSell : currentBtcKrw/, "edit mode recalculates BTC with the original sell rate");
assert.match(modalSrc, /const sellBtc = recalcBtcKrw > 0 \? amountKrw \/ recalcBtcKrw : 0/, "modal converts KRW to BTC using the recalculation rate");
assert.match(modalSrc, /btcKrwAtSell:\s*currentBtcKrw/, "new sell records snapshot the current BTC price on save");
const updateSellRecordCall = modalSrc.match(/updateBtcSellRecord\(editRecord\.id,\s*\{([\s\S]*?)\n\s*\}\);/);
assert.ok(updateSellRecordCall, "modal updates an existing sell record in edit mode");
assert.doesNotMatch(updateSellRecordCall[1], /btcKrwAtSell/, "editing a sell record must not overwrite the original sell rate");
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
  /const overHeld = useMemo\(\(\) => Number\.isFinite\(sellBtc\) && sellBtc > availableHeldBtc/,
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
assert.match(homePageSrc, /listBtcSellRecordsByMonth\(selectedMonth\)/, "HomePage loads monthly sell records for the completed sell card");
assert.match(homePageSrc, /onEditRecord=\{\(record\) => setSellModalState\(\{ mode: "edit", record \}\)\}/, "HomePage opens the sell edit modal from the completed sell card");
assert.match(homePageSrc, /onDeleteRecord=\{handleDeleteSellRecord\}/, "HomePage wires delete actions from the completed sell card");
assert.match(homePageSrc, /deleteBtcSellRecord\(record\.id\)/, "HomePage deletes sell records from the completed sell card");
assert.match(homePageSrc, /setHeldBtcStorage\(getHeldBtc\(\) \+ amount\)/, "HomePage can restore held BTC when deleting a sell record");
const monthSelectorSrc = readFileSync("src/components/common/MonthSelector.tsx", "utf8");
assert.match(monthSelectorSrc, /getMonthLabel|getCurrentMonthLabel/, "MonthSelector uses month label utility");
const monthSrc = readFileSync("src/lib/month.ts", "utf8");
assert.match(monthSrc, /getCurrentMonthLabel/, "month.ts exports getCurrentMonthLabel");
assert.match(monthSrc, /getCurrentMonthKey/, "month.ts exports getCurrentMonthKey");
assert.match(monthSrc, /new Date/, "month utilities use current date");

console.log("verify:sell-records passed");
