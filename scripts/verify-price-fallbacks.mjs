import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import ts from "typescript";

const apiPath = "src/lib/priceApi.ts";
assert.equal(existsSync(apiPath), true, "price API module exists");

const source = readFileSync(apiPath, "utf8");
const context = readFileSync("src/state/LedgerContext.tsx", "utf8");
const widget = readFileSync("src/components/home/PriceWidget.tsx", "utf8");

assert.match(source, /api\.coinbase\.com\/v2\/prices\/BTC-USD\/spot/, "Coinbase BTC/USD fallback endpoint exists");
assert.match(source, /api\.coinbase\.com\/v2\/exchange-rates\?currency=USD/, "Coinbase USD/KRW fallback endpoint exists");
assert.match(source, /referenceDate/, "Frankfurter reference date is parsed");
assert.match(source, /fetchJson/, "fallback sources reuse the shared timeout and response validation helper");
assert.match(context, /priceSourceMeta/, "price source metadata is exposed through context");
assert.match(widget, /환율 기준일|일일 환율 기준/, "price card explains the approximate daily FX basis");

const runnableSource = source.replace(
  "const FETCH_TIMEOUT_MS = 8000;",
  "const FETCH_TIMEOUT_MS = 8000;\nexport { fetchJson };"
);
const compiled = ts.transpileModule(runnableSource, {
  compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 },
}).outputText;
const moduleUrl = `data:text/javascript;base64,${Buffer.from(compiled).toString("base64")}`;
const api = await import(moduleUrl);
const originalWarn = console.warn;
console.warn = () => {};

const btcPrimary = async () => {
  throw new Error("Binance blocked");
};
const btcFallback = async () => 62_500;
const btcResult = await api.fetchBtcUsdWithFallback(btcPrimary, btcFallback);
assert.equal(btcResult.value, 62_500, "BTC/USD fallback supplies the value");
assert.equal(btcResult.source, "Coinbase", "BTC/USD fallback source is reported");

const fxPrimary = async () => {
  throw new Error("Frankfurter unavailable");
};
const fxFallback = async () => 1_540;
const fxResult = await api.fetchUsdKrwWithFallback(fxPrimary, fxFallback);
assert.equal(fxResult.value, 1_540, "USD/KRW fallback supplies the value");
assert.equal(fxResult.source, "Coinbase", "USD/KRW fallback source is reported");
assert.equal(fxResult.referenceDate, undefined, "live fallback does not invent a Frankfurter reference date");

const dailyFxResult = await api.fetchUsdKrwWithFallback(
  async () => ({ value: 1_536.15, referenceDate: "2026-06-23" }),
  fxFallback
);
assert.equal(dailyFxResult.source, "Frankfurter", "primary daily FX source is reported");
assert.equal(dailyFxResult.referenceDate, "2026-06-23", "Frankfurter reference date survives the chain");

console.warn = originalWarn;
console.log("verify:price-fallbacks passed");
