import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const read = (path) => readFileSync(path, "utf8");

const ledgerHeader = read("src/components/home/LedgerHeader.tsx");
const ledgerCss = read("src/styles/ledger.css");
const homePage = read("src/components/home/HomePage.tsx");
const statsPage = read("src/components/stats/StatsPage.tsx");
const inOutCards = read("src/components/home/InOutCards.tsx");
const currencyToggle = read("src/components/home/CurrencyToggle.tsx");
const tabBar = read("src/components/layout/TabBar.tsx");

// 1. Block height is plain text, not an animated dot badge.
assert.match(
  ledgerHeader,
  /block height : \{d\.blockHeight\.toLocaleString\("en-US"\)\}/,
  "LedgerHeader renders block height as plain text with a spaced colon"
);
assert.doesNotMatch(ledgerHeader, /ldg-block-dot|#\{d\.blockHeight/, "LedgerHeader removes the dot and # prefix");
assert.doesNotMatch(ledgerCss, /ldg-block-dot|@keyframes\s+ldg-pulse|animation:\s*ldg-pulse/, "unused pulse dot CSS is removed");

// 2. Home and stats month selector labels show only the settlement range.
assert.match(
  homePage,
  /<MonthSelector\s+selectedMonth=\{selectedMonth\}\s+onChangeMonth=\{setSelectedMonth\}\s+label=\{period\.rangeLabel\}\s*\/>/,
  "HomePage passes period.rangeLabel to MonthSelector"
);
assert.match(
  statsPage,
  /<MonthSelector\s+selectedMonth=\{selectedMonth\}\s+onChangeMonth=\{setSelectedMonth\}\s+label=\{period\.rangeLabel\}\s*\/>/,
  "StatsPage passes period.rangeLabel to MonthSelector"
);
assert.doesNotMatch(homePage, /ldg-settlement-range-label|label=\{period\.label\}/, "HomePage removes duplicated settlement range label");
assert.doesNotMatch(statsPage, /ldg-settlement-range-label|label=\{period\.label\}/, "StatsPage removes duplicated settlement range label");
assert.match(ledgerCss, /\.ldg-month-selector-label[\s\S]*font-size:\s*clamp\(16px,\s*4\.4vw,\s*21px\)/, "month selector label is readable without over-growing");
assert.match(ledgerCss, /\.ldg-month-selector-label[\s\S]*font-weight:\s*750/, "month selector label weight is slightly stronger");

// 3. Net amount card no longer repeats the explanatory helper copy.
assert.doesNotMatch(inOutCards, /현재 정산기간 생활비 기준|ldg-tiny/, "net amount card removes the helper copy");

// 4. Stats summary columns and amount text stay on one line on narrow screens.
assert.match(
  ledgerCss,
  /\.ldg-calendar-summary\s*\{[\s\S]*grid-template-columns:\s*minmax\(0,\s*1fr\)\s+minmax\(0,\s*1fr\)\s+minmax\(0,\s*1fr\)/,
  "calendar summary grid tracks use minmax(0, 1fr)"
);
assert.match(ledgerCss, /\.ldg-calendar-summary\s*>\s*div\s*\{[\s\S]*min-width:\s*0/, "calendar summary cells may shrink");
assert.match(ledgerCss, /\.ldg-inout-main\s*\{[\s\S]*font-size:\s*clamp\(13px,\s*4\.2vw,\s*17px\)/, "in/out main amount font scales down on small screens");
assert.match(ledgerCss, /\.ldg-inout-main\s*\{[\s\S]*white-space:\s*nowrap/, "in/out main amount text does not wrap");

// 5. KRW/Bitcoin toggle text is not duplicated by glyphs.
assert.doesNotMatch(currencyToggle, /ldg-toggle-glyph|>원<|>₿</, "currency toggle removes KRW/BTC glyph spans");
assert.match(currencyToggle, />\s*KRW\s*</, "currency toggle keeps KRW text");
assert.match(currencyToggle, />\s*Bitcoin\s*</, "currency toggle keeps Bitcoin text");
assert.doesNotMatch(ledgerCss, /ldg-toggle-glyph/, "unused toggle glyph CSS is removed");

// 6. Settings tab uses a known balanced gear outline path.
assert.match(tabBar, /M12 15\.5A3\.5 3\.5 0 1 0 12 8a3\.5 3\.5 0 0 0 0 7\.5z/, "settings tab uses a balanced gear center path");
assert.match(tabBar, /strokeWidth="1\.8"/, "tab icons keep the existing visual stroke weight");

console.log("verify:t27-ui-polish passed");
