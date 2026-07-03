import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const homePage = readFileSync("src/components/home/HomePage.tsx", "utf8");
const txnsCard = readFileSync("src/components/home/TxnsCard.tsx", "utf8");
const txnListPage = readFileSync("src/components/transaction/TxnListPage.tsx", "utf8");
const sellCard = readFileSync("src/components/home/SellNeededCard.tsx", "utf8");

assert.match(homePage, /useSelectedMonth\(defaultSettlementMonthKey\)/, "HomePage defaults to the current settlement month");
assert.match(homePage, /getSettlementPeriod\(selectedMonth, settlementDay\)/, "HomePage derives the selected settlement period");
assert.match(homePage, /calculateUnsettledLivingCashflow\(\s*data\.txns,\s*categoriesById,\s*period/s, "HomePage uses selected period for unsettled cashflow");
assert.match(homePage, /calculateTheoreticalBalance\(\{[\s\S]*periodStartBalanceKrw,[\s\S]*period,/s, "HomePage uses selected period for theoretical balance");
assert.doesNotMatch(homePage, /<InOutCards/, "HomePage removes the top income/expense cards");
assert.match(homePage, /<SellNeededCard[\s\S]*selectedMonth=\{selectedMonth\}/, "HomePage passes selected month to SellNeededCard");
assert.match(homePage, /<TxnsCard[\s\S]*selectedMonth=\{selectedMonth\}[\s\S]*period=\{period\}/, "HomePage passes selected period to TxnsCard");

assert.match(txnsCard, /isIsoWithinPeriod\(t\.date, period\)/, "TxnsCard filters by settlement period");
assert.match(txnsCard, /setTxnSettled/, "TxnsCard wires settlement toggles");

assert.match(txnListPage, /useSelectedMonth\(defaultSettlementMonthKey\)/, "TxnListPage defaults to settlement month");
assert.match(txnListPage, /getSettlementPeriod\(selectedMonth, settlementDay\)/, "TxnListPage derives selected period");
assert.match(txnListPage, /isIsoWithinPeriod\(t\.date, period\)/, "TxnListPage filters by settlement period");
assert.match(txnListPage, /setTxnSettled/, "TxnListPage wires settlement toggles");

assert.match(sellCard, /왜 이 금액이죠/, "SellNeededCard keeps details collapsed behind a trigger");
assert.match(sellCard, /selectedMonth/, "SellNeededCard receives selected month");

console.log("verify:month passed");
