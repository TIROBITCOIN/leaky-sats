import assert from "node:assert/strict";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import ts from "typescript";

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

// 4. 실제 settlement.ts를 실행해 1~31일, 월말 fallback, 윤년과 정산월 역산을 검증한다.
const monthSrc = read("src/lib/month.ts");
const compilerOptions = { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 };
const compiledMonth = ts.transpileModule(monthSrc, { compilerOptions }).outputText;
const monthModuleUrl = `data:text/javascript;base64,${Buffer.from(compiledMonth).toString("base64")}`;
const compiledSettlement = ts
  .transpileModule(settlementSrc, { compilerOptions })
  .outputText.replace('"./month"', `"${monthModuleUrl}"`);
const settlementModuleUrl = `data:text/javascript;base64,${Buffer.from(compiledSettlement).toString("base64")}`;
const settlement = await import(settlementModuleUrl);

assert.equal(settlement.normalizeSettlementDay(31), 31, "settlement day 31 is valid");
assert.equal(settlement.normalizeSettlementDay(32), 1, "settlement day above 31 falls back to 1");
assert.equal(settlement.normalizeSettlementDay(0), 1, "settlement day below 1 falls back to 1");
assert.equal(settlement.getEffectiveDayInMonth("2026-01", 31), 31, "January keeps the 31st");
assert.equal(settlement.getEffectiveDayInMonth("2026-02", 31), 28, "common-year February falls back to 28");
assert.equal(settlement.getEffectiveDayInMonth("2028-02", 31), 29, "leap-year February falls back to 29");
assert.equal(settlement.getEffectiveDayInMonth("2026-04", 31), 30, "April falls back to 30");

const period17 = settlement.getSettlementPeriod("2026-07", 17);
assert.equal(period17.startDate, "2026-06-17", "settlementDay=17: 2026-07 period starts 2026-06-17");
assert.equal(period17.endDate, "2026-07-16", "settlementDay=17: 2026-07 period ends 2026-07-16");
const period1 = settlement.getSettlementPeriod("2026-07", 1);
assert.equal(period1.startDate, "2026-07-01", "settlementDay=1: 2026-07 period starts 2026-07-01 (calendar month)");
assert.equal(period1.endDate, "2026-07-31", "settlementDay=1: 2026-07 period ends 2026-07-31 (calendar month)");

assert.deepEqual(
  (({ startDate, endDate }) => ({ startDate, endDate }))(settlement.getSettlementPeriod("2026-02", 31)),
  { startDate: "2026-01-31", endDate: "2026-02-27" },
  "31st: February settlement uses valid month-end boundaries"
);
assert.deepEqual(
  (({ startDate, endDate }) => ({ startDate, endDate }))(settlement.getSettlementPeriod("2026-03", 31)),
  { startDate: "2026-02-28", endDate: "2026-03-30" },
  "31st: March settlement starts at February month end"
);
assert.deepEqual(
  (({ startDate, endDate }) => ({ startDate, endDate }))(settlement.getSettlementPeriod("2028-03", 31)),
  { startDate: "2028-02-29", endDate: "2028-03-30" },
  "31st: leap-year March settlement starts February 29"
);
assert.deepEqual(
  (({ startDate, endDate }) => ({ startDate, endDate }))(settlement.getSettlementPeriod("2026-04", 31)),
  { startDate: "2026-03-31", endDate: "2026-04-29" },
  "31st: April settlement ends before April month end"
);
assert.deepEqual(
  (({ startDate, endDate }) => ({ startDate, endDate }))(settlement.getSettlementPeriod("2027-01", 31)),
  { startDate: "2026-12-31", endDate: "2027-01-30" },
  "31st: January settlement crosses the year boundary safely"
);
assert.deepEqual(
  (({ startDate, endDate }) => ({ startDate, endDate }))(settlement.getSettlementPeriod("2026-03", 30)),
  { startDate: "2026-02-28", endDate: "2026-03-29" },
  "30th: March settlement starts at February month end"
);
assert.deepEqual(
  (({ startDate, endDate }) => ({ startDate, endDate }))(settlement.getSettlementPeriod("2026-03", 29)),
  { startDate: "2026-02-28", endDate: "2026-03-28" },
  "29th: common-year March settlement starts February 28"
);
assert.equal(
  settlement.getSettlementMonthKeyForDate("2026-02-27T12:00", 31),
  "2026-02",
  "February 27 stays in February settlement for a 31st boundary"
);
assert.equal(
  settlement.getSettlementMonthKeyForDate("2026-02-28T12:00", 31),
  "2026-03",
  "February 28 moves to March settlement for a 31st boundary"
);
assert.equal(
  settlement.getSettlementMonthKeyForDate("2026-03-31T12:00", 31),
  "2026-04",
  "March 31 moves to April settlement"
);

// 5. SettingsPage에 "정산 기준일" 문구 존재
const settingsSrc = read("src/components/settings/SettingsPage.tsx");
assert.match(settingsSrc, /정산 기준일/, "SettingsPage has 정산 기준일 setting");
assert.match(settingsSrc, /Array\.from\(\{ length: 31 \}/, "SettingsPage offers settlement days through the 31st");
assert.match(settingsSrc, /29~31일.*말일/, "SettingsPage explains month-end fallback");

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

// 22. DCA 매수/판매 용어 확인
assert.doesNotMatch(combinedComponents, /BTC 매도/, "BTC 매도 not reintroduced");
const categoriesSrcForTerms = read("src/lib/categories.ts");
const majorItemsSrcForTerms = read("src/lib/majorItems.ts");
const combinedWithLabels = combinedComponents + categoriesSrcForTerms + majorItemsSrcForTerms;
assert.match(combinedWithLabels, /DCA \/ BTC 매수/, "DCA / BTC 매수 label is present");
assert.match(combinedWithLabels, /BTC 판매/, "BTC 판매 label still present");

console.log("verify:settlement-sale-ux passed");
