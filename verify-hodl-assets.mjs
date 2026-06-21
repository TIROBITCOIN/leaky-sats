import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const root = process.cwd();
const read = (p) => readFileSync(join(root, p), "utf8");

const assetsPageSrc = read("src/components/assets/AssetsPage.tsx");

// 1. AssetsPage에 "Total Balance" 문구 존재
assert.match(assetsPageSrc, /Total Balance/, "AssetsPage shows Total Balance");

// 2. AssetsPage에 "HODL" 또는 "보유 중인 BTC" 계열 문구 존재
assert.match(assetsPageSrc, /HODL|보유 중인 BTC|보유 BTC/, "AssetsPage uses HODL/보유 BTC framing");

// 3. AssetsPage에 "평가 손익" 문구가 사용자-facing UI에서 제거됨
assert.doesNotMatch(assetsPageSrc, /평가\s*손익/, "평가손익 removed from AssetsPage");
assert.doesNotMatch(assetsPageSrc, /unrealizedPnl/i, "no unrealized PnL field rendered in AssetsPage");

// 4. AssetsPage에 "평균 매입가" 문구가 사용자-facing UI에서 제거됨
assert.doesNotMatch(assetsPageSrc, /평균\s*매입가/, "평균 매입가 removed from AssetsPage");
assert.doesNotMatch(assetsPageSrc, /averageCostKrwPerBtc/, "average cost field no longer rendered in AssetsPage");

// 5. AssetsPage에 "BTC 포지션" 문구가 사용자-facing UI에서 제거됨
assert.doesNotMatch(assetsPageSrc, /BTC\s*포지션/, "BTC 포지션 section removed from AssetsPage");
assert.doesNotMatch(assetsPageSrc, /순투입금/, "포지션 관련 순투입금 wording removed from AssetsPage");

// 6. AssetsPage에 "적립 추이" 또는 "Stacking Trend" 문구 유지
assert.match(assetsPageSrc, /적립 추이|Stacking Trend/, "stacking trend section is preserved");

// 7. heldBtc 또는 myledger.heldBtc.v1 기반 표시 로직이 유지됨
assert.match(assetsPageSrc, /getHeldBtc/, "AssetsPage reads heldBtc as the source of truth");
const heldBtcSrc = read("src/lib/heldBtc.ts");
assert.match(heldBtcSrc, /myledger\.heldBtc\.v1/, "heldBtc.ts still uses myledger.heldBtc.v1");

// 8. BTC/sats formatting util을 사용하고 있음
assert.match(assetsPageSrc, /fmtBtcValue/, "AssetsPage uses the shared fmtBtcValue formatter");

// 9. 구매/판매 용어 유지
assert.match(assetsPageSrc, /BTC 구매/, "BTC 구매 wording present");
assert.match(assetsPageSrc, /BTC 판매|판매 기록/, "BTC 판매 wording present");

// 10. 매수/매도 문구 재도입 없음
assert.doesNotMatch(assetsPageSrc, /매수/, "매수 not reintroduced");
assert.doesNotMatch(assetsPageSrc, /매도/, "매도 not reintroduced");

// 11. 기존 backup key 유지 (자산 탭 변경이 백업 스키마에 영향 없어야 한다)
const backupSrc = read("src/lib/backup.ts");
const expectedKeys = [
  "myledger.txns.v1",
  "myledger.categories.v1",
  "myledger.heldBtc.v1",
  "myledger.displayUnit.v1",
  "myledger.btcSellRecords.v1",
];
for (const key of expectedKeys) {
  assert.ok(backupSrc.includes(key), `backup.ts still includes ${key}`);
}

// 12. 새 의존성 없음
const pkg = JSON.parse(read("package.json"));
const deps = Object.keys(pkg.dependencies ?? {});
const devDeps = Object.keys(pkg.devDependencies ?? {});
assert.deepEqual(deps.sort(), ["react", "react-dom", "react-router-dom"], "no new runtime dependency added");
assert.deepEqual(
  devDeps.sort(),
  ["@types/react", "@types/react-dom", "@vitejs/plugin-react", "typescript", "vite"],
  "no new dev dependency added"
);

// ledgerCalc.js의 calculateBitcoinPortfolio는 verify:calc(verify-calculations.mjs)가 직접 검증하므로
// 여기서는 삭제되지 않았는지만 가볍게 확인한다 — 다른 화면/검증이 쓰는 유틸은 지우지 않는다는 요구사항.
const ledgerCalcSrc = read("src/lib/ledgerCalc.js");
assert.match(ledgerCalcSrc, /export function calculateBitcoinPortfolio/, "calculateBitcoinPortfolio util is preserved (still used for accumulation)");

console.log("verify:hodl-assets passed");
