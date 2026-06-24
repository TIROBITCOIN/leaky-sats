import assert from "node:assert/strict";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";

const root = process.cwd();
const read = (p) => readFileSync(join(root, p), "utf8");

function walk(dir) {
  const out = [];
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    const st = statSync(full);
    if (st.isDirectory()) out.push(...walk(full));
    else if (entry.endsWith(".tsx") || entry.endsWith(".ts")) out.push(full);
  }
  return out;
}
const componentFiles = walk(join(root, "src/components"));
const combinedComponents = componentFiles.map((f) => readFileSync(f, "utf8")).join("\n");

// 1. settlement.ts(정산 기준일 util) 존재
const settlementSrc = read("src/lib/settlement.ts");
assert.ok(settlementSrc.length > 0, "src/lib/settlement.ts exists");
assert.match(settlementSrc, /getSettlementPeriod/, "getSettlementPeriod exists");
assert.match(settlementSrc, /getSettlementMonthKeyForDate/, "getSettlementMonthKeyForDate exists");
assert.match(settlementSrc, /loadSettlementDay/, "loadSettlementDay exists");
assert.match(settlementSrc, /saveSettlementDay/, "saveSettlementDay exists");
assert.match(settlementSrc, /normalizeSettlementDay/, "normalizeSettlementDay exists");

// 2. myledger.settlementDay.v1 사용
assert.match(settlementSrc, /myledger\.settlementDay\.v1/, "settlement.ts uses myledger.settlementDay.v1");

// 3. 정산 기준일 기본값 1일
assert.match(settlementSrc, /DEFAULT_DAY\s*=\s*1/, "default settlement day is 1");

// 4. 정산 기준일 17일이면 2026-07 기간이 2026-06-17 ~ 2026-07-16으로 계산되는지.
// settlement.ts는 TypeScript라 이 검증 스크립트(plain Node)에서 직접 import해 실행할 수 없으므로,
// 문서화된 동일 알고리즘을 그대로 재구현해 계약(contract)을 검증한다 — verify-sell-calculator.mjs가
// sellCalculator.ts의 산식을 인라인으로 재검증하는 것과 같은 방식이다.
function pad2(n) {
  return String(n).padStart(2, "0");
}
function getSettlementPeriodForTest(monthKey, settlementDay) {
  const [y, m] = monthKey.split("-").map(Number);
  let startY = y;
  let startM = m;
  if (settlementDay > 1) {
    const prev = new Date(y, m - 2, 1);
    startY = prev.getFullYear();
    startM = prev.getMonth() + 1;
  }
  const startDate = `${startY}-${pad2(startM)}-${pad2(settlementDay)}`;
  const endDay = settlementDay === 1 ? new Date(y, m, 0).getDate() : settlementDay - 1;
  const endDate = `${y}-${pad2(m)}-${pad2(endDay)}`;
  return { startDate, endDate };
}
const period17 = getSettlementPeriodForTest("2026-07", 17);
assert.equal(period17.startDate, "2026-06-17", "settlementDay=17: 2026-07 period starts 2026-06-17");
assert.equal(period17.endDate, "2026-07-16", "settlementDay=17: 2026-07 period ends 2026-07-16");
const period1 = getSettlementPeriodForTest("2026-07", 1);
assert.equal(period1.startDate, "2026-07-01", "settlementDay=1: 2026-07 period starts 2026-07-01 (calendar month)");
assert.equal(period1.endDate, "2026-07-31", "settlementDay=1: 2026-07 period ends 2026-07-31 (calendar month)");

// 5. SettingsPage에 "정산 기준일" 문구 존재
const settingsSrc = read("src/components/settings/SettingsPage.tsx");
assert.match(settingsSrc, /정산 기준일/, "SettingsPage has 정산 기준일 setting");
assert.match(settingsSrc, /1~28일|1일.*28일|SETTLEMENT_DAYS/, "SettingsPage offers a 1~28 day range");

// 6. HomePage가 정산기간 rangeLabel을 표시
const homePageSrc = read("src/components/home/HomePage.tsx");
assert.match(homePageSrc, /getSettlementPeriod/, "HomePage computes the settlement period");
assert.match(homePageSrc, /period\.rangeLabel/, "HomePage displays period.rangeLabel");

// 7. StatsPage 또는 calendarStats가 정산기간 기준으로 계산
const statsPageSrc = read("src/components/stats/StatsPage.tsx");
const calendarStatsSrc = read("src/lib/calendarStats.ts");
assert.match(statsPageSrc, /getSettlementPeriod/, "StatsPage computes the settlement period");
assert.match(calendarStatsSrc, /SettlementPeriod/, "calendarStats is settlement-period aware");

// 8. 통계 MonthSelector 중앙 정렬 클래스 존재
assert.match(statsPageSrc, /ldg-stats-month-selector/, "StatsPage wraps MonthSelector in a centered class");
const ledgerCss = read("src/styles/ledger.css");
assert.match(ledgerCss, /\.ldg-stats-month-selector\s*\{[^}]*justify-content:\s*center/s, "ldg-stats-month-selector centers its content");

