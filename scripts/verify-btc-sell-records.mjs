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

// 4. Monthly summarize calculates totals + Phase 4 pricing stats
assert.match(sellRecordsSrc, /totalBtcSold/, "monthly summary has totalBtcSold");
assert.match(sellRecordsSrc, /totalKrwCovered/, "monthly summary has totalKrwCovered");
assert.match(sellRecordsSrc, /avgEffectivePriceKrw/, "monthly summary includes avg effective price");
assert.match(sellRecordsSrc, /avgPremiumPct/, "monthly summary includes avg premium vs market");
assert.match(sellRecordsSrc, /export function summarizeSellPricing/, "pricing summary helper exists");

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
assert.match(monthlyCardSrc, /실효 평균/, "MonthlySellSummaryCard shows average effective sell price");
assert.match(monthlyCardSrc, /시세 대비/, "MonthlySellSummaryCard shows premium vs market");
const yearlyCardSrc = readFileSync("src/components/home/YearlySellSummaryCard.tsx", "utf8");
assert.match(yearlyCardSrc, /fmtBtcValue/, "YearlySellSummaryCard uses fmtBtcValue");
assert.match(yearlyCardSrc, /실효 평균/, "YearlySellSummaryCard shows average effective sell price");

// 8. SellNeededCard has the simplified sell button.
assert.match(sellCardSrc, />\s*판매\s*</, "SellNeededCard has the simplified sell button");
assert.match(sellCardSrc, /records:\s*BtcSellRecord\[\]/, "SellNeededCard receives sell records for completed-card actions");
assert.match(sellCardSrc, /onEditRecord:\s*\(record:\s*BtcSellRecord\) => void/, "SellNeededCard can request editing a sell record");
assert.match(sellCardSrc, /onRecordsChanged:\s*\(\) => void/, "SellNeededCard refreshes parent state after deleting a record");
assert.match(sellCardSrc, /fmtSats\(record\.satsSold\)/, "completed sell card record rows use sats, not BTC decimal display");
assert.match(sellCardSrc, /const \[recordsOpen,\s*setRecordsOpen\]\s*=\s*useState\(false\)/, "completed sell card keeps record list collapsed by default");
assert.match(sellCardSrc, /aria-label="판매 기록 펼치기"/, "completed sell card exposes a single top-level expand button");
assert.match(sellCardSrc, /recordsOpen && recentRecords\.length > 0/, "completed sell record rows render only after the card is expanded");
assert.doesNotMatch(sellCardSrc, /import SellRecordMenu from "\.\.\/common\/SellRecordMenu"/, "completed sell card does not hide per-record actions behind another menu");
assert.doesNotMatch(sellCardSrc, /function SellRecordMenu/, "SellNeededCard does not define its own SellRecordMenu");
assert.doesNotMatch(sellCardSrc, /openMenuId|setOpenMenuId/, "completed sell card has no nested per-record menu state");
assert.match(sellCardSrc, /className="ldg-sell-record-actions"/, "completed sell card renders visible per-record actions inline");
assert.match(sellCardSrc, /className="ldg-sell-record-action"/, "completed sell card edit action uses a dedicated touch-sized button");
assert.match(sellCardSrc, /className="ldg-sell-record-action danger"/, "completed sell card delete action uses a dedicated touch-sized button");
assert.match(sellCardSrc, /deleteBtcSellRecord\(record\.id\)/, "SellNeededCard deletes records from the completed card");
assert.match(sellCardSrc, /setHeldBtc\(getHeldBtc\(\) \+ amount\)/, "SellNeededCard can restore held BTC when deleting a completed-card record");

const sharedSellRecordMenuSrc = readFileSync("src/components/common/SellRecordMenu.tsx", "utf8");
assert.match(sharedSellRecordMenuSrc, /export default function SellRecordMenu/, "shared SellRecordMenu component exists");
assert.match(sharedSellRecordMenuSrc, /aria-label="판매 기록 더보기"/, "shared SellRecordMenu keeps the per-record action affordance");
assert.match(sharedSellRecordMenuSrc, />\s*수정\s*</, "shared SellRecordMenu exposes an edit action");
assert.match(sharedSellRecordMenuSrc, />\s*삭제\s*</, "shared SellRecordMenu exposes a delete action");
assert.match(monthlyCardSrc, /import SellRecordMenu from "\.\.\/common\/SellRecordMenu"/, "MonthlySellSummaryCard reuses the shared SellRecordMenu");
assert.doesNotMatch(monthlyCardSrc, /function SellRecordMenu/, "MonthlySellSummaryCard no longer defines a duplicate SellRecordMenu");

