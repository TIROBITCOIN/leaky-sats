import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import ts from "typescript";

const freshnessPath = "src/lib/priceFreshness.ts";
assert.equal(existsSync(freshnessPath), true, "price freshness module exists");

const freshnessSource = readFileSync(freshnessPath, "utf8");
const ledgerSource = readFileSync("src/state/LedgerContext.tsx", "utf8");
const widgetSource = readFileSync("src/components/home/PriceWidget.tsx", "utf8");
const settingsSource = readFileSync("src/components/settings/SettingsPage.tsx", "utf8");
const statusSource = readFileSync("src/lib/priceStatus.ts", "utf8");

assert.doesNotMatch(ledgerSource, /state\.priceMeta\.liveFields\.[a-zA-Z]+\s*\|\|/, "live source state is not accumulated forever");
assert.match(ledgerSource, /priceStaleSources/, "context exposes stale source names");
assert.match(ledgerSource, /priceSourceUpdatedAt/, "context exposes per-source success timestamps");
assert.match(widgetSource, /priceStaleSources/, "price card consumes stale source names");
assert.match(widgetSource, /MAX_REASONABLE_KIMCHI_PREMIUM_ABS/, "price card guards unrealistic kimchi premium values");
assert.match(widgetSource, /Math\.abs\(kimchi\)\s*>\s*MAX_REASONABLE_KIMCHI_PREMIUM_ABS/, "kimchi premium outliers are blocked");
assert.match(widgetSource, /new Set\(priceSourceTimes\)\.size === 1/, "kimchi premium requires prices from the same successful fetch");
assert.match(widgetSource, /priceSourceMeta\.btcUsd === "Binance"[\s\S]*priceSourceMeta\.usdKrw === "Frankfurter"/, "kimchi premium is withheld when price APIs fall back");
assert.match(widgetSource, /김프 계산 보류|시세 일부 지연/, "price card shows a pending state instead of stale kimchi numbers");
assert.match(widgetSource, /canShowKimchi/, "kimchi premium is only displayed when all sources are fresh");
assert.match(widgetSource, /kimchiLabel/, "kimchi badge renders a guarded label");
assert.match(settingsSource, /priceStaleSources/, "settings consumes stale source names");
assert.match(statusSource, /formatStalePriceStatus/, "shared stale status copy formatter exists");
assert.match(statusSource, /일부 시세 지연/, "stale status copy clearly identifies delayed prices");
assert.match(statusSource, /성공 기록 없음/, "never-successful stale sources are explained");

const compiled = ts.transpileModule(freshnessSource, {
  compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 },
}).outputText;
const moduleUrl = `data:text/javascript;base64,${Buffer.from(compiled).toString("base64")}`;
const freshness = await import(moduleUrl);

let state = freshness.createInitialPriceFreshness();
state = freshness.applyPriceFetchResult(state, { btcKRW: 100, btcUSD: 80, usdKRW: 1.25, errors: [] }, 1_000);
assert.deepEqual(state.staleSources, [], "all-success fetch is fresh");
assert.equal(freshness.hasPriceFallback(state), false, "all sources have live values after success");
assert.equal(freshness.isPriceStale(state), false, "all-success fetch is not stale");

state = freshness.applyPriceFetchResult(state, { btcKRW: 101, btcUSD: 81, errors: ["FX"] }, 2_000);
assert.deepEqual(state.staleSources, ["FX"], "FX failure immediately marks FX stale");
assert.equal(state.lastOkAt.usdKRW, 1_000, "FX keeps its previous successful timestamp");
assert.equal(state.lastOkAt.btcKRW, 2_000, "successful Upbit timestamp advances");
assert.equal(freshness.hasPriceFallback(state), false, "previous FX value is retained rather than treated as dummy fallback");
assert.equal(freshness.isPriceStale(state), true, "partial failure is stale");

state = freshness.applyPriceFetchResult(state, { btcKRW: 102, btcUSD: 82, usdKRW: 1.3, errors: [] }, 3_000);
assert.deepEqual(state.staleSources, [], "FX recovery clears stale state");
assert.equal(state.lastOkAt.usdKRW, 3_000, "FX recovery advances its timestamp");
assert.equal(freshness.isPriceStale(state), false, "recovered sources are fresh again");

console.log("verify:price-staleness passed");
