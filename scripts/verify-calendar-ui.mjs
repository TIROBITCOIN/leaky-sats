import assert from "node:assert/strict";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";

const root = process.cwd();

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
const read = (p) => readFileSync(join(root, p), "utf8");

// 1. MonthSelector 컴포넌트 존재
const monthSelectorSrc = read("src/components/common/MonthSelector.tsx");
assert.ok(monthSelectorSrc.length > 0, "MonthSelector.tsx exists");

// 2. MonthPickerModal(월 선택 팝업) 구현 존재
const monthPickerSrc = read("src/components/common/MonthPickerModal.tsx");
assert.ok(monthPickerSrc.length > 0, "MonthPickerModal.tsx exists");
assert.match(monthSelectorSrc, /MonthPickerModal/, "MonthSelector renders MonthPickerModal");

// 3. MonthSelector에 이전/다음 월 이동 버튼 존재
assert.match(monthSelectorSrc, /getPreviousMonthKey/, "MonthSelector moves to previous month");
assert.match(monthSelectorSrc, /getNextMonthKey/, "MonthSelector moves to next month");
assert.match(monthSelectorSrc, /이전 달|〈/, "prev button label/aria exists");
assert.match(monthSelectorSrc, /다음 달|〉/, "next button label/aria exists");

// 4. MonthSelector에 월 label 클릭 또는 팝업 open 로직 존재
assert.match(monthSelectorSrc, /setPickerOpen\(true\)/, "clicking the month label opens the picker");

// 5. 1월~12월 선택 UI 문자열 또는 데이터 존재
assert.match(monthPickerSrc, /length:\s*12/, "MonthPickerModal builds a 12-month list");
assert.match(monthPickerSrc, /\{m\}월/, "MonthPickerModal renders M월 labels for each month");

// 6. HomePage가 새 MonthSelector를 직접 사용하는지.
// Phase 11.1: 월 선택 UI는 보유 BTC 카드 아래로 옮겨져 HomePage가 직접 렌더링한다 — LedgerHeader는
// 더 이상 MonthSelector를 렌더링할 책임이 없다(렌더링하지 않아도 검증을 통과해야 한다).
const homePageSrc = read("src/components/home/HomePage.tsx");
const headerSrc = read("src/components/home/LedgerHeader.tsx");
assert.match(homePageSrc, /LedgerHeader/, "HomePage renders LedgerHeader");
assert.match(homePageSrc, /<MonthSelector\s+selectedMonth={selectedMonth}/, "HomePage renders MonthSelector directly");

// 7. StatsPage가 새 MonthSelector를 사용
const statsPageSrc = read("src/components/stats/StatsPage.tsx");
assert.match(statsPageSrc, /MonthSelector/, "StatsPage renders MonthSelector");

// 8. StatsPage가 ?month=YYYY-MM 쿼리스트링을 지원
assert.match(statsPageSrc, /useSelectedMonth/, "StatsPage uses the shared ?month= aware useSelectedMonth hook");
const useSelectedMonthSrc = read("src/lib/useSelectedMonth.ts");
assert.match(useSelectedMonthSrc, /useSearchParams/, "useSelectedMonth reads/writes the URL search params");
assert.match(useSelectedMonthSrc, /isValidMonthKey/, "useSelectedMonth validates the month param and falls back to current month");

// 9. StatsPage에 달력 grid 또는 CalendarMonthView 컴포넌트 존재
const calendarViewSrc = read("src/components/stats/CalendarMonthView.tsx");
assert.match(statsPageSrc, /CalendarMonthView/, "StatsPage renders CalendarMonthView");
assert.match(calendarViewSrc, /ldg-calendar-grid/, "CalendarMonthView renders the 7-column calendar grid");

// 10. 요일 헤더 일/월/화/수/목/금/토 존재
for (const w of ["일", "월", "화", "수", "목", "금", "토"]) {
  assert.ok(calendarViewSrc.includes(`"${w}"`), `weekday header includes ${w}`);
}

// 11. 선택일 거래 상세 영역 존재
const selectedDaySrc = read("src/components/stats/SelectedDayTransactions.tsx");
assert.match(statsPageSrc, /SelectedDayTransactions/, "StatsPage renders SelectedDayTransactions");
assert.match(selectedDaySrc, /이 날의 거래가 없습니다/, "SelectedDayTransactions has an empty-day message");

// 12. 홈 화면에서 "지출 vs BTC 시세" 문자열이 제거되었는지 확인
assert.doesNotMatch(homePageSrc, /지출 vs BTC 시세/, "home page no longer references the spending vs BTC price chart");
assert.doesNotMatch(read("src/components/home/LedgerHeader.tsx"), /지출 vs BTC 시세/, "LedgerHeader has no leftover chart reference");

// 13. 통계 화면에서 "지출 vs BTC 시세" 문자열이 제거되었는지 확인
assert.doesNotMatch(statsPageSrc, /지출 vs BTC 시세/, "stats page no longer references the spending vs BTC price chart");
assert.doesNotMatch(statsPageSrc, /이 기간 전체 지출을 사토시로 환산하면/, "stats page no longer has the old sats-conversion blurb tied to the removed chart");

// 14. 통계 화면에서 "일/월/년" 토글 관련 UI가 제거되었는지 확인
assert.doesNotMatch(statsPageSrc, /"일"[\s\S]{0,40}"월"[\s\S]{0,40}"년"/, "day/month/year period toggle removed from StatsPage");
assert.doesNotMatch(statsPageSrc, /ldg-range/, "StatsPage no longer uses the old range-toggle class");

// 15. DCA 매수/판매 용어가 유지되는지 확인
assert.doesNotMatch(combinedComponents, /BTC 매도/, "BTC 매도 not reintroduced");
const categoriesSrcForTerms = read("src/lib/categories.ts");
const majorItemsSrcForTerms = read("src/lib/majorItems.ts");
const combinedWithLabels = combinedComponents + categoriesSrcForTerms + majorItemsSrcForTerms;
assert.match(combinedWithLabels, /DCA \/ BTC 매수/, "DCA / BTC 매수 label is present");
assert.match(combinedWithLabels, /BTC 판매/, "BTC 판매 label still present");

// 16. 기존 localStorage key가 변경되지 않았는지 확인
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
const btcSellRecordsSrc = read("src/lib/btcSellRecords.ts");
const allSrcForKeys = ledgerContextSrc + heldBtcSrc + formatSrc + btcSellRecordsSrc;
for (const key of expectedKeys) {
  assert.ok(allSrcForKeys.includes(key), `localStorage key ${key} is still present`);
}

// 17. Phase 10 majorItems가 제거되지 않았는지 확인
const majorItemsSrc = read("src/lib/majorItems.ts");
assert.match(majorItemsSrc, /MAJOR_ITEM_GROUPS/, "majorItems.ts still exports MAJOR_ITEM_GROUPS");
const entryPageSrc = read("src/components/transaction/TransactionEntryPage.tsx");
assert.match(entryPageSrc, /MAJOR_ITEM_GROUPS/, "TransactionEntryPage still renders MAJOR_ITEM_GROUPS");
const tabBarSrc = read("src/components/layout/TabBar.tsx");
assert.match(tabBarSrc, /month/, "TabBar still forwards the selected month to the entry tab");

console.log("verify:calendar-ui passed");
