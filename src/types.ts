export type Currency = "KRW" | "BTC";

// 카테고리는 동적(사용자 정의 가능)이라 더 이상 고정 유니언이 아니라 문자열 id다.
export type CategoryId = string;

export type CategoryGroup = "expense" | "income" | "invest";

export interface CategoryDef {
  id: CategoryId;
  label: string;
  group: CategoryGroup;
  flow: "expense" | "income"; // 금액 부호 결정 — invest 그룹 안에서도 매수/매도가 다르다
  icon: string; // ICONS_BY_ID 참조 키
  fg: string; // hex 강조색. 배경(bg)은 hexToRgba(fg, 0.15)로 항상 파생한다
  protected?: boolean; // true면 삭제 불가(편집은 가능)
}

export interface Txn {
  id: number;
  title: string;
  cat: CategoryId;
  catLabel: string;
  time: string;
  date: string; // ISO datetime, used for sorting/period filtering
  amount: number; // KRW, negative = expense, positive = income
  btcAt: number; // KRW/BTC rate at the time of entry, used for sat conversion (immutable after creation)
  settled?: boolean;
  memo?: string;
  recurringRuleId?: string;
}

export interface LedgerData {
  month: string;
  blockHeight: number;
  btcKRW: number;
  btcUSD: number;
  usdKRW: number;
  balance: number;
  income: number;
  expense: number;
  txns: Txn[];
}

export interface NewTxnInput {
  title: string;
  cat: CategoryId;
  amount: number; // positive magnitude
  isIncome: boolean;
  date: string; // ISO datetime-local value
  settled?: boolean;
  memo?: string;
  recurringRuleId?: string;
}
