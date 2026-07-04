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
assert.match(modal, /const \[premiumInput,\s*setPremiumInput\]\s*=\s*useState\("0"\)/, "modal keeps editable premium state at zero");
assert.match(modal, /premiumPct/, "modal keeps premium calculation");
assert.match(modal, /currentBtcKrw \* \(1 \+ premiumPct \/ 100\)/, "modal keeps effective price formula internally");
assert.match(
  modal,
  /id="carryover-balance"[\s\S]*htmlFor="p2p-premium"[\s\S]*P2P 프리미엄[\s\S]*id="p2p-premium"[\s\S]*id="network-fee"/,
  "modal shows P2P premium between carryover balance and network fee"
);
assert.match(modal, /id="p2p-premium"[\s\S]*inputMode="decimal"[\s\S]*value=\{premiumInput\}/, "premium input allows decimal values");
assert.match(modal, /setPremiumInput\(event\.target\.value\.replace\(\s*\/\[\^0-9\.-\]\/g,\s*""\s*\)\)/, "premium input allows negative decimal input");
assert.match(modal, /<span className="ldg-input-unit">％<\/span>|<span className="ldg-input-unit">%<\/span>/, "premium input uses a suffix percent unit");
assert.doesNotMatch(modal, /실효가격|formatKrwWon/, "modal keeps the effective price row hidden");
assert.match(modal, /<span[^>]*>원<\/span>/, "carryover input uses suffix won unit");
assert.match(modal, /<span[^>]*>sats<\/span>/, "network fee input keeps suffix sats unit");
assert.doesNotMatch(modal, /ldg-prefixed-input|<span>₩<\/span>|≈|₩/, "modal removes won prefix and approximation markers");
assert.match(modal, /UTXO 개수가 늘어나면 수수료도 달라질 수 있습니다\./, "UTXO warning uses polite copy");
assert.match(modal, /권장합니다\./, "bottom note uses polite copy");

const css = read("src/styles/ledger.css");
assert.match(css, /\.ldg-sell-sats-primary/, "sell-card primary sats class is styled");
assert.match(css, /\.ldg-sell-krw-secondary/, "sell-card secondary KRW class is styled");
assert.match(css, /\.ldg-input-unit\s*\{[\s\S]*width:\s*34px/, "modal input unit column has fixed width");
assert.match(css, /\.ldg-input-with-unit/, "modal inputs share suffix-unit layout");

const combinedUi = [
  sellCard,
  priceWidget,
  txnRow,
  modal,
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
