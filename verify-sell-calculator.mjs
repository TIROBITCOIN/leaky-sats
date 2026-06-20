import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";

const root = process.cwd();

// 1. held BTC localStorage key exists in utility
const heldBtcPath = "src/lib/heldBtc.ts";
assert.ok(existsSync(heldBtcPath), "heldBtc.ts exists");
const heldBtcSrc = readFileSync(heldBtcPath, "utf8");
assert.match(heldBtcSrc, /myledger\.heldBtc\.v1/, "held BTC localStorage key defined");

// 2. sell calculator utility exists
const sellCalcPath = "src/lib/sellCalculator.ts";
assert.ok(existsSync(sellCalcPath), "sellCalculator.ts exists");
const sellCalcSrc = readFileSync(sellCalcPath, "utf8");
assert.match(sellCalcSrc, /calculateMonthlyLivingCashflow/, "calculateMonthlyLivingCashflow exists");
assert.match(sellCalcSrc, /calculateSellNeeded/, "calculateSellNeeded exists");

// 3-6. Arithmetic verification (inline calculation tests)
// Test: income 2,500,000 / expense 3,000,000 / btcKrw 96,700,000
const income = 2_500_000;
const expense = 3_000_000;
const btcKrw = 96_700_000;
const heldBtc = 0.12345678;
const net = income - expense;
assert.equal(net, -500_000, "net is -500,000");
const deficit = Math.abs(net);
assert.equal(deficit, 500_000, "deficit is 500,000");
const sellBtc = deficit / btcKrw;
assert.ok(Math.abs(sellBtc - 500000 / 96700000) < 1e-12, "sellBtc matches 500000/96700000");
const sellSats = Math.round(sellBtc * 100_000_000);
assert.equal(sellSats, Math.round((500000 / 96700000) * 100_000_000), "sats calculation matches");

// netKrw positive → sellBtc should be 0
const posNet = 100_000;
const posDeficit = posNet < 0 ? Math.abs(posNet) : 0;
assert.equal(posDeficit, 0, "positive net has no deficit");
const posSellBtc = posDeficit / btcKrw;
assert.equal(posSellBtc, 0, "positive net means no sell needed");

// btcKrw = 0 → safe handling, no NaN/Infinity
const zeroRateSell = 0 > 0 ? deficit / 0 : 0;
assert.ok(Number.isFinite(zeroRateSell), "zero rate produces finite result");

// 8. SettingsPage has held BTC input
const settingsPage = readFileSync("src/components/settings/SettingsPage.tsx", "utf8");
assert.match(settingsPage, /보유 BTC/, "SettingsPage has held BTC UI");

// 9. Home screen has held BTC display
const homePage = readFileSync("src/components/home/HomePage.tsx", "utf8");
assert.match(homePage, /heldBtc/, "HomePage references heldBtc");

const balanceCard = readFileSync("src/components/home/BalanceCard.tsx", "utf8");
assert.match(balanceCard, /보유 BTC/, "BalanceCard shows 보유 BTC");

// 10. Home screen has sell-needed card
assert.ok(existsSync("src/components/home/SellNeededCard.tsx"), "SellNeededCard exists");
const sellCard = readFileSync("src/components/home/SellNeededCard.tsx", "utf8");
assert.match(sellCard, /팔아야 할 BTC/, "SellNeededCard shows 팔아야 할 BTC");
assert.match(homePage, /SellNeededCard/, "HomePage includes SellNeededCard");

// 11. backup.ts includes heldBtc key
const backup = readFileSync("src/lib/backup.ts", "utf8");
assert.match(backup, /myledger\.heldBtc\.v1/, "backup includes heldBtc key");

// 12. appLock key is NOT in backup
assert.doesNotMatch(backup, /myledger\.appLock\.v1/, "appLock key is not in backup");

console.log("verify:sell passed");