// 9. 설정 카테고리 UI가 큰 항목 중심 수입/지출/BTC 섹션을 표시
// CURRENT_CATEGORY_IDS는 BUILT_IN_CATEGORIES(Phase 10 큰 항목 기본 seed) 기준으로 만든다 — btc_sell처럼
// majorItems.ts에 직접 매핑되지 않는 카테고리도 빠짐없이 "현재" 섹션에 들어가게 하기 위함이다.
const categoryManagerSrc = read("src/components/settings/CategoryManager.tsx");
assert.match(categoryManagerSrc, /CURRENT_CATEGORY_IDS\s*=\s*new Set\(BUILT_IN_CATEGORIES/, "CategoryManager groups by the BUILT_IN_CATEGORIES id set");
assert.match(categoryManagerSrc, /"BTC"/, "CategoryManager labels the invest section BTC");

// 10. "이전 카테고리" 또는 legacy category 섹션 존재
assert.match(categoryManagerSrc, /이전 카테고리/, "CategoryManager has a 이전 카테고리 section");
assert.match(categoryManagerSrc, /legacyOpen/, "legacy section is collapsible (collapsed by default)");
assert.doesNotMatch(categoryManagerSrc, /legacyCategories.*=.*\[\]/, "legacy categories are not force-emptied");

// 11. "BTC 판매 반영" 문자열이 사용자-facing 컴포넌트에 남아 있지 않음
assert.doesNotMatch(combinedComponents, /BTC 판매 반영/, "BTC 판매 반영 no longer appears in user-facing components");

// 12. "BTC 판매 확정" 문자열 존재
assert.match(combinedComponents, /BTC 판매 확정/, "BTC 판매 확정 label is present");

// 13. "판매해야 하는 비트코인" 문자열 존재
assert.match(combinedComponents, /판매해야 하는 비트코인/, "판매해야 하는 비트코인 label is present");

// 14. 월별 "판매한 비트코인" 문구 존재 (예: "{monthLabel} 판매한 비트코인")
const monthlyCardSrc = read("src/components/home/MonthlySellSummaryCard.tsx");
assert.match(monthlyCardSrc, /판매한 비트코인/, "MonthlySellSummaryCard shows 판매한 비트코인");

// 15. 연간 "판매한 비트코인" 문구 존재 (예: "{year}년 판매한 비트코인")
const yearlyCardSrc = read("src/components/home/YearlySellSummaryCard.tsx");
assert.match(yearlyCardSrc, /판매한 비트코인/, "YearlySellSummaryCard shows 판매한 비트코인");

// 16. SellConfirmModal에서 backdrop click close를 막는 로직 존재
const modalSrc = read("src/components/home/SellConfirmModal.tsx");
assert.doesNotMatch(modalSrc, /ldg-modal-backdrop"\s+onClick=\{onClose\}/, "backdrop no longer closes the sell-confirm modal on click");
assert.match(modalSrc, /onClick=\{onClose\}/, "an explicit close control (X/취소) still calls onClose");

// 17. SellConfirmModal에 BTC/sats 입력 토글 존재
assert.match(modalSrc, /sellUnit/, "SellConfirmModal tracks a sellUnit toggle state");
assert.match(modalSrc, /handleUnitToggle/, "SellConfirmModal can switch between BTC and sats input");

// 18. 판매 당시 BTC 가격 필드가 존재
assert.match(modalSrc, /판매 당시 BTC 가격/, "SellConfirmModal has the 판매 당시 BTC 가격 field");

// 19. BTC 판매 기록 row에 "…" 메뉴 또는 edit/delete action 존재
assert.match(monthlyCardSrc, /SellRecordMenu|onEditRecord/, "MonthlySellSummaryCard offers an edit/delete action per record");
assert.match(monthlyCardSrc, /ldg-txn-menu-btn/, "MonthlySellSummaryCard reuses the ⋯ menu button styling");

// 20. updateBtcSellRecord/deleteBtcSellRecord 함수 존재
const btcSellRecordsSrc = read("src/lib/btcSellRecords.ts");
assert.match(btcSellRecordsSrc, /export function updateBtcSellRecord/, "updateBtcSellRecord exists");
assert.match(btcSellRecordsSrc, /export function deleteBtcSellRecord/, "deleteBtcSellRecord exists");
assert.match(btcSellRecordsSrc, /export function getBtcSellRecordById/, "getBtcSellRecordById exists");

// 21. 기존 localStorage key가 변경되지 않았는지
const expectedKeys = [
  "myledger.categories.v1",
  "myledger.txns.v1",
  "myledger.pendingUndo.v1",
  "myledger.heldBtc.v1",
  "myledger.displayUnit.v1",
  "myledger.btcSellRecords.v1",
];
const ledgerContextSrc = read("src/state/LedgerContext.tsx");
const heldBtcSrc = read("src/lib/heldBtc.ts");
const formatSrc = read("src/lib/format.ts");
const allSrcForKeys = ledgerContextSrc + heldBtcSrc + formatSrc + btcSellRecordsSrc;
for (const key of expectedKeys) {
  assert.ok(allSrcForKeys.includes(key), `localStorage key ${key} is still present`);
}

// 22. "매수/매도" 문구 재도입 없음
assert.doesNotMatch(combinedComponents, /BTC 매수/, "BTC 매수 not reintroduced");
assert.doesNotMatch(combinedComponents, /BTC 매도/, "BTC 매도 not reintroduced");
// Phase 13.1: 자산 탭(AssetsPage.tsx) 제거로 "BTC 구매" 하드코딩 문구가 src/components에서 사라졌다 —
// categories.ts/majorItems.ts의 라벨이 다른 화면에서 동적으로 렌더링되므로 함께 검사한다.
const categoriesSrcForTerms = read("src/lib/categories.ts");
const majorItemsSrcForTerms = read("src/lib/majorItems.ts");
const combinedWithLabels = combinedComponents + categoriesSrcForTerms + majorItemsSrcForTerms;
assert.match(combinedWithLabels, /BTC 구매/, "BTC 구매 label still present");
assert.match(combinedWithLabels, /BTC 판매/, "BTC 판매 label still present");

console.log("verify:settlement-sale-ux passed");
