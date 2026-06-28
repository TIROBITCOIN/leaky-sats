export interface IconDef {
  id: string;
  label: string;
  path: string; // space-separated "M..." subpaths, 24x24 viewBox, stroke-rendered
}

// 내장 카테고리 아이콘 + 사용자 카테고리 추가/편집 시 아이콘 피커에서 고를 수 있는 전체 목록
export const ICONS: IconDef[] = [
  { id: "fork", label: "포크", path: "M12 2v4 M8 2v6a4 4 0 0 0 8 0V2 M12 14v8" },
  {
    id: "coffee",
    label: "커피",
    path: "M4 8h12v6a4 4 0 0 1-4 4H8a4 4 0 0 1-4-4V8z M16 9h2a2 2 0 0 1 0 4h-2 M7 2.5c0 1-1 1-1 2s1 1 1 2 M10.5 2.5c0 1-1 1-1 2s1 1 1 2",
  },
  { id: "utensils", label: "식기", path: "M6 2v7a2 2 0 0 0 4 0V2 M8 9v13 M18 2c-2.5 2-2.5 7 0 9 M18 11v11" },
  {
    id: "basket",
    label: "장바구니",
    path: "M4 9h16l-1.5 9.5a2 2 0 0 1-2 1.7H7.5a2 2 0 0 1-2-1.7L4 9z M8 9V6a4 4 0 0 1 8 0v3 M9 13v4 M15 13v4",
  },
  { id: "bag", label: "쇼핑백", path: "M6 8h12l-1 12.3a2 2 0 0 1-2 1.7H9a2 2 0 0 1-2-1.7L6 8z M9 8V6a3 3 0 0 1 6 0v2" },
  {
    id: "bus",
    label: "버스",
    path: "M4 16V8a2 2 0 0 1 2-2h12a2 2 0 0 1 2 2v8 M4 16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2 M7 18v2 M17 18v2 M4 12h16 M7 8v4 M17 8v4",
  },
  { id: "home", label: "집", path: "M3 11l9-7 9 7 M5 10v9a1 1 0 0 0 1 1h4v-6h4v6h4a1 1 0 0 0 1-1v-9" },
  { id: "phone", label: "전화", path: "M5 4h3l2 5-2.5 1.5a11 11 0 0 0 5 5L14 13l5 2v3a2 2 0 0 1-2 2A15 15 0 0 1 3 6a2 2 0 0 1 2-2z" },
  { id: "medical", label: "의료", path: "M12 2a10 10 0 1 0 0.01 0 M12 8v8 M8 12h8" },
  {
    id: "paw",
    label: "발자국",
    path: "M5 8a2 2 0 1 1 0-4 2 2 0 0 1 0 4z M19 8a2 2 0 1 1 0-4 2 2 0 0 1 0 4z M9 5a2 2 0 1 1 0-4 2 2 0 0 1 0 4z M15 5a2 2 0 1 1 0-4 2 2 0 0 1 0 4z M12 22c-4 0-7-3-7-6s3-6 7-6 7 3 7 6-3 6-7 6z",
  },
  {
    id: "ticket",
    label: "티켓",
    path: "M3 9a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2v1.5a1.5 1.5 0 0 0 0 3V15a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-1.5a1.5 1.5 0 0 0 0-3V9z M9 7v10",
  },
  { id: "plane", label: "비행기", path: "M21 3L3 10l6 2 2 6 3-5.5L21 3z M11 13.5L21 3" },
  { id: "cap", label: "학사모", path: "M2 9l10-5 10 5-10 5-10-5z M6 11.5V16c0 1.5 3 3 6 3s6-1.5 6-3v-4.5" },
  { id: "shield", label: "방패", path: "M12 2l8 4v6c0 5-3.5 8.5-8 10-4.5-1.5-8-5-8-10V6l8-4z M9 12l2 2 4-4" },
  {
    id: "gift",
    label: "선물",
    path: "M3 9h18v4H3z M5 9V7a2 2 0 0 1 2-2h2a2 2 0 0 1 2 2v2 M13 9V7a2 2 0 0 1 2-2h2a2 2 0 0 1 2 2v2 M5 13v6a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1v-6 M12 9v11",
  },
  { id: "dots", label: "기타", path: "M5 12h14 M12 5v14" },
  { id: "banknote", label: "지폐", path: "M3 6h18a1 1 0 0 1 1 1v10a1 1 0 0 1-1 1H3a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1z M12 9a3 3 0 1 0 0.01 0 M5 9v6 M19 9v6" },
  { id: "trending", label: "상승", path: "M3 17l6-6 4 4 8-8 M15 7h6v6" },
  {
    id: "piggy",
    label: "저금통",
    path: "M4 12.5a5.5 5.5 0 0 1 5.5-5.5h3a5.5 5.5 0 0 1 5.5 5.5v0.5h2l-1 3h-1v1a2 2 0 0 1-2 2h-0.5v2h-3v-2h-3v2h-3v-2.3A5.5 5.5 0 0 1 4 12.5z M9.5 10h.01",
  },
  { id: "refresh", label: "환급", path: "M3 12a9 9 0 1 0 3-6.7 M3 4.5V9h4.5" },
  { id: "percent", label: "퍼센트", path: "M19 5L5 19 M7.5 7.5a2 2 0 1 0 0.01 0 M16.5 16.5a2 2 0 1 0 0.01 0" },
  {
    id: "card",
    label: "카드",
    path: "M4 6h16a1.5 1.5 0 0 1 1.5 1.5v9A1.5 1.5 0 0 1 20 18H4a1.5 1.5 0 0 1-1.5-1.5v-9A1.5 1.5 0 0 1 4 6z M2.5 10h19",
  },  { id: "arrowDown", label: "입금", path: "M12 4v14 M5 11l7 7 7-7" },
  {
    id: "bitcoin",
    label: "비트코인",
    path: "M8.5 6.5h5a2.3 2.3 0 0 1 0 4.6H8.5 M8.5 11.1h5.4a2.4 2.4 0 0 1 0 4.8H8.5 M8.5 6.5v9.4 M10.6 4.6v1.9 M10.6 15.9v1.9 M13 4.6v1.9 M13 15.9v1.9",
  },
];

export const ICONS_BY_ID: Record<string, IconDef> = Object.fromEntries(ICONS.map((i) => [i.id, i]));
