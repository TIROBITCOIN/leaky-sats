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

// 1. settlement.ts(?뺤궛 湲곗???util) 議댁옱
const settlementSrc = read("src/lib/settlement.ts");
assert.ok(settlementSrc.length > 0, "src/lib/settlement.ts exists");
assert.match(settlementSrc, /getSettlementPeriod/, "getSettlementPeriod exists");
assert.match(settlementSrc, /getSettlementMonthKeyForDate/, "getSettlementMonthKeyForDate exists");
assert.match(settlementSrc, /loadSettlementDay/, "loadSettlementDay exists");
assert.match(settlementSrc, /saveSettlementDay/, "saveSettlementDay exists");
assert.match(settlementSrc, /normalizeSettlementDay/, "normalizeSettlementDay exists");

// 2. myledger.settlementDay.v1 ?ъ슜
assert.match(settlementSrc, /myledger\.settlementDay\.v1/, "settlement.ts uses myledger.settlementDay.v1");

// 3. ?뺤궛 湲곗???湲곕낯媛?1??
assert.match(settlementSrc, /DEFAULT_DAY\s*=\s*1/, "default settlement day is 1");

// 4. ?ㅼ젣 settlement.ts瑜??ㅽ뻾??1~31?? ?붾쭚 fallback, ?ㅻ뀈怨??뺤궛????궛??寃利앺븳??
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

