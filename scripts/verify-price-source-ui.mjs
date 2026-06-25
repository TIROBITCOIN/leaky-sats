import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const settings = readFileSync("src/components/settings/SettingsPage.tsx", "utf8");
const priceApi = readFileSync("src/lib/priceApi.ts", "utf8");

assert.doesNotMatch(settings, /시세 소스/, "SettingsPage does not render a fake price source selector");
assert.doesNotMatch(settings, /const SOURCES\s*=/, "SettingsPage has no unused SOURCES constant");
assert.doesNotMatch(settings, /\bsetSource\b/, "SettingsPage has no unused source setter");
assert.doesNotMatch(settings, /\[source,\s*setSource\]/, "SettingsPage has no unused source state");
assert.match(settings, /새로고침 주기/, "refresh interval UI remains");
assert.match(settings, /시세 상태/, "price status UI remains");
assert.match(settings, /지금 갱신/, "manual price refresh remains");
assert.match(settings, /여러 공개 API를 fallback으로/, "settings explains automatic fallback behavior");

assert.match(priceApi, /export async function fetchUpbitBtcKrw/, "Upbit BTC/KRW fetch remains");
assert.match(priceApi, /export async function fetchBtcUsdWithFallback/, "BTC/USD fallback chain remains");
assert.match(priceApi, /export async function fetchUsdKrwWithFallback/, "USD/KRW fallback chain remains");
assert.match(priceApi, /export async function fetchLivePrices/, "combined live price fetch remains");
assert.match(
  priceApi,
  /Promise\.allSettled\(\[\s*fetchUpbitBtcKrw\(\),\s*fetchBtcUsdWithFallback\(\),\s*fetchUsdKrwWithFallback\(\),?\s*\]\)/,
  "fetchLivePrices still uses the existing independent fallback sources"
);

console.log("verify:price-source-ui passed");
