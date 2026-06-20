import type { CategoryDef, Txn } from "../types";

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

/** Filter txns to current month only */
function filterCurrentMonth(txns: Txn[], anchorDate?: Date): Txn[] {
  const d = anchorDate ?? new Date();
  const year = d.getFullYear();
  const month = d.getMonth();
  return txns.filter((t) => {
    const td = new Date(t.date);
    return td.getFullYear() === year && td.getMonth() === month;
  });
}

/** Check if a category ID belongs to the invest group */
function isInvestCategory(catId: string, categoriesById: Record<string, CategoryDef>): boolean {
  const cat = categoriesById[catId];
  return cat?.group === "invest";
}

/** Calculate monthly living cashflow excluding invest (btc_buy/btc_sell) transactions */
export function calculateMonthlyLivingCashflow(
  txns: Txn[],
  categoriesById: Record<string, CategoryDef>,
  anchorDate?: Date
): { incomeKrw: number; expenseKrw: number } {
  const monthTxns = filterCurrentMonth(txns, anchorDate);
  let incomeKrw = 0;
  let expenseKrw = 0;

  for (const t of monthTxns) {
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