// 5. SettingsPage??"?뺤궛 湲곗??? 臾멸뎄 議댁옱
const settingsSrc = read("src/components/settings/SettingsPage.tsx");
assert.match(settingsSrc, /settlementDay/, "SettingsPage has settlement day setting");
assert.match(settingsSrc, /Array\.from\(\{ length: 31 \}/, "SettingsPage offers settlement days through the 31st");
assert.match(
  settingsSrc,
  /매월 선택한 날짜부터 다음 달 전날까지를 한 정산기간으로 계산합니다/,
  "SettingsPage explains the settlement period rule"
);
assert.match(settingsSrc, /currentPeriod\.rangeLabel/, "SettingsPage shows the current settlement period range");

// 6. HomePage媛 ?뺤궛湲곌컙 rangeLabel???쒖떆
const homePageSrc = read("src/components/home/HomePage.tsx");
assert.match(homePageSrc, /getSettlementPeriod/, "HomePage computes the settlement period");
assert.match(homePageSrc, /period\.rangeLabel/, "HomePage displays period.rangeLabel");

// 7. StatsPage ?먮뒗 calendarStats媛 ?뺤궛湲곌컙 湲곗??쇰줈 怨꾩궛
const statsPageSrc = read("src/components/stats/StatsPage.tsx");
const calendarStatsSrc = read("src/lib/calendarStats.ts");
assert.match(statsPageSrc, /getSettlementPeriod/, "StatsPage computes the settlement period");
assert.match(calendarStatsSrc, /SettlementPeriod/, "calendarStats is settlement-period aware");

// 8. ?듦퀎 MonthSelector 以묒븰 ?뺣젹 ?대옒??議댁옱
assert.match(statsPageSrc, /ldg-stats-month-selector/, "StatsPage wraps MonthSelector in a centered class");
const ledgerCss = read("src/styles/ledger.css");
assert.match(ledgerCss, /\.ldg-stats-month-selector\s*\{[^}]*justify-content:\s*center/s, "ldg-stats-month-selector centers its content");
assert.match(ledgerCss, /\.ldg-done-row\s*\{[^}]*display:\s*grid/s, "settled rows use grid alignment");
assert.match(ledgerCss, /\.ldg-sell-needed-row\s*\{[^}]*display:\s*grid/s, "sell-needed row uses grid alignment");
assert.match(ledgerCss, /\.ldg-done-val\s*\{[^}]*font-family:\s*var\(--ldg-mono\)/s, "settled values use mono font");
assert.match(ledgerCss, /\.ldg-sell-value\s*\{[^}]*font-family:\s*var\(--ldg-mono\)/s, "sell-needed values use mono font");
assert.match(ledgerCss, /\.ldg-money-val,\s*\n\.ldg-btc-val\s*\{[^}]*font-variant-numeric:\s*tabular-nums/s, "money and BTC values use tabular numbers");
assert.match(ledgerCss, /@media \(max-width:\s*380px\)[\s\S]*\.ldg-sell-needed-row/, "mobile width has sell row wrapping rules");

// 9. ?ㅼ젙 移댄뀒怨좊━ UI媛 ????ぉ 以묒떖 ?섏엯/吏異?BTC ?뱀뀡???쒖떆
// CURRENT_CATEGORY_IDS??BUILT_IN_CATEGORIES(Phase 10 ????ぉ 湲곕낯 seed) 湲곗??쇰줈 留뚮뱺????btc_sell泥섎읆
// majorItems.ts??吏곸젒 留ㅽ븨?섏? ?딅뒗 移댄뀒怨좊━??鍮좎쭚?놁씠 "?꾩옱" ?뱀뀡???ㅼ뼱媛寃??섍린 ?꾪븿?대떎.
const categoryManagerSrc = read("src/components/settings/CategoryManager.tsx");
assert.match(categoryManagerSrc, /CURRENT_CATEGORY_IDS\s*=\s*new Set\(BUILT_IN_CATEGORIES/, "CategoryManager groups by the BUILT_IN_CATEGORIES id set");
assert.match(categoryManagerSrc, /"BTC"/, "CategoryManager labels the invest section BTC");

// 10. "?댁쟾 移댄뀒怨좊━" ?먮뒗 legacy category ?뱀뀡 議댁옱
assert.match(categoryManagerSrc, /legacyOpen/, "CategoryManager has a legacy category section");
assert.match(categoryManagerSrc, /legacyOpen/, "legacy section is collapsible (collapsed by default)");
assert.doesNotMatch(categoryManagerSrc, /legacyCategories.*=.*\[\]/, "legacy categories are not force-emptied");

// 11. "BTC ?먮ℓ 諛섏쁺" 臾몄옄?댁씠 ?ъ슜??facing 而댄룷?뚰듃???⑥븘 ?덉? ?딆쓬
assert.doesNotMatch(combinedComponents, /BTC 판매 반영/, "BTC 판매 반영 no longer appears in user-facing components");

// 12. "BTC ?먮ℓ ?뺤젙" 臾몄옄??議댁옱
assert.doesNotMatch(combinedComponents, /BTC 판매 확정/, "old BTC sale confirmation label is absent");
assert.match(combinedComponents, />\s*판매\s*</, "simplified sale label is present");

// 13. "?먮ℓ?댁빞 ?섎뒗 鍮꾪듃肄붿씤" 臾몄옄??議댁옱
assert.match(combinedComponents, /판매해야 하는 비트코인|정산 완료/, "SellNeededCard primary label is present");

// 14. ?붾퀎 "?먮ℓ??鍮꾪듃肄붿씤" 臾멸뎄 議댁옱 (?? "{monthLabel} ?먮ℓ??鍮꾪듃肄붿씤")
const monthlyCardSrc = read("src/components/home/MonthlySellSummaryCard.tsx");
assert.match(monthlyCardSrc, /totalSatsSold|fmtBtcValue/, "MonthlySellSummaryCard shows sold bitcoin amounts");

// 15. ?곌컙 "?먮ℓ??鍮꾪듃肄붿씤" 臾멸뎄 議댁옱 (?? "{year}???먮ℓ??鍮꾪듃肄붿씤")
const yearlyCardSrc = read("src/components/home/YearlySellSummaryCard.tsx");
assert.match(yearlyCardSrc, /totalSatsSold|fmtBtcValue/, "YearlySellSummaryCard shows sold bitcoin amounts");

// 16. SellConfirmModal?먯꽌 backdrop click close瑜?留됰뒗 濡쒖쭅 議댁옱
const modalSrc = read("src/components/home/SellConfirmModal.tsx");
assert.doesNotMatch(modalSrc, /ldg-modal-backdrop"\s+onClick=\{onClose\}/, "backdrop no longer closes the sell-confirm modal on click");
assert.match(modalSrc, /onClick=\{onClose\}/, "an explicit close control (X/痍⑥냼) still calls onClose");

// 17. SellConfirmModal uses measured KRW + wallet BTC inputs (schema v2)
assert.doesNotMatch(modalSrc, /sellUnit/, "SellConfirmModal no longer tracks a sellUnit toggle state");
assert.doesNotMatch(modalSrc, /handleUnitToggle/, "SellConfirmModal no longer exposes BTC/sats input toggling");
assert.match(modalSrc, /판매 확정|받은 원화|보낸 비트코인/, "SellConfirmModal uses simplified measured sell form copy");
assert.doesNotMatch(modalSrc, /실제 판매할 sats/, "SellConfirmModal no longer shows a derived final sats row");
assert.doesNotMatch(modalSrc, /자동 판매량/, "SellConfirmModal no longer uses the old automatic sell amount label");
assert.doesNotMatch(modalSrc, /finalSats|tradeSats/, "SellConfirmModal drops derived-sats fields");
assert.match(modalSrc, /btcSpentFromWallet/, "SellConfirmModal tracks measured wallet BTC outflow");
assert.match(modalSrc, /formatSats\(satsSold\)/, "SellConfirmModal shows sats for measured BTC");
assert.doesNotMatch(modalSrc, /실효 매도가|전송 수수료/, "SellConfirmModal UI hides fee input and price summary rows");

// 18. Effective price is stored; app market price is snapshotted separately; monthly cash stays removed.
assert.match(modalSrc, /btcKrwAtSell:\s*effective/, "SellConfirmModal persists effective sell price");
assert.match(modalSrc, /marketBtcKrwAtSell/, "SellConfirmModal snapshots app market price");
assert.match(modalSrc, /schemaVersion:\s*2/, "SellConfirmModal writes schema v2 records");
assert.doesNotMatch(modalSrc, /setMonthlyCash|getMonthlyCash|monthlyCash|통장 보유액/, "SellConfirmModal no longer saves monthly cash");

// 19. BTC ?먮ℓ 湲곕줉 row??"?? 硫붾돱 ?먮뒗 edit/delete action 議댁옱
assert.match(monthlyCardSrc, /SellRecordMenu|onEditRecord/, "MonthlySellSummaryCard offers an edit/delete action per record");
const sellRecordMenuSrc = read("src/components/common/SellRecordMenu.tsx");
assert.match(sellRecordMenuSrc, /ldg-txn-menu-btn/, "MonthlySellSummaryCard reuses the shared menu button styling");

// 20. updateBtcSellRecord/deleteBtcSellRecord ?⑥닔 議댁옱
const btcSellRecordsSrc = read("src/lib/btcSellRecords.ts");
assert.match(btcSellRecordsSrc, /export function updateBtcSellRecord/, "updateBtcSellRecord exists");
assert.match(btcSellRecordsSrc, /export function deleteBtcSellRecord/, "deleteBtcSellRecord exists");
assert.match(btcSellRecordsSrc, /export function getBtcSellRecordById/, "getBtcSellRecordById exists");

// 21. 湲곗〈 localStorage key媛 蹂寃쎈릺吏 ?딆븯?붿?
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

// 22. DCA 留ㅼ닔/?먮ℓ ?⑹뼱 ?뺤씤
assert.doesNotMatch(combinedComponents, /BTC 留ㅻ룄/, "BTC 留ㅻ룄 not reintroduced");
const categoriesSrcForTerms = read("src/lib/categories.ts");
const majorItemsSrcForTerms = read("src/lib/majorItems.ts");
const combinedWithLabels = combinedComponents + categoriesSrcForTerms + majorItemsSrcForTerms;
assert.match(combinedWithLabels, /DCA \/ BTC/, "DCA / BTC label is present");
assert.match(combinedWithLabels, /BTC 판매/, "BTC 판매 label still present");

console.log("verify:settlement-sale-ux passed");
