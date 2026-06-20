import assert from "node:assert/strict";
import {
  calculateBitcoinPortfolio,
  calculateCategorySpending,
  calculatePeriodStats,
  txnToBitcoinSats,
} from "./src/lib/ledgerCalc.js";

const txns = [
  {
    id: 1,
    title: "Salary",
    cat: "salary",
    catLabel: "Salary",
    time: "6/10 09:00",
    date: "2026-06-10T09:00",
    amount: 100_000,
    btcAt: 100_000_000,
  },
  {
    id: 2,
    title: "Food",
    cat: "food",
    catLabel: "Food",
    time: "6/10 12:00",
    date: "2026-06-10T12:00",
    amount: -10_000,
    btcAt: 100_000_000,
  },
  {
    id: 3,
    title: "Pet",
    cat: "pet",
    catLabel: "Pet",
    time: "6/11 12:00",
    date: "2026-06-11T12:00",
    amount: -20_000,
    btcAt: 100_000_000,
  },
  {
    id: 4,
    title: "Last month",
    cat: "food",
    catLabel: "Food",
    time: "5/10 12:00",
    date: "2026-05-10T12:00",
    amount: -50_000,
    btcAt: 100_000_000,
  },
  {
    id: 5,
    title: "BTC buy",
    cat: "btc_buy",
    catLabel: "BTC Buy",
    time: "6/12 10:00",
    date: "2026-06-12T10:00",
    amount: -1_000_000,
    btcAt: 100_000_000,
  },
  {
    id: 6,
    title: "BTC sell",
    cat: "btc_sell",
    catLabel: "BTC Sell",
    time: "6/13 10:00",
    date: "2026-06-13T10:00",
    amount: 500_000,
    btcAt: 100_000_000,
  },
];

const june = new Date("2026-06-20T00:00");

const simpleMonthly = calculatePeriodStats(
  [
    { ...txns[0], id: 101, amount: 100_000, date: "2026-06-01T09:00" },
    { ...txns[1], id: 102, amount: -30_000, date: "2026-06-02T09:00" },
    { ...txns[2], id: 103, amount: -50_000, date: "2026-05-02T09:00" },
  ],
  "month",
  june
);
assert.equal(simpleMonthly.income, 100_000, "same-month income is included");
assert.equal(simpleMonthly.expense, 30_000, "same-month expense excludes other month");
assert.equal(simpleMonthly.net, 70_000, "net cashflow is income minus expense");

const monthly = calculatePeriodStats(txns, "month", june);
assert.equal(monthly.income, 600_000, "monthly income includes salary and btc_sell");
assert.equal(monthly.expense, 1_030_000, "monthly expense includes living expenses and btc_buy");
assert.equal(monthly.net, -430_000, "monthly net cashflow is income minus expense");
assert.equal(monthly.txns.some((txn) => txn.id === 4), false, "other month transaction is excluded");

const categories = calculateCategorySpending(monthly.txns, { includeInvestments: false });
assert.deepEqual(
  categories.entries.map((entry) => [entry.cat, entry.amount]),
  [
    ["pet", 20_000],
    ["food", 10_000],
  ],
  "category spending excludes salary and btc_buy investment"
);

const buy = txns.find((txn) => txn.cat === "btc_buy");
const sell = txns.find((txn) => txn.cat === "btc_sell");
assert.equal(txnToBitcoinSats(buy), 1_000_000, "btc_buy 1,000,000 KRW at 100,000,000 KRW/BTC is 1,000,000 sats");
assert.equal(txnToBitcoinSats(sell), 500_000, "btc_sell 500,000 KRW at 100,000,000 KRW/BTC is 500,000 sats");

const portfolio = calculateBitcoinPortfolio(txns, 120_000_000);
assert.equal(portfolio.totalBuyKrw, 1_000_000, "total buy KRW");
assert.equal(portfolio.totalSellKrw, 500_000, "total sell KRW");
assert.equal(portfolio.holdingSats, 500_000, "holding sats after buy and sell");
assert.equal(portfolio.holdingBtc, 0.005, "holding BTC after buy and sell");
assert.equal(portfolio.valuationKrw, 600_000, "0.005 BTC at 120,000,000 KRW/BTC is 600,000 KRW");
assert.equal(portfolio.averageCostKrwPerBtc, 100_000_000, "simple weighted average cost");
assert.equal(portfolio.netInvestedKrw, 500_000, "net invested KRW is buys minus sells");
assert.equal(portfolio.unrealizedPnlKrw, 100_000, "unrealized P/L uses valuation minus net invested");
assert.equal(portfolio.unrealizedPnlPct, 20, "unrealized P/L percentage");

const brokenTxns = [
  { ...txns[0], id: 20, date: "not-a-date" },
  { ...txns[4], id: 21, btcAt: 0 },
  { ...txns[4], id: 22, amount: Number.NaN },
  { ...txns[4], id: 23, cat: "unknown" },
];

assert.doesNotThrow(() => calculatePeriodStats(brokenTxns, "month", june), "broken date is ignored safely");
assert.doesNotThrow(() => calculateBitcoinPortfolio(brokenTxns, 120_000_000), "broken portfolio inputs are ignored safely");
assert.equal(calculateBitcoinPortfolio(brokenTxns, 0).valuationKrw, 0, "invalid current price produces zero valuation");

console.log("verify:calc passed");
