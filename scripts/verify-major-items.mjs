import assert from "node:assert/strict";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";

const root = process.cwd();

// 1. src/lib/majorItems.ts exists
const majorItemsPath = join(root, "src/lib/majorItems.ts");
const majorItemsSrc = readFileSync(majorItemsPath, "utf8");
assert.ok(majorItemsSrc.length > 0, "src/lib/majorItems.ts exists");

/** majorItems.ts의 플랫 객체 리터럴 하나를 id로 찾아 그 블록 텍스트를 반환한다(중첩 {} 없음 가정). */
function getItemBlock(id) {
  const re = new RegExp(`\\{[^{}]*id:\\s*"${id}"[^{}]*\\}`, "s");
  const m = majorItemsSrc.match(re);
  assert.ok(m, `major item block for id "${id}" exists`);
  return m[0];
}

// 2. 수입 큰 항목 7개
const incomeIds = ["salary", "bonus", "side_income", "refund", "interest", "allowance", "etc_income"];
const incomeLabels = ["월급", "상여/수당", "부업수입", "환급/정산", "이자/배당", "지원금/용돈", "기타수입"];
incomeIds.forEach((id, i) => {
  const block = getItemBlock(id);
  assert.match(block, new RegExp(`label:\\s*"${incomeLabels[i]}"`), `income item ${id} has label ${incomeLabels[i]}`);
  assert.match(block, /flow:\s*"income"/, `income item ${id} has flow income`);
});

// 3. 지출 큰 항목 11개 (DCA / BTC 매수는 입력 UI에서 지출로 노출)
const expenseIds = [
  "card_bill",
  "insurance",
  "telecom",
  "management_fee",
  "rent",
  "mortgage_interest",
  "loan_payment",
  "subscription",
  "events",
  "btc_buy",
  "etc_expense",
];
const expenseLabels = [
  "카드대금",
  "보험비",
  "통신비",
  "관리비",
  "월세",
  "주거대출이자",
  "대출원리금",
  "구독료",
  "경조사비",
  "DCA / BTC 매수",
  "기타지출",
];
expenseIds.forEach((id, i) => {
  const block = getItemBlock(id);
  assert.match(block, new RegExp(`label:\\s*"${expenseLabels[i]}"`), `expense item ${id} has label ${expenseLabels[i]}`);
  assert.match(block, /flow:\s*"expense"/, `expense item ${id} has flow expense`);
});

// 4. DCA / BTC 매수는 기존 btc_buy id에 매핑되고 생활비 계산 제외 설명을 제공
const btcBuyBlock = getItemBlock("btc_buy");
assert.match(btcBuyBlock, /label:\s*"DCA \/ BTC 매수"/, "btc_buy major item uses the DCA label");
assert.match(btcBuyBlock, /flow:\s*"expense"/, "btc_buy major item uses the expense entry flow");
assert.match(btcBuyBlock, /categoryId:\s*"btc_buy"/, "DCA entry preserves the btc_buy category id");
assert.match(btcBuyBlock, /requiresDetail:\s*false/, "DCA entry does not require a detail field");
assert.match(btcBuyBlock, /생활비 부족 계산에서는 제외/, "DCA entry explains living cashflow exclusion");
assert.doesNotMatch(majorItemsSrc, /id:\s*"btc_sell_confirm"/, "sell confirmation is absent from major items");
assert.doesNotMatch(majorItemsSrc, /label:\s*"투자"/, "transaction entry has no investment group");

// 5-8. detailLabel 확인
assert.match(getItemBlock("card_bill"), /detailLabel:\s*"카드회사"/, "card_bill detailLabel is 카드회사");
assert.match(getItemBlock("insurance"), /detailLabel:\s*"보험사"/, "insurance detailLabel is 보험사");
assert.match(getItemBlock("telecom"), /detailLabel:\s*"통신사"/, "telecom detailLabel is 통신사");
assert.match(getItemBlock("subscription"), /detailLabel:\s*"서비스명"/, "subscription detailLabel is 서비스명");

// 9. 대출원리금 또는 주거대출이자 항목에 금융기관 입력 개념 존재
const loanBlock = getItemBlock("loan_payment");
const mortgageBlock = getItemBlock("mortgage_interest");
assert.ok(
  /detailLabel:\s*"금융기관"/.test(loanBlock) || /detailLabel:\s*"금융기관"/.test(mortgageBlock),
  "loan_payment or mortgage_interest has 금융기관 detail concept"
);

// 10. 사용자 표시 문구에 레거시 용어가 다시 생기지 않았는지 (src/components 전체 스캔)
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
assert.doesNotMatch(combinedComponents, /BTC 매도/, "no 'BTC 매도' reintroduced in user-facing components");
assert.doesNotMatch(combinedComponents, /팔아야 할 BTC/, "no '팔아야 할 BTC' reintroduced in user-facing components");

