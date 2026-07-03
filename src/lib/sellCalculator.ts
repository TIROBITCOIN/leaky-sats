import type { CategoryDef, Txn } from "../types";
import { dateKeyFromIso, getTodayDateKey } from "./month";

export interface SellResult {
  incomeKrw: number;
  expenseKrw: number;
  netKrw: number;
  totalDeficitKrw: number;
  monthlyCashKrw: number;
  deficitKrw: number;
  sellBtc: number;
  sellSats: number;
  heldBtc: number;
  heldValueKrw: number;
  afterSellBtc: number;
  canCoverDeficit: boolean;
}

export interface BalanceAdjustedSell {
  accountBalanceKrw: number;
  requiredKrw: number;
  sellKrw: number;
  sellBtc: number;
  sellSats: number;
  fullyCovered: boolean;
}

function safeNonNegative(value: number): number {
  return Number.isFinite(value) && value > 0 ? value : 0;
}

export function applyAccountBalance(requiredKrw: number, accountBalanceKrw: number, btcKrw: number): BalanceAdjustedSell {
  const safeRequired = safeNonNegative(requiredKrw);
  const safeBalance = safeNonNegative(accountBalanceKrw);
  const safeBtcKrw = safeNonNegative(btcKrw);
  const sellKrw = Math.max(0, safeRequired - safeBalance);
  const sellBtc = safeBtcKrw > 0 ? sellKrw / safeBtcKrw : 0;
  const sellSats = safeBtcKrw > 0 ? Math.round(sellBtc * 100_000_000) : 0;

  return {
    accountBalanceKrw: safeBalance,
    requiredKrw: safeRequired,
    sellKrw: Number.isFinite(sellKrw) ? sellKrw : 0,
    sellBtc: Number.isFinite(sellBtc) ? sellBtc : 0,
    sellSats: Number.isFinite(sellSats) ? sellSats : 0,
    fullyCovered: sellKrw === 0,
  };
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
 * Calculate living cashflow for a settlement period, excluding invest transactions.
 * DCA / BTC 매수는 입력 화면에서 지출로 기록되지만 btc_buy의 invest 분류 덕분에 여기서는 제외된다.
 * period는 src/lib/settlement.ts의 getSettlementPeriod() 결과를 그대로 넘기면 된다 —
 * settlementDay가 1이면 기존처럼 달력월 전체와 동일하다.
 */
export function calculateMonthlyLivingCashflow(
  txns: Txn[],
  categoriesById: Record<string, CategoryDef>,
  period: { startDate: string; endDate: string }
): { incomeKrw: number; expenseKrw: number } {
  return calculateLivingCashflow(filterByPeriod(txns, period), categoriesById);
}

export function calculateRemainingLivingCashflow(
  txns: Txn[],
  categoriesById: Record<string, CategoryDef>,
  period: { startDate: string; endDate: string },
  todayDateKey = getTodayDateKey()
): { incomeKrw: number; expenseKrw: number } {
  return calculateUnsettledLivingCashflow(txns, categoriesById, period, todayDateKey);
}

export function isTxnSettled(txn: Txn, todayDateKey = getTodayDateKey()): boolean {
  if (typeof txn.settled === "boolean") return txn.settled;
  return dateKeyFromIso(txn.date) < todayDateKey;
}

export function calculateUnsettledLivingCashflow(
  txns: Txn[],
  categoriesById: Record<string, CategoryDef>,
  period: { startDate: string; endDate: string },
  todayDateKey = getTodayDateKey()
): { incomeKrw: number; expenseKrw: number } {
  const unsettledTxns = filterByPeriod(txns, period).filter((txn) => !isTxnSettled(txn, todayDateKey));
  return calculateLivingCashflow(unsettledTxns, categoriesById);
}

function calculateLivingCashflow(
  txns: Txn[],
  categoriesById: Record<string, CategoryDef>
): { incomeKrw: number; expenseKrw: number } {
  let incomeKrw = 0;
  let expenseKrw = 0;

  for (const t of txns) {
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
  monthlyCashKrw = 0,
}: {
  incomeKrw: number;
  expenseKrw: number;
  btcKrw: number;
  heldBtc: number;
  monthlyCashKrw?: number;
}): SellResult {
  const netKrw = incomeKrw - expenseKrw;
  const totalDeficitKrw = netKrw < 0 ? Math.abs(netKrw) : 0;
  const safeMonthlyCash = safeNonNegative(monthlyCashKrw);
  const deficitKrw = Math.max(0, totalDeficitKrw - safeMonthlyCash);

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
    monthlyCashKrw: safeMonthlyCash,
    deficitKrw,
    sellBtc: Number.isFinite(sellBtc) ? sellBtc : 0,
    sellSats: Number.isFinite(sellSats) ? sellSats : 0,
    heldBtc: safeHeld,
    heldValueKrw: Number.isFinite(heldValueKrw) ? heldValueKrw : 0,
    afterSellBtc: Number.isFinite(afterSellBtc) ? afterSellBtc : 0,
    canCoverDeficit,
  };
}
