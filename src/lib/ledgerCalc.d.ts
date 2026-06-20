import type { Txn } from "../types";

export const SATS_PER_BTC: number;
export const BTC_BUY_CATEGORY_ID: "btc_buy";
export const BTC_SELL_CATEGORY_ID: "btc_sell";

export type PeriodRange = "day" | "month" | "year";

export interface CashflowSummary {
  income: number;
  expense: number;
  net: number;
}

export interface PeriodStats extends CashflowSummary {
  txns: Txn[];
}

export interface CategorySpendingEntry {
  cat: string;
  catLabel: string;
  amount: number;
  kind: "living" | "investment";
}

export interface CategorySpending {
  entries: CategorySpendingEntry[];
  total: number;
}

export interface SpendingBreakdown {
  livingExpense: number;
  investmentExpense: number;
  totalExpense: number;
}

export interface AccumulationPoint {
  id: number;
  date: string;
  satsDelta: number;
  cumulativeSats: number;
}

export interface BitcoinPortfolio {
  totalBuyKrw: number;
  totalSellKrw: number;
  netInvestedKrw: number;
  totalBuySats: number;
  totalSellSats: number;
  holdingSats: number;
  holdingBtc: number;
  currentPrice: number;
  valuationKrw: number;
  averageCostKrwPerBtc: number;
  unrealizedPnlKrw: number;
  unrealizedPnlPct: number;
  accumulation: AccumulationPoint[];
}

export function safeAmount(txn: Partial<Txn> | null | undefined): number;
export function safeBtcPrice(price: unknown): number;
export function parseTxnDate(txn: Partial<Txn> | null | undefined): Date | null;
export function getAnchorDate(txns: Partial<Txn>[], fallback?: Date): Date;
export function isSamePeriod(date: Date, anchor: Date, range: PeriodRange): boolean;
export function filterTxnsByPeriod(txns: Txn[], range?: PeriodRange, anchor?: Date): Txn[];
export function calculateCashflow(txns: Partial<Txn>[]): CashflowSummary;
export function calculatePeriodStats(txns: Txn[], range?: PeriodRange, anchor?: Date): PeriodStats;
export function isInvestmentExpense(txn: Partial<Txn> | null | undefined): boolean;
export function calculateCategorySpending(txns: Partial<Txn>[], options?: { includeInvestments?: boolean }): CategorySpending;
export function calculateSpendingBreakdown(txns: Partial<Txn>[]): SpendingBreakdown;
export function txnToBitcoinSats(txn: Partial<Txn> | null | undefined): number;
export function calculateBitcoinPortfolio(txns: Partial<Txn>[], currentBtcKRW: unknown): BitcoinPortfolio;