// 11. 내부 id btc_buy/btc_sell 유지
const categoriesSrc = readFileSync(join(root, "src/lib/categories.ts"), "utf8");
assert.match(categoriesSrc, /id:\s*"btc_buy"/, "btc_buy category id preserved");
assert.match(categoriesSrc, /id:\s*"btc_sell"/, "btc_sell category id preserved");
assert.match(
  categoriesSrc,
  /PROTECTED_IDS = new Set\(\["etc", "etc_income", "btc_buy", "btc_sell"\]\)/,
  "btc_buy/btc_sell remain protected ids"
);

// 12. TransactionEntryPage가 majorItems를 사용하는지
const entryPageSrc = readFileSync(join(root, "src/components/transaction/TransactionEntryPage.tsx"), "utf8");
assert.match(entryPageSrc, /from "\.\.\/\.\.\/lib\/majorItems"/, "TransactionEntryPage imports from lib/majorItems");
assert.match(entryPageSrc, /MAJOR_ITEM_GROUPS/, "TransactionEntryPage renders MAJOR_ITEM_GROUPS");

// 13. BTC 판매 확정은 일반 거래 입력에서 제거되고 SellNeededCard에서만 진입
assert.doesNotMatch(entryPageSrc, /opensSellConfirm|openSellModal/, "transaction entry has no sell-confirm shortcut");
const homePageSrc = readFileSync(join(root, "src/components/home/HomePage.tsx"), "utf8");
assert.match(homePageSrc, /SellConfirmModal/, "HomePage still owns the SellConfirmModal flow");
assert.match(homePageSrc, /onConfirmSell/, "HomePage opens sell confirmation from SellNeededCard");
const sellNeededSrc = readFileSync(join(root, "src/components/home/SellNeededCard.tsx"), "utf8");
assert.match(sellNeededSrc, />\s*판매\s*</, "SellNeededCard keeps the simplified sale action");

// 14. 기존 localStorage key가 변경되지 않았는지
const expectedKeys = [
  "myledger.categories.v1",
  "myledger.txns.v1",
  "myledger.pendingUndo.v1",
  "myledger.heldBtc.v1",
  "myledger.displayUnit.v1",
  "myledger.btcSellRecords.v1",
];
const ledgerContextSrc = readFileSync(join(root, "src/state/LedgerContext.tsx"), "utf8");
const heldBtcSrc = readFileSync(join(root, "src/lib/heldBtc.ts"), "utf8");
const formatSrc = readFileSync(join(root, "src/lib/format.ts"), "utf8");
const btcSellRecordsSrc = readFileSync(join(root, "src/lib/btcSellRecords.ts"), "utf8");
const allSrcForKeys = ledgerContextSrc + heldBtcSrc + formatSrc + btcSellRecordsSrc;
for (const key of expectedKeys) {
  assert.ok(allSrcForKeys.includes(key), `localStorage key ${key} is still present`);
}

// 15. verify:terminology가 깨지지 않도록 동일한 핵심 조건을 다시 확인
// 현재 사용자 용어가 유지되는지 확인
const combinedWithLabels = combinedComponents + categoriesSrc + majorItemsSrc;
assert.match(combinedWithLabels, /판매해야 하는 비트코인/, "판매해야 하는 비트코인 label still present");
assert.doesNotMatch(combinedWithLabels, /BTC 판매 확정/, "old BTC sale confirmation label is absent");
assert.match(sellNeededSrc, />\s*판매\s*</, "simplified sale label is present");
assert.match(combinedWithLabels, /DCA \/ BTC 매수/, "DCA / BTC 매수 label is present");
assert.match(combinedWithLabels, /BTC 판매/, "BTC 판매 label still present");

// 16. btc_buy는 내부 invest 그룹으로 남아 생활비 부족 계산에서 제외
const btcBuyCategoryBlock = categoriesSrc.match(/\{[\s\S]*?id:\s*"btc_buy"[\s\S]*?\}/)?.[0] ?? "";
assert.match(btcBuyCategoryBlock, /label:\s*"DCA \/ BTC 매수"/, "btc_buy category uses the DCA label");
assert.match(btcBuyCategoryBlock, /group:\s*"invest"/, "btc_buy remains in the invest calculation group");
assert.match(btcBuyCategoryBlock, /flow:\s*"expense"/, "btc_buy remains a negative expense transaction");
const sellCalculatorSrc = readFileSync(join(root, "src/lib/sellCalculator.ts"), "utf8");
assert.match(sellCalculatorSrc, /cat\?\.group === "invest"/, "living cashflow continues to exclude invest categories");

console.log("verify:major-items passed");
