import assert from "node:assert/strict";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";

const root = process.cwd();
const read = (path) => readFileSync(join(root, path), "utf8");

function walk(dir) {
  const files = [];
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    const stat = statSync(full);
    if (stat.isDirectory()) files.push(...walk(full));
    else if (entry.endsWith(".tsx") || entry.endsWith(".ts")) files.push(full);
  }
  return files;
}

const sellNeeded = read("src/components/home/SellNeededCard.tsx");
const monthlySell = read("src/components/home/MonthlySellSummaryCard.tsx");
const yearlySell = read("src/components/home/YearlySellSummaryCard.tsx");
const balance = read("src/components/home/BalanceCard.tsx");
const price = read("src/components/home/PriceWidget.tsx");
const home = read("src/components/home/HomePage.tsx");
const tabBar = read("src/components/layout/TabBar.tsx");
const app = read("src/App.tsx");
const components = walk(join(root, "src", "components"))
  .map((file) => readFileSync(file, "utf8"))
  .join("\n");

assert.match(sellNeeded, /현재 BTC 가격 기준 예상 판매량입니다\./);
assert.match(sellNeeded, />예상</);
assert.match(sellNeeded, /이번 정산기간에는 판매가 필요하지 않습니다\./);
assert.match(monthlySell, /판매 확정한 기록 기준입니다\./);
assert.match(yearlySell, /판매 확정한 기록 기준입니다\./);
assert.match(monthlySell, />확정</);
assert.match(yearlySell, />확정</);

assert.doesNotMatch(balance, /fmtKRW|btcKRW|₩|원화 환산가|현재 원화 가치/);
assert.match(price, /UPBIT · KRW/);
assert.match(price, /d\.btcKRW/);

assert.match(home, /<BalanceCard[\s\S]*?<div className="ldg-home-month-selector">[\s\S]*?<InOutCards/);
assert.match(tabBar, /홈/);
assert.match(tabBar, /입력/);
assert.match(tabBar, /통계/);
assert.match(tabBar, /설정/);
assert.doesNotMatch(tabBar, /자산/);
assert.match(app, /path="\/assets" element={<Navigate to="\/" replace \/>}/);

for (const term of ["매수", "매도", "평단가", "평균 매입가", "평가손익", "수익률", "포지션", "투자 수익"]) {
  assert.doesNotMatch(components, new RegExp(term), `user-facing components do not contain ${term}`);
}

const keySources = [
  read("src/state/LedgerContext.tsx"),
  read("src/lib/categories.ts"),
  read("src/lib/heldBtc.ts"),
  read("src/lib/format.ts"),
  read("src/lib/btcSellRecords.ts"),
  read("src/lib/settlement.ts"),
].join("\n");

for (const key of [
  "myledger.txns.v1",
  "myledger.pendingUndo.v1",
  "myledger.categories.v1",
  "myledger.heldBtc.v1",
  "myledger.displayUnit.v1",
  "myledger.btcSellRecords.v1",
  "myledger.settlementDay.v1",
]) {
  assert.ok(keySources.includes(key), `${key} remains unchanged`);
}

console.log("verify:home-ux-polish passed");
