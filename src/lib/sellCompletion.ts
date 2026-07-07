import type { BtcSellRecord, MonthSellSummary } from "./btcSellRecords";
import type { SellResult } from "./sellCalculator";

const SATS_PER_BTC = 100_000_000;

function requiredSatsForRecord(record: BtcSellRecord): number {
  const deficit = Math.round(record.deficitKrwAtConfirm);
  const price = record.btcKrwAtSell;
  if (!Number.isFinite(deficit) || deficit <= 0 || !Number.isFinite(price) || price <= 0) return 0;
  return Math.round((deficit / price) * SATS_PER_BTC);
}

export function isSellCompleted(
  result: SellResult,
  monthlySellSummary: MonthSellSummary,
  records: BtcSellRecord[]
): boolean {
  const targetKrw = Math.round(result.totalDeficitKrw);
  if (targetKrw <= 0) return false;
  if (monthlySellSummary.count > 0 || records.length > 0) return true;

  const coveredKrw = Math.round(monthlySellSummary.totalKrwCovered);
  if (coveredKrw >= targetKrw) return true;

  return records.some((record) => {
    if (!record.deductedFromHeldBtc) return false;
    if (Math.round(record.deficitKrwAtConfirm) < targetKrw) return false;
    const requiredSats = requiredSatsForRecord(record);
    return requiredSats > 0 && Math.round(record.satsSold) >= requiredSats;
  });
}
