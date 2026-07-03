import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import ts from "typescript";

function moduleUrl(source) {
  return `data:text/javascript;base64,${Buffer.from(source).toString("base64")}`;
}

const compilerOptions = { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 };

const sellCalcPath = "src/lib/sellCalculator.ts";
assert.ok(existsSync(sellCalcPath), "sellCalculator.ts exists");
const sellCalcSrc = readFileSync(sellCalcPath, "utf8");
assert.match(sellCalcSrc, /calculateUnsettledLivingCashflow/, "calculateUnsettledLivingCashflow exists");
assert.match(sellCalcSrc, /isTxnSettled/, "isTxnSettled fallback helper exists");
assert.match(sellCalcSrc, /monthlyCashKrw/, "calculateSellNeeded accepts monthlyCashKrw");

const monthSrc = readFileSync("src/lib/month.ts", "utf8");
const monthModuleUrl = moduleUrl(ts.transpileModule(monthSrc, { compilerOptions }).outputText);
const compiledSellCalculator = ts
  .transpileModule(sellCalcSrc, { compilerOptions })
  .outputText.replace('"./month"', `"${monthModuleUrl}"`);
const sellCalculator = await import(moduleUrl(compiledSellCalculator));

const categoriesById = {
  salary: { id: "salary", label: "Salary", group: "income", flow: "income" },
  card_bill: { id: "card_bill", label: "Card bill", group: "expense", flow: "expense" },
  rent: { id: "rent", label: "Rent", group: "expense", flow: "expense" },
  btc_buy: { id: "btc_buy", label: "DCA / BTC buy", group: "invest", flow: "expense" },
};

const unsettledCashflow = sellCalculator.calculateUnsettledLivingCashflow(
  [
    {
      id: 1,
      title: "Settled salary",
      cat: "salary",
      catLabel: "Salary",
      time: "",
      date: "2026-07-02T09:00",
      amount: 6_276_123,
      btcAt: 100_000_000,
      settled: true,
    },
    {
      id: 2,
      title: "Manual unsettled card bill",
      cat: "card_bill",
      catLabel: "Card bill",
      time: "",
      date: "2026-07-02T10:00",
      amount: -350_000,
      btcAt: 100_000_000,
      settled: false,
    },
    {
      id: 3,
      title: "Future card bill",
      cat: "card_bill",
      catLabel: "Card bill",
      time: "",
      date: "2026-07-04T12:00",
      amount: -600_000,
      btcAt: 100_000_000,
      settled: false,
    },
    {
      id: 4,
      title: "Future rent",
      cat: "rent",
      catLabel: "Rent",
      time: "",
      date: "2026-07-05T12:00",
      amount: -1_100_000,
      btcAt: 100_000_000,
      settled: false,
    },
    {
      id: 5,
      title: "Past fallback-settled expense",
      cat: "card_bill",
      catLabel: "Card bill",
      time: "",
      date: "2026-07-01T12:00",
      amount: -999_000,
      btcAt: 100_000_000,
    },
    {
      id: 6,
      title: "Unsettled DCA still excluded",
      cat: "btc_buy",
      catLabel: "DCA / BTC buy",
      time: "",
      date: "2026-07-05T13:00",
      amount: -200_000,
      btcAt: 100_000_000,
      settled: false,
    },
    {
      id: 7,
      title: "Settled income offset",
      cat: "salary",
      catLabel: "Salary",
      time: "",
      date: "2026-07-06T12:00",
      amount: 123_000,
      btcAt: 100_000_000,
      settled: true,
    },
  ],
  categoriesById,
  { startDate: "2026-07-01", endDate: "2026-07-31" },
  "2026-07-03"
);
assert.deepEqual(
  unsettledCashflow,
  { incomeKrw: 0, expenseKrw: 2_050_000 },
  "sell-needed inputs use unsettled living cashflow with date fallback"
);

