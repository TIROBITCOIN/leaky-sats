import type { CategoryDef, Txn } from "../types";
import { dateKeyFromIso } from "./month";

export interface SellResult {
  incomeKrw: number;
  expenseKrw: number;
  netKrw: number;
  totalDeficitKrw: number;
  confirmedCoverageKrw: number;
  deficitKrw: number;
  sellBtc: number;
  sellSats: number;
  heldBtc: number;
  heldValueKrw: number;
  afterSellBtc: number;
  canCoverDeficit: boolean;
}

/** 정산기간(시작일~종료일, inclusive)에 속하는 거래만 남긴다. */
function filterByPeriod(txns: Txn[], period: { startDate: string; endDate: string }): Txn[] {
  return txns.filter((t) => {
    const key = dateKeyFromIso(t.date);
    return key >= period.startDate && key <= period.endDate;
  });
}

/** Check if a category ID belongs to the invest group */
function isInvestCategory(catId: string, categoriesById: Record<string, CategoryDef>): boolean {
  const cat = categoriesById[catId];
  return cat?.group === "invest";
}

/**
 * Calculate living cashflow for a settlement period, excluding invest (btc_buy/btc_sell)
 * transactions. period는 src/lib/settlement.ts의 getSettlementPeriod() 결과를 그대로 넘기면 된다 —
 * settlementDay가 1이면 기존처럼 달력월 전체와 동일하다.
 */
export function calculateMonthlyLivingCashflow(
  txns: Txn[],
  categoriesById: Record<string, CategoryDef>,
  period: { startDate: string; endDate: string }
): { incomeKrw: number; expenseKrw: number } {
  const periodTxns = filterByPeriod(txns, period);
  let incomeKrw = 0;
  let expenseKrw = 0;

  for (const t of periodTxns) {
    if (isInvestCategory(t.cat, categoriesById)) continue;
    if (t.amount > 0) {
      incomeKrw += t.amount;
    } else {
      expenseKrw += Math.abs(t.amount);
    }
  }

  return { incomeKrw, expenseKrw };
}

export function calculateSellNeeded({
  incomeKrw,
  expenseKrw,
  btcKrw,
  heldBtc,
  confirmedCoverageKrw = 0,
}: {
  incomeKrw: number;
  expenseKrw: number;
  btcKrw: number;
  heldBtc: number;
  confirmedCoverageKrw?: number;
}): SellResult {
  const netKrw = incomeKrw - expenseKrw;
  const totalDeficitKrw = netKrw < 0 ? Math.abs(netKrw) : 0;
  const safeCoverage = Number.isFinite(confirmedCoverageKrw) && confirmedCoverageKrw > 0 ? confirmedCoverageKrw : 0;
  const deficitKrw = Math.max(0, totalDeficitKrw - safeCoverage);

  const safeBtcKrw = Number.isFinite(btcKrw) && btcKrw > 0 ? btcKrw : 0;
  const safeHeld = Number.isFinite(heldBtc) && heldBtc >= 0 ? heldBtc : 0;

  const sellBtc = safeBtcKrw > 0 ? deficitKrw / safeBtcKrw : 0;
  const sellSats = Math.round(sellBtc * 100_000_000);
  const heldValueKrw = safeHeld * safeBtcKrw;
  const afterSellBtc = Math.max(0, safeHeld - sellBtc);
  const canCoverDeficit = deficitKrw === 0 || safeHeld >= sellBtc;

  return {
    incomeKrw,
    expenseKrw,
    netKrw,
    totalDeficitKrw,
    confirmedCoverageKrw: safeCoverage,
    deficitKrw,
    sellBtc: Number.isFinite(sellBtc) ? sellBtc : 0,
    sellSats: Number.isFinite(sellSats) ? sellSats : 0,
    heldBtc: safeHeld,
    heldValueKrw: Number.isFinite(heldValueKrw) ? heldValueKrw : 0,
    afterSellBtc: Number.isFinite(afterSellBtc) ? afterSellBtc : 0,
    canCoverDeficit,
  };
}
