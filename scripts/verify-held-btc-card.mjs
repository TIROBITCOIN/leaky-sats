import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

// 1. BalanceCard no longer shows a KRW valuation line
const balanceCard = readFileSync("src/components/home/BalanceCard.tsx", "utf8");
assert.doesNotMatch(balanceCard, /≈\s*₩/, "BalanceCard does not show ≈ ₩ valuation");
assert.doesNotMatch(balanceCard, /평가액|현재 원화 가치|원화 환산가/, "BalanceCard has no KRW-valuation wording");
assert.doesNotMatch(balanceCard, /fmtKRW/, "BalanceCard does not format a KRW amount");
assert.doesNotMatch(balanceCard, /btcKRW/, "BalanceCard does not read btcKRW price");

// 2. BalanceCard shows both BTC and sats (one as main, one as sub, respecting unit order)
assert.match(balanceCard, /fmtBtcValue\(heldBtc, unit\)/, "BalanceCard shows held BTC in selected unit");
assert.match(balanceCard, /fmtBtcValue\(heldBtc, otherUnit\)/, "BalanceCard shows the other unit as a sub line");
assert.match(balanceCard, /otherUnit.*unit === "sats" \? "BTC" : "sats"/, "sub line is the opposite of the selected unit");

// 3. PriceWidget (BTC Price card) still shows KRW price
const priceWidget = readFileSync("src/components/home/PriceWidget.tsx", "utf8");
assert.match(priceWidget, /UPBIT · KRW/, "PriceWidget still shows UPBIT KRW price label");
assert.match(priceWidget, /d\.btcKRW/, "PriceWidget still reads btcKRW");

// 4. SellNeededCard still exists and still uses current BTC/KRW price via sellCalculator
const sellCard = readFileSync("src/components/home/SellNeededCard.tsx", "utf8");
assert.match(sellCard, /판매해야 하는 비트코인/, "SellNeededCard still present");
const sellCalc = readFileSync("src/lib/sellCalculator.ts", "utf8");
assert.match(sellCalc, /btcKrw/, "sellCalculator still uses current BTC/KRW price");

// 5. No localStorage key changes (displayUnit key untouched)
const formatSrc = readFileSync("src/lib/format.ts", "utf8");
assert.match(formatSrc, /myledger\.displayUnit\.v1/, "displayUnit localStorage key unchanged");

// 6. No reintroduction of 매수/매도 wording in BalanceCard
assert.doesNotMatch(balanceCard, /매수|매도/, "BalanceCard does not reintroduce 매수/매도 wording");

console.log("verify:held-btc-card passed");
