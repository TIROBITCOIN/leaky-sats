import type { LedgerData } from "../types";

// 과거 디자인 레퍼런스의 DUMMY를 포팅한 데이터. date 필드만 통계 탭의
// 기간 필터링을 위해 time 라벨에 맞춰 추가했다.
export const DUMMY: LedgerData = {
  month: "2026년 4월",
  blockHeight: 894217,
  btcKRW: 158_000_000,
  btcUSD: 117_400,
  usdKRW: 1346,
  balance: 1_847_500,
  income: 3_200_000,
  expense: 1_352_500,
  txns: [
    { id: 1, title: "DCA Buy", cat: "btc_buy", catLabel: "BTC 구매", time: "오늘 09:02", date: "2026-04-26T09:02", amount: -200_000, btcAt: 158_000_000 },
    { id: 2, title: "신한카드", cat: "card_bill", catLabel: "카드대금", time: "오늘 08:14", date: "2026-04-26T08:14", amount: -823_450, btcAt: 158_120_000 },
    { id: 3, title: "Netflix", cat: "subscription", catLabel: "구독료", time: "어제 19:42", date: "2026-04-25T19:42", amount: -17_000, btcAt: 157_840_000 },
    { id: 4, title: "April Salary", cat: "salary", catLabel: "월급", time: "4월 25일", date: "2026-04-25T10:00", amount: 3_200_000, btcAt: 156_900_000 },
    { id: 5, title: "관리비", cat: "management_fee", catLabel: "관리비", time: "4월 24일", date: "2026-04-24T08:30", amount: -150_000, btcAt: 156_500_000 },
  ],
};
