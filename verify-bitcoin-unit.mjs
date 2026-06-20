import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

// 1. format.ts has BtcUnit type and persistence functions using existing key
const formatSrc = readFileSync("src/lib/format.ts", "utf8");
assert.match(formatSrc, /export type BtcUnit/, "BtcUnit type exported from format.ts");
assert.match(formatSrc, /myledger\.displayUnit\.v1/, "uses existing displayUnit localStorage key");
assert.match(formatSrc, /export function loadBtcUnit/, "loadBtcUnit exported");
assert.match(formatSrc, /export function saveBtcUnit/, "saveBtcUnit exported");
assert.match(formatSrc, /export function fmtBtcValue/, "fmtBtcValue exported");

// 2. fmtBtcValue removes trailing zeros for BTC
assert.match(formatSrc, /\.replace\(\/\\\./, "trailing zero removal regex present");

// 3. BalanceCard uses fmtBtcValue with unit prop
const balanceCard = readFileSync("src/components/home/BalanceCard.tsx", "utf8");
assert.match(balanceCard, /fmtBtcValue/, "BalanceCard uses fmtBtcValue");
assert.match(balanceCard, /unit.*BtcUnit/, "BalanceCard accepts unit prop");

// 4. SellNeededCard uses fmtBtcValue with unit prop
const sellCard = readFileSync("src/components/home/SellNeededCard.tsx", "utf8");
assert.match(sellCard, /fmtBtcValue/, "SellNeededCard uses fmtBtcValue");
assert.match(sellCard, /unit.*BtcUnit/, "SellNeededCard accepts unit prop");

// 5. HomePage imports loadBtcUnit and passes unit to cards
const homePage = readFileSync("src/components/home/HomePage.tsx", "utf8");
assert.match(homePage, /loadBtcUnit/, "HomePage imports loadBtcUnit");
assert.match(homePage, /btcUnit/, "HomePage has btcUnit state");
assert.match(homePage, /BalanceCard.*unit=/, "HomePage passes unit to BalanceCard");
assert.match(homePage, /SellNeededCard.*unit=/, "HomePage passes unit to SellNeededCard");

// 6. HomePage refreshes btcUnit on visibility/focus
assert.match(homePage, /setBtcUnit\(loadBtcUnit/, "HomePage refreshes btcUnit on visibility change");

// 7. SettingsPage uses loadBtcUnit and saveBtcUnit (existing setting, no new UI)
const settingsPage = readFileSync("src/components/settings/SettingsPage.tsx", "utf8");
assert.match(settingsPage, /loadBtcUnit/, "SettingsPage uses loadBtcUnit");
assert.match(settingsPage, /saveBtcUnit/, "SettingsPage uses saveBtcUnit");

// 8. No duplicate displayUnit key definitions (should only be in format.ts)
const heldBtcSrc = readFileSync("src/lib/heldBtc.ts", "utf8");
assert.doesNotMatch(heldBtcSrc, /displayUnit/, "heldBtc.ts does not define displayUnit key");

console.log("verify:unit passed");