// 9. Modal is measured-input sell form (schema v2) — no KRW→BTC reverse calc for held deduction
const modalSrc = readFileSync("src/components/home/SellConfirmModal.tsx", "utf8");
assert.match(modalSrc, /\{isEdit \? "판매 기록 수정" : "판매 확정"\}/, "modal title supports measured sell / edit");
assert.match(modalSrc, /받은 원화/, "modal asks for measured KRW received");
assert.match(modalSrc, /보낸 비트코인/, "modal asks for measured BTC spent from wallet");
assert.match(modalSrc, /btcSpentFromWallet/, "modal tracks measured wallet BTC outflow");
assert.match(modalSrc, /krwReceived/, "modal tracks measured KRW received");
assert.match(modalSrc, /schemaVersion:\s*2/, "modal saves schemaVersion 2");
assert.match(modalSrc, /calculateEffectiveSellPriceKrw/, "modal still computes effective sell price for storage");
assert.doesNotMatch(modalSrc, /실효 매도가|앱 시세 \(참고\)|시세 대비/, "modal hides effective/market price rows");
assert.doesNotMatch(modalSrc, /전송 수수료/, "modal no longer shows optional network fee input");
assert.doesNotMatch(modalSrc, /자동 판매량/, "modal no longer uses old automatic sell amount label");
assert.doesNotMatch(modalSrc, /carryover|premiumPct|tradeSats|finalSats/, "modal drops carryover/premium/derived-sats fields");
assert.doesNotMatch(modalSrc, /이월 잔고|P2P 프리미엄|실제 판매할 sats/, "modal drops the removed field labels");
assert.doesNotMatch(modalSrc, /fetchRecommendedNetworkFeeSats|UTXO/, "modal no longer loads mempool fees or warns about UTXOs");
assert.match(modalSrc, /krwCovered:\s*krwReceived/, "modal saves measured KRW as krwCovered");
assert.match(modalSrc, /btcSold:\s*btcSpentFromWallet/, "modal saves measured BTC as btcSold");
assert.match(modalSrc, /const \[isSaving,\s*setIsSaving\]\s*=\s*useState\(false\)/, "modal tracks an isSaving state");
assert.match(modalSrc, /savingRef/, "modal uses a synchronous saving ref to block rapid duplicate submits");
assert.match(modalSrc, /if \(savingRef\.current\) return;/, "handleSave returns immediately while a save is already running");
assert.match(modalSrc, /setReloadBlocked\("sell-save",\s*true\)/, "handleSave raises the sell-save reload blocker");
assert.match(modalSrc, /setReloadBlocked\("sell-save",\s*false\)/, "handleSave clears the sell-save reload blocker");
assert.match(modalSrc, /disabled=\{overHeld \|\| isSaving\}/, "save button is disabled while saving");
assert.match(modalSrc, /\{isSaving \? "저장 중\.\.\." : isEdit \? "수정 완료" : "판매 확정"\}/, "save button shows loading copy while saving");
assert.match(modalSrc, /btcKrwAtSell:\s*effective/, "btcKrwAtSell stores the effective sell price");
assert.match(modalSrc, /marketBtcKrwAtSell/, "modal snapshots the app market price for comparison");
assert.match(modalSrc, /networkFeeSats:\s*undefined/, "modal leaves networkFeeSats undefined (schema kept, UI removed)");
assert.match(modalSrc, /updateBtcSellRecord\(editRecord\.id/, "modal updates an existing sell record in edit mode");
assert.doesNotMatch(modalSrc, /보유 BTC에서 차감/, "modal no longer has deduct checkbox");
assert.match(sellRecordsSrc, /schemaVersion\?/, "BtcSellRecord type includes schemaVersion");
assert.match(sellRecordsSrc, /export function calculateEffectiveSellPriceKrw/, "effective price helper is exported");
assert.match(sellCardSrc, /이번 정산기간에는 팔 비트코인이 없습니다/, "surplus state shows no-sell guidance copy");
assert.match(sellCardSrc, /isSurplus|netKrw >= 0/, "sell card branches on surplus/netKrw");

// 10. Saving deducts measured BTC from heldBtc (manual mode)
assert.match(modalSrc, /setHeldBtc/, "modal calls setHeldBtc for deduction");
assert.match(modalSrc, /Math\.max\(0/, "deduction does not go below 0");
assert.match(
  modalSrc,
  /const heldBtcAtSave = getHeldBtc\(\);[\s\S]*if \(btcSpentFromWallet > availableHeldBtcAtSave\) \{[\s\S]*setError\("보유 BTC보다 많이 판매할 수 없습니다\."\);[\s\S]*return;/,
  "handleSave rechecks held BTC and returns before saving an overheld sale"
);
assert.match(modalSrc, /disabled=\{[^}]*overHeld[^}]*\}/, "save button is disabled while a deducted sale exceeds held BTC");
assert.match(
  modalSrc,
  /const overHeld = useMemo\(\s*\(\) =>\s*!walletSyncMode &&\s*Number\.isFinite\(btcSpentFromWallet\) &&\s*btcSpentFromWallet > availableHeldBtc/s,
  "overheld blocking uses measured wallet BTC in manual mode only"
);
assert.match(modalSrc, /deductedFromHeldBtc:\s*!walletSync/, "manual mode deducts held BTC; wallet-sync does not");
assert.match(modalSrc, /walletSync \? undefined : btcSpentFromWallet/, "wallet-sync omits deductedBtcAmount");

// 11. backup.ts includes btcSellRecords
const backupSrc = readFileSync("src/lib/backup.ts", "utf8");
assert.match(backupSrc, /myledger\.btcSellRecords\.v1/, "backup includes btcSellRecords key");

// 12. appLock is not in backup
assert.doesNotMatch(backupSrc, /myledger\.appLock\.v1/, "appLock is not in backup");

// 13. Tab text-decoration removed
const tabbarCss = readFileSync("src/styles/tabbar.css", "utf8");
assert.match(tabbarCss, /text-decoration:\s*none/, "tab has text-decoration: none");
const layoutCss = readFileSync("src/styles/layout.css", "utf8");
assert.match(layoutCss, /\.ldg-sell-record-actions/, "completed sell record inline actions are styled");
assert.match(layoutCss, /\.ldg-sell-record-action[\s\S]*min-height:\s*44px/, "completed sell record action buttons keep at least a 44px touch target");

// 14. Home month display uses month utilities.
// Phase 11: month-label rendering lives in the shared MonthSelector component.
// Phase 11.1: HomePage renders MonthSelector directly below the balance card (not inside
// LedgerHeader anymore) ??LedgerHeader is no longer responsible for month display.
const homePageSrc = readFileSync("src/components/home/HomePage.tsx", "utf8");
assert.match(homePageSrc, /MonthSelector/, "HomePage renders the shared MonthSelector");
assert.match(homePageSrc, /listBtcSellRecordsByMonth\(selectedMonth\)/, "HomePage loads monthly sell records for the completed sell card");
assert.match(homePageSrc, /onEditRecord=\{\(record\) => setSellModalState\(\{ mode: "edit", record \}\)\}/, "HomePage opens the sell edit modal from the completed sell card");
assert.match(homePageSrc, /onRecordsChanged=\{refreshAfterSellChange\}/, "HomePage refreshes after completed-card record deletion");
assert.doesNotMatch(homePageSrc, /handleDeleteSellRecord|onDeleteRecord/, "HomePage does not carry duplicate delete logic for the completed-card records");
const monthSelectorSrc = readFileSync("src/components/common/MonthSelector.tsx", "utf8");
assert.match(monthSelectorSrc, /getMonthLabel|getCurrentMonthLabel/, "MonthSelector uses month label utility");
const monthSrc = readFileSync("src/lib/month.ts", "utf8");
assert.match(monthSrc, /getCurrentMonthLabel/, "month.ts exports getCurrentMonthLabel");
assert.match(monthSrc, /getCurrentMonthKey/, "month.ts exports getCurrentMonthKey");
assert.match(monthSrc, /new Date/, "month utilities use current date");

console.log("verify:sell-records passed");
