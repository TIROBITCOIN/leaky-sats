import type { CategoryDef, CategoryGroup } from "../types";

// 그룹별 카테고리 삭제 시 연결된 거래가 재배정되는 폴백 카테고리 id
export const DEFAULT_FALLBACK: Record<"expense" | "income", string> = {
  expense: "etc",
  income: "etc_income",
};

// 보호 카테고리: 삭제 불가(이름/색/아이콘 편집은 가능). 기타/기타수입은 폴백 대상이라 항상
// 존재해야 하고, BTC 매수/매도는 자산 탭의 보유수량 계산이 id로 직접 참조하므로 보호한다.
export const PROTECTED_IDS = new Set(["etc", "etc_income", "btc_buy", "btc_sell"]);

// Phase 10: 큰 항목(src/lib/majorItems.ts) 중심으로 단순화한 기본 카테고리 seed.
// 신규 설치 시에만 이 목록이 그대로 적용된다 — 기존 사용자가 이미 저장해 둔 카테고리는
// LedgerContext.normalizeCategories()가 별도로 보존하므로 여기서 빠진 과거 카테고리(식비, 카페 등)도
// 삭제되지 않는다.
export const BUILT_IN_CATEGORIES: CategoryDef[] = [
  // ---- 지출 10 ----
  { id: "card_bill", label: "카드대금", group: "expense", flow: "expense", icon: "bag", fg: "#c084fc" },
  { id: "insurance", label: "보험비", group: "expense", flow: "expense", icon: "shield", fg: "#94a3b8" },
  { id: "telecom", label: "통신비", group: "expense", flow: "expense", icon: "phone", fg: "#38bdf8" },
  { id: "management_fee", label: "관리비", group: "expense", flow: "expense", icon: "home", fg: "#a78bfa" },
  { id: "rent", label: "월세", group: "expense", flow: "expense", icon: "home", fg: "#818cf8" },
  { id: "mortgage_interest", label: "주거대출이자", group: "expense", flow: "expense", icon: "percent", fg: "#fb7185" },
  { id: "loan_payment", label: "대출원리금", group: "expense", flow: "expense", icon: "banknote", fg: "#f87171" },
  { id: "subscription", label: "구독료", group: "expense", flow: "expense", icon: "ticket", fg: "#facc15" },
  { id: "events", label: "경조사비", group: "expense", flow: "expense", icon: "gift", fg: "#fda4af" },
  { id: "etc", label: "기타지출", group: "expense", flow: "expense", icon: "dots", fg: "#d4d4d4", protected: true },

  // ---- 수입 7 ----
  { id: "salary", label: "월급", group: "income", flow: "income", icon: "banknote", fg: "#4ade80" },
  { id: "bonus", label: "상여/수당", group: "income", flow: "income", icon: "gift", fg: "#fcd34d" },
  { id: "side_income", label: "부업수입", group: "income", flow: "income", icon: "trending", fg: "#86efac" },
  { id: "refund", label: "환급/정산", group: "income", flow: "income", icon: "refresh", fg: "#5eead4" },
  { id: "interest", label: "이자/배당", group: "income", flow: "income", icon: "percent", fg: "#a3e635" },
  { id: "allowance", label: "지원금/용돈", group: "income", flow: "income", icon: "piggy", fg: "#fbbf24" },
  {
    id: "etc_income",
    label: "기타수입",
    group: "income",
    flow: "income",
    icon: "arrowDown",
    fg: "#94a3b8",
    protected: true,
  },

  // ---- 투자 2 ----
  {
    id: "btc_buy",
    label: "BTC 구매",
    group: "invest",
    flow: "expense",
    icon: "bitcoin",
    fg: "#f7931a",
    protected: true,
  },
  {
    id: "btc_sell",
    label: "BTC 판매",
    group: "invest",
    flow: "income",
    icon: "bitcoin",
    fg: "#4ade80",
    protected: true,
  },
];

export const GROUP_LABEL: Record<CategoryGroup, string> = {
  expense: "지출",
  income: "수입",
  invest: "투자",
};