const sellNeeded = sellCalculator.calculateSellNeeded({
  incomeKrw: unsettledCashflow.incomeKrw,
  expenseKrw: unsettledCashflow.expenseKrw,
  btcKrw: 150_000_000,
  heldBtc: 0.5,
  monthlyCashKrw: 865_564,
});
assert.equal(sellNeeded.totalDeficitKrw, 2_050_000, "pre-cash required KRW is unsettled expense minus income");
assert.equal(sellNeeded.deficitKrw, 1_184_436, "sell-needed KRW subtracts account balance");
assert.equal(
  sellNeeded.sellSats,
  Math.round((1_184_436 / 150_000_000) * 100_000_000),
  "sell-needed sats use the current BTC price"
);

const fullySettled = sellCalculator.calculateSellNeeded({
  incomeKrw: 0,
  expenseKrw: 0,
  btcKrw: 150_000_000,
  heldBtc: 0.5,
  monthlyCashKrw: 865_564,
});
assert.equal(fullySettled.deficitKrw, 0, "all-settled months need no sale");
assert.equal(fullySettled.sellSats, 0, "all-settled months produce zero sats");

const typesSrc = readFileSync("src/types.ts", "utf8");
assert.match(typesSrc, /settled\?:\s*boolean/, "Txn supports optional settled state");

const ledgerContextSrc = readFileSync("src/state/LedgerContext.tsx", "utf8");
assert.match(ledgerContextSrc, /setTxnSettled/, "LedgerContext exposes a settled-state updater");
assert.match(ledgerContextSrc, /SET_TXN_SETTLED/, "LedgerContext persists settled-state changes");
assert.match(ledgerContextSrc, /typeof txn\.settled === "boolean"/, "persisted transactions accept optional settled state");

const homePageSrc = readFileSync("src/components/home/HomePage.tsx", "utf8");
assert.match(homePageSrc, /calculateUnsettledLivingCashflow/, "HomePage uses unsettled cashflow");
assert.match(homePageSrc, /monthlyCashKrw:\s*monthlyCash/, "HomePage sends account balance into calculateSellNeeded");
assert.doesNotMatch(homePageSrc, /<InOutCards\b/, "HomePage removes the separate income/expense/net cards");

const sellCardSrc = readFileSync("src/components/home/SellNeededCard.tsx", "utf8");
assert.match(sellCardSrc, /아직 정산 안 된 지출/, "SellNeededCard shows unsettled expenses");
assert.match(sellCardSrc, /아직 정산 안 된 수입/, "SellNeededCard shows unsettled income");
assert.match(sellCardSrc, /통장 잔고/, "SellNeededCard shows account balance input");
assert.match(sellCardSrc, /팔아야 할 돈/, "SellNeededCard shows final sell-needed KRW");
assert.match(sellCardSrc, /onMonthlyCashChange/, "SellNeededCard persists account balance from home");
assert.doesNotMatch(sellCardSrc, /monthlySellSummary/, "SellNeededCard does not mix sale history into sell-needed calculation");

const modalSrc = readFileSync("src/components/home/SellConfirmModal.tsx", "utf8");
assert.match(modalSrc, /applyAccountBalance\(result\.totalDeficitKrw,\s*cashKrw,\s*currentBtcKrw\)/, "modal uses unified formula with editable cash");
assert.doesNotMatch(modalSrc, /requiredBeforeCashKrw/, "modal removes old requiredBeforeCashKrw path");
assert.doesNotMatch(modalSrc, /sellRecordCoverageKrw/, "modal removes old sell-record coverage path");

const txnRowSrc = readFileSync("src/components/home/TxnRow.tsx", "utf8");
assert.match(txnRowSrc, /isTxnSettled/, "TxnRow uses shared settled fallback");
assert.match(txnRowSrc, /출금완료/, "TxnRow shows expense settled toggle copy");
assert.match(txnRowSrc, /입금완료/, "TxnRow shows income settled toggle copy");

const txnsCardSrc = readFileSync("src/components/home/TxnsCard.tsx", "utf8");
assert.match(txnsCardSrc, /setTxnSettled/, "home transaction list wires settled toggles");
const txnListPageSrc = readFileSync("src/components/transaction/TxnListPage.tsx", "utf8");
assert.match(txnListPageSrc, /setTxnSettled/, "full transaction list wires settled toggles");

console.log("verify:sell passed");
