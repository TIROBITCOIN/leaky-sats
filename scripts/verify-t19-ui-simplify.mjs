import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import ts from "typescript";

const root = process.cwd();
const read = (file) => readFileSync(join(root, file), "utf8");

const formatSrc = read("src/lib/format.ts");
const compiledFormat = ts.transpileModule(formatSrc, {
  compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 },
}).outputText;
const formatModule = await import(`data:text/javascript;base64,${Buffer.from(compiledFormat).toString("base64")}`);

assert.equal(formatModule.fmtKRW(1_824_853), "1,824,853원", "fmtKRW uses numeric suffix won");
assert.equal(formatModule.fmtKRW(-1_824_853), "-1,824,853원", "negative fmtKRW keeps suffix won");
assert.doesNotMatch(formatSrc, /₩|≈/, "format utilities do not emit won symbol or approximation marker");

const sellCard = read("src/components/home/SellNeededCard.tsx");
assert.match(sellCard, /ldg-sell-sats-primary/, "sell card has a primary sats line");
assert.match(sellCard, /ldg-sell-krw-secondary/, "sell card has a secondary KRW line");
assert.match(sellCard, /판매해야 하는 비트코인/, "sell card keeps the title");
assert.match(sellCard, />\s*판매\s*</, "sell card button label is simplified");
assert.doesNotMatch(sellCard, /부족분|현재 BTC 가격 기준 예상 판매량|toFixed\(8\)|fmtBtcValue|BtcAndSats|getMonthLabel|BTC 판매 확정/, "sell card removes old helper rows and BTC amount");

const priceWidget = read("src/components/home/PriceWidget.tsx");
assert.match(priceWidget, /fmtKRW\(d\.btcKRW\)/, "BTC/KRW price uses full KRW formatter");
assert.doesNotMatch(priceWidget, /\/ 1_000_000|toFixed\(1\).*M|fxReferenceDate|환율 기준일|priceSourceMeta/, "price card removes compact KRW and FX reference line");
assert.match(priceWidget, /TONE_LABEL\[tone\]\(formatUpdatedAt\(priceUpdatedAt\)\)/, "price card keeps one live/update row");

const txnRow = read("src/components/home/TxnRow.tsx");
assert.match(txnRow, /fmtKRW\(t\.amount\)/, "transaction row shows KRW amount");
assert.doesNotMatch(txnRow, /krwToSats|ldg-txn-sub|sats/, "transaction row removes per-item sats conversion");

const modal = read("src/components/home/SellConfirmModal.tsx");
assert.match(modal, /판매할 금액/, "modal uses the simplified sell amount title");
assert.match(modal, /const \[amountInput,\s*setAmountInput\]\s*=\s*useState/, "modal keeps a single editable amount input state");
assert.doesNotMatch(modal, /premiumInput|premiumPct|carryover|networkFee|tradeSats|finalSats/, "modal drops premium/carryover/network-fee/derived-sats fields");
assert.doesNotMatch(modal, /P2P 프리미엄|이월 잔고|네트워크 수수료|실제 판매할 sats/, "modal drops the removed field labels");
assert.doesNotMatch(modal, /실효가격|formatKrwWon/, "modal keeps the effective price row hidden");
assert.match(modal, /<span[^>]*>원<\/span>/, "amount input uses suffix won unit");
assert.match(modal, /≈ \{formatSats\(sats\)\}/, "modal shows a live sats conversion of the entered amount");
assert.doesNotMatch(modal, /UTXO/, "modal no longer warns about UTXO count");

const css = read("src/styles/ledger.css");
assert.match(css, /\.ldg-sell-sats-primary/, "sell-card primary sats class is styled");
assert.match(css, /\.ldg-sell-krw-secondary/, "sell-card secondary KRW class is styled");
assert.match(css, /\.ldg-input-unit\s*\{[\s\S]*width:\s*34px/, "modal input unit column has fixed width");
assert.match(css, /\.ldg-input-with-unit/, "modal inputs share suffix-unit layout");

const combinedUi = [
  sellCard,
  priceWidget,
  txnRow,
  read("src/components/home/CurrencyToggle.tsx"),
  read("src/components/home/InOutCards.tsx"),
  read("src/components/home/BalanceCard.tsx"),
  read("src/components/home/MonthlySellSummaryCard.tsx"),
  read("src/components/home/YearlySellSummaryCard.tsx"),
  read("src/components/transaction/TransactionEntryPage.tsx"),
  read("src/components/stats/SelectedDayTransactions.tsx"),
].join("\n");
assert.doesNotMatch(combinedUi, /₩|≈|94\.3M|0\.01934542 BTC/, "home/modal UI has no won symbol, approximation marker, compact price, or fixed BTC amount");

console.log("verify:t19-ui-simplify passed");
