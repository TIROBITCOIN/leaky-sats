import assert from "node:assert/strict";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";

const root = process.cwd();
const componentsDir = join(root, "src", "components");

// 사용자-facing 컴포넌트(src/components 하위 .ts/.tsx)만 대상으로 한다.
// src/lib/format.ts의 legacy alias map, src/lib/categories.ts의 내부 주석 등은
// 의도적으로 "매수"/"매도" 문자열을 보존하므로 이 스캔 대상에서 제외된다.
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

const componentFiles = walk(componentsDir);
const combined = componentFiles.map((f) => readFileSync(f, "utf8")).join("\n");

// 1. 레거시 "팔아야 할 BTC" 문구가 남아있지 않은지
assert.doesNotMatch(combined, /팔아야 할 BTC/, "no leftover '팔아야 할 BTC' in user-facing components");

// 2. 레거시 "BTC 매도 반영" 문구가 남아있지 않은지
assert.doesNotMatch(combined, /BTC 매도 반영/, "no leftover 'BTC 매도 반영' in user-facing components");

// 3. 레거시 "BTC 매도 합계" 계열 문구가 남아있지 않은지 (예: "올해 BTC 매도 합계")
assert.doesNotMatch(combined, /BTC 매도 합계/, "no leftover 'BTC 매도 합계' in user-facing components");

// 4. "판매해야 하는 비트코인" 문구 존재
// Phase 12: "판매 필요 BTC" → "판매해야 하는 비트코인"으로 더 직관적으로 바뀌었다.
assert.match(combined, /판매해야 하는 비트코인/, "'판매해야 하는 비트코인' label is present");

// 5. "BTC 판매 확정" 문구 존재
// Phase 12: "BTC 판매 반영" → "BTC 판매 확정"으로 바뀌었다(정산 기준일 도입과 함께 의미를 명확히 함).
assert.match(combined, /BTC 판매 확정/, "'BTC 판매 확정' label is present");

// 6. "판매한 비트코인" 문구 존재 (월별/연간 판매 요약 카드)
// Phase 12: "BTC 판매 합계" → "{년}년 판매한 비트코인" 형태로 바뀌었다.
assert.match(combined, /판매한 비트코인/, "'판매한 비트코인' label is present");

// 7. "BTC 구매" 문구 존재
assert.match(combined, /BTC 구매/, "'BTC 구매' label is present");

// 8. "BTC 판매" 문구 존재
assert.match(combined, /BTC 판매/, "'BTC 판매' label is present");

// 9. 내부 localStorage key는 변경되지 않았는지
const sellRecordsSrc = readFileSync(join(root, "src/lib/btcSellRecords.ts"), "utf8");
assert.match(sellRecordsSrc, /myledger\.btcSellRecords\.v1/, "btcSellRecords localStorage key is unchanged");

// 10. 내부 id btc_buy/btc_sell 및 invest 그룹/protected 처리가 유지되는지
const categoriesSrc = readFileSync(join(root, "src/lib/categories.ts"), "utf8");
assert.match(categoriesSrc, /id:\s*"btc_buy"/, "btc_buy id is preserved");
assert.match(categoriesSrc, /id:\s*"btc_sell"/, "btc_sell id is preserved");
assert.match(categoriesSrc, /group:\s*"invest"/, "invest group handling is preserved");
assert.match(
  categoriesSrc,
  /PROTECTED_IDS = new Set\(\["etc", "etc_income", "btc_buy", "btc_sell"\]\)/,
  "btc_buy/btc_sell remain protected ids"
);

// 내부 영어 식별자(SellNeededCard, SellConfirmModal, btcSellRecords 등)는 그대로 허용한다.
// "sell"이라는 영단어 자체를 금지하는 것이 아니라, 한국어 "매수"/"매도" 사용자 문구만 대상으로 한다.

console.log("verify:terminology passed");
