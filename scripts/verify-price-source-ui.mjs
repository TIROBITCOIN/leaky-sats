import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";

const settings = readFileSync("src/components/settings/SettingsPage.tsx", "utf8");
const priceApi = readFileSync("src/lib/priceApi.ts", "utf8");
const context = readFileSync("src/state/LedgerContext.tsx", "utf8");
const widget = readFileSync("src/components/home/PriceWidget.tsx", "utf8");
const upbitProxyPath = "api/upbit.ts";
assert.equal(existsSync(upbitProxyPath), true, "Vercel Upbit proxy function exists");
const upbitProxy = readFileSync(upbitProxyPath, "utf8");

assert.doesNotMatch(settings, /const SOURCES\s*=/, "SettingsPage has no unused SOURCES constant");
assert.doesNotMatch(settings, /\bsetSource\b/, "SettingsPage has no unused source setter");
assert.doesNotMatch(settings, /\[source,\s*setSource\]/, "SettingsPage has no unused source state");
assert.doesNotMatch(settings, /새로고침 주기|30초|1분|5분|INTERVALS/, "refresh interval chooser is removed");
assert.match(settings, /priceStatus/, "price status UI remains wired");
assert.match(settings, /refreshPrices/, "manual price refresh remains wired");

assert.match(priceApi, /export async function fetchUpbitBtcKrw/, "Upbit BTC/KRW fetch remains");
assert.match(priceApi, /fetchJson\("\/api\/upbit"\)/, "Upbit BTC/KRW fetch tries the same-origin proxy first");
assert.match(priceApi, /fetchUpbitBtcKrwProxy\(\)[\s\S]*fetchUpbitBtcKrwDirect\(\)/, "Upbit BTC/KRW fetch falls back to direct Upbit");
assert.match(priceApi, /fetchJson\(UPBIT_BTC_KRW_URL\)/, "direct Upbit fallback remains");
assert.match(priceApi, /export async function fetchBtcUsdWithFallback/, "BTC/USD fallback chain remains");
assert.match(priceApi, /export async function fetchUsdKrwWithFallback/, "USD/KRW fallback chain remains");
assert.match(priceApi, /export async function fetchBlockHeight/, "block height fetch is exported");
assert.match(priceApi, /https:\/\/mempool\.space\/api\/blocks\/tip\/height/, "mempool block height endpoint exists");
assert.match(priceApi, /https:\/\/blockchain\.info\/q\/getblockcount/, "blockchain.info block height fallback exists");
assert.match(priceApi, /blockHeight\?:\s*number/, "PriceFetchResult includes optional block height");
assert.match(priceApi, /btcKrwIsFallback\?:\s*boolean/, "PriceFetchResult marks BTC/KRW fallback values");
assert.match(priceApi, /export async function fetchLivePrices/, "combined live price fetch remains");
assert.match(priceApi, /result\.btcKRW\s*=\s*btcUsdVal\s*\*\s*usdKrw/, "Upbit failure can derive BTC/KRW from BTC/USD and USD/KRW");
assert.match(priceApi, /result\.btcKrwIsFallback\s*=\s*true/, "derived BTC/KRW values are explicitly flagged");
assert.match(
  priceApi,
  /Promise\.allSettled\(\[\s*fetchUpbitBtcKrw\(\),\s*fetchBtcUsdWithFallback\(\),\s*fetchUsdKrwWithFallback\(\),\s*fetchBlockHeight\(\),?\s*\]\)/,
  "fetchLivePrices keeps independent price sources and joins block height",
);
assert.match(widget, /!btcKrwIsFallback/, "kimchi premium is guarded when BTC/KRW is derived");
assert.match(upbitProxy, /https:\/\/api\.upbit\.com\/v1\/ticker\?markets=KRW-BTC/, "Upbit proxy calls the server-side Upbit endpoint");
assert.match(upbitProxy, /btcKrw:\s*price/, "Upbit proxy returns only the BTC/KRW price");
assert.match(upbitProxy, /CACHE_TTL_MS\s*=\s*1_000/, "Upbit proxy caches briefly for one-second polling");
assert.match(upbitProxy, /inFlight/, "Upbit proxy dedupes concurrent fetches");
assert.match(upbitProxy, /s-maxage=1,\s*stale-while-revalidate=5/, "Upbit proxy cache header matches one-second polling");
assert.match(upbitProxy, /status\(502\)\.json\(\{\s*error:\s*"upbit_unavailable"\s*\}\)/, "Upbit proxy reports unavailable upstreams as 502");
assert.match(
  context,
  /blockHeight:\s*blockHeight\s*\?\?\s*state\.data\.blockHeight/,
  "PRICE_FETCH_SETTLED preserves existing block height when live fetch fails",
);

console.log("verify:price-source-ui passed");
