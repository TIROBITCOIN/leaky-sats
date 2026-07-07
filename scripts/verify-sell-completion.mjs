import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import ts from "typescript";

const root = process.cwd();
const read = (file) => readFileSync(join(root, file), "utf8");
const compilerOptions = { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 };
const moduleUrl = (source) =>
  `data:text/javascript;base64,${Buffer.from(ts.transpileModule(source, { compilerOptions }).outputText).toString("base64")}`;

const sellCompletion = await import(moduleUrl(read("src/lib/sellCompletion.ts")));

const result = {
  incomeKrw: 6_276_123,
  expenseKrw: 8_100_976,
  netKrw: -1_824_853,
  totalDeficitKrw: 1_824_853,
  deficitKrw: 1_824_853,
  sellBtc: 0.01934542,
  sellSats: 1_934_542,
  heldBtc: 1,
  heldValueKrw: 94_330_000,
  afterSellBtc: 0.98065458,
  canCoverDeficit: true,
};

const emptySummary = { totalBtcSold: 0, totalSatsSold: 0, totalKrwCovered: 0, count: 0 };
assert.equal(
  sellCompletion.isSellCompleted(result, emptySummary, []),
  false,
  "no sell record means the sell button stays available",
);

const completedRecord = {
  id: "sell_full",
  month: "2026-07",
  date: "2026-07-07",
  btcSold: 0.01934542,
  satsSold: 1_934_542,
  btcKrwAtSell: 94_330_000,
  krwCovered: 1_824_852,
  deficitKrwAtConfirm: 1_824_853,
  deductedFromHeldBtc: true,
  deductedBtcAmount: 0.01934542,
  createdAt: "2026-07-07T08:00:00.000Z",
};

assert.equal(
  sellCompletion.isSellCompleted(
    result,
    { totalBtcSold: completedRecord.btcSold, totalSatsSold: completedRecord.satsSold, totalKrwCovered: completedRecord.krwCovered, count: 1 },
    [completedRecord],
  ),
  true,
  "a record that sold the sats required for its confirmed deficit completes the card even with KRW rounding drift",
);

const partialRecord = {
  ...completedRecord,
  id: "sell_partial",
  satsSold: 900_000,
  btcSold: 0.009,
  krwCovered: 849_000,
  deductedBtcAmount: 0.009,
};

assert.equal(
  sellCompletion.isSellCompleted(
    result,
    { totalBtcSold: partialRecord.btcSold, totalSatsSold: partialRecord.satsSold, totalKrwCovered: partialRecord.krwCovered, count: 1 },
    [partialRecord],
  ),
  false,
  "partial sale records do not complete the card",
);

const sellCardSrc = read("src/components/home/SellNeededCard.tsx");
assert.match(sellCardSrc, /isSellCompleted\(/, "SellNeededCard uses the shared completion helper");

console.log("verify:sell-completion passed");
