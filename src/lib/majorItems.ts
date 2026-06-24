// Phase 10: 입력 화면에서 고르는 "큰 항목" 정의. 세부 카테고리를 매번 고르게 하지 않고
// 월별 현금흐름에 잡히는 큰 항목 위주로 빠르게 입력하도록 한다.
//
// 각 MajorItem은 기존 카테고리 체계(categoryId)에 매핑된다 — 새 분류 체계를 따로 만들지 않고
// src/lib/categories.ts의 BUILT_IN_CATEGORIES를 그대로 재사용한다.
export type MajorItemFlow = "income" | "expense" | "btc";

export interface MajorItem {
  id: string;
  label: string;
  flow: MajorItemFlow;
  /** 매핑되는 카테고리 id. "BTC 판매 확정"처럼 일반 거래가 아닌 항목은 비워둔다. */
  categoryId?: string;
  categoryLabel?: string;
  /** false면 세부 입력 필드를 보여주지 않는다(예: BTC 구매). 기본값은 true로 취급. */
  requiresDetail?: boolean;
  detailLabel?: string;
  amountLabel?: string;
  placeholder?: string;
  protected?: boolean;
  /** true면 일반 거래 입력 대신 기존 BTC 판매 확정(SellConfirmModal) 흐름을 연다. */
  opensSellConfirm?: boolean;
}

export const INCOME_MAJOR_ITEMS: MajorItem[] = [
  {
    id: "salary",
    label: "월급",
    flow: "income",
    categoryId: "salary",
    detailLabel: "지급처",
    placeholder: "회사명",
    requiresDetail: false,
  },
  {
    id: "bonus",
    label: "상여/수당",
    flow: "income",
    categoryId: "bonus",
    detailLabel: "내용",
    placeholder: "명절상여, 당직수당, 성과급 등",
  },
  {
    id: "side_income",
    label: "부업수입",
    flow: "income",
    categoryId: "side_income",
    detailLabel: "지급처/내용",
    placeholder: "외부강의, 프리랜서, 중고거래 등",
  },
  {
    id: "refund",
    label: "환급/정산",
    flow: "income",
    categoryId: "refund",
    detailLabel: "내용",
    placeholder: "연말정산, 실비보험, 카드취소, 세금환급 등",
  },
  {
    id: "interest",
    label: "이자/배당",
    flow: "income",
    categoryId: "interest",
    detailLabel: "출처",
    placeholder: "예금이자, 배당금 등",
  },
  {
    id: "allowance",
    label: "지원금/용돈",
    flow: "income",
    categoryId: "allowance",
    detailLabel: "출처",
    placeholder: "가족, 정부지원금 등",
  },
  {
    id: "etc_income",
    label: "기타수입",
    flow: "income",
    categoryId: "etc_income",
    detailLabel: "내용",
    placeholder: "기타 수입 내용",
    protected: true,
  },
];

export const EXPENSE_MAJOR_ITEMS: MajorItem[] = [
  {
    id: "card_bill",
    label: "카드대금",
    flow: "expense",
    categoryId: "card_bill",
    detailLabel: "카드회사",
    placeholder: "신한카드, 현대카드, 삼성카드 등",
  },
  {
    id: "insurance",
    label: "보험비",
    flow: "expense",
    categoryId: "insurance",
    detailLabel: "보험사",
    placeholder: "삼성화재, 현대해상, DB손해보험 등",
  },
  {
    id: "telecom",
    label: "통신비",
    flow: "expense",
    categoryId: "telecom",
    detailLabel: "통신사",
    placeholder: "SKT, KT, LG U+, 알뜰폰 등",
  },
  {
    id: "management_fee",
    label: "관리비",
    flow: "expense",
    categoryId: "management_fee",
    detailLabel: "관리/납부처",
    placeholder: "아파트 관리비, 오피스텔 관리비 등",
    requiresDetail: false,
  },
  {
    id: "rent",
    label: "월세",
    flow: "expense",
    categoryId: "rent",
    detailLabel: "임대인/납부처",
    placeholder: "월세",
    requiresDetail: false,
  },
  {
    id: "mortgage_interest",
    label: "주거대출이자",
    flow: "expense",
    categoryId: "mortgage_interest",
    detailLabel: "금융기관",
    placeholder: "카카오뱅크, 국민은행 등",
  },
  {
    id: "loan_payment",
    label: "대출원리금",
    flow: "expense",
    categoryId: "loan_payment",
    detailLabel: "금융기관",
    placeholder: "카카오뱅크, 신한은행 등",
  },
  {
    id: "subscription",
    label: "구독료",
    flow: "expense",
    categoryId: "subscription",
    detailLabel: "서비스명",
    placeholder: "ChatGPT, iCloud, Netflix, YouTube Premium, 쿠팡와우 등",
  },
  {
    id: "events",
    label: "경조사비",
    flow: "expense",
    categoryId: "events",
    detailLabel: "대상/내용",
    placeholder: "결혼식, 부의금, 돌잔치 등",
    requiresDetail: false,
  },
  {
    id: "etc_expense",
    label: "기타지출",
    flow: "expense",
    categoryId: "etc",
    detailLabel: "내용",
    placeholder: "기타 지출 내용",
    protected: true,
  },
];

export const BTC_MAJOR_ITEMS: MajorItem[] = [
  {
    id: "btc_buy",
    label: "BTC 구매",
    flow: "btc",
    categoryId: "btc_buy",
    requiresDetail: false,
    protected: true,
  },
  {
    id: "btc_sell_confirm",
    label: "BTC 판매 확정",
    flow: "btc",
    requiresDetail: false,
    protected: true,
    // 기존 SellConfirmModal/btcSellRecords 흐름을 그대로 연다 — 일반 거래로 별도 저장하지 않는다.
    opensSellConfirm: true,
  },
];

export const MAJOR_ITEM_GROUPS: { label: string; items: MajorItem[] }[] = [
  { label: "수입", items: INCOME_MAJOR_ITEMS },
  { label: "지출", items: EXPENSE_MAJOR_ITEMS },
  { label: "투자", items: BTC_MAJOR_ITEMS },
];

export const ALL_MAJOR_ITEMS: MajorItem[] = [...INCOME_MAJOR_ITEMS, ...EXPENSE_MAJOR_ITEMS, ...BTC_MAJOR_ITEMS];
