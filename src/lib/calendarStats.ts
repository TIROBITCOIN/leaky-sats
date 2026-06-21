import type { CategoryDef, Txn } from "../types";
import { dateKeyFromIso } from "./month";
import type { SettlementPeriod } from "./settlement";

export interface DayStats {
  incomeKrw: number;
  expenseKrw: number;
  count: number;
}

export interface MonthCalendarStats {
  incomeKrw: number;
  expenseKrw: number;
  netKrw: number;
  /** key: "YYYY-MM-DD" — 생활 수입/지출만 집계(투자 그룹 제외) */
  byDay: Record<string, DayStats>;
  /** 정산기간에 속하는 거래 전체(투자 그룹 포함) — 카테고리 분포, 선택일 상세 등에서 재사용 */
  txns: Txn[];
}

function isInvestCategory(catId: string, categoriesById: Record<string, CategoryDef>): boolean {
  return categoriesById[catId]?.group === "invest";
}

/**
 * 정산기간 달력 통계. sellCalculator.calculateMonthlyLivingCashflow와 같은 기준으로 invest 그룹
 * (BTC 구매/판매)을 생활 수입/지출 합계에서 제외해 판매해야 하는 비트코인 계산과 기준을 맞춘다.
 * BTC 거래 자체는 txns에 그대로 남아있어 선택일 상세에서는 표시할 수 있다.
 * period는 settlementDay가 1이면 달력월 전체와 동일하고, 그 외에는 두 달에 걸칠 수 있다.
 */
export function calculateMonthCalendarStats(
  txns: Txn[],
  categoriesById: Record<string, CategoryDef>,
  period: SettlementPeriod
): MonthCalendarStats {
  const byDay: Record<string, DayStats> = {};
  const periodTxns: Txn[] = [];
  let incomeKrw = 0;
  let expenseKrw = 0;

  for (const t of txns) {
    const key = dateKeyFromIso(t.date);
    if (key < period.startDate || key > period.endDate) continue;
    periodTxns.push(t);
    if (isInvestCategory(t.cat, categoriesById)) continue;

    const day = byDay[key] ?? { incomeKrw: 0, expenseKrw: 0, count: 0 };
    if (t.amount > 0) {
      day.incomeKrw += t.amount;
      incomeKrw += t.amount;
    } else {
      day.expenseKrw += Math.abs(t.amount);
      expenseKrw += Math.abs(t.amount);
    }
    day.count += 1;
    byDay[key] = day;
  }

  return { incomeKrw, expenseKrw, netKrw: incomeKrw - expenseKrw, byDay, txns: periodTxns };
}

/** 특정 날짜("YYYY-MM-DD")에 속하는 거래(투자 그룹 포함) — 최신순 */
export function listTxnsForDay(txns: Txn[], dayKey: string): Txn[] {
  return txns
    .filter((t) => dateKeyFromIso(t.date) === dayKey)
    .slice()
    .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
}
