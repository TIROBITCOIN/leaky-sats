import { dateKeyFromIso, getDaysInMonth, getTodayDateKey } from "./month";

const STORAGE_KEY = "myledger.settlementDay.v1";
const MIN_DAY = 1;
const MAX_DAY = 28;
const DEFAULT_DAY = 1;

export interface SettlementPeriod {
  startDate: string; // "YYYY-MM-DD", inclusive
  endDate: string; // "YYYY-MM-DD", inclusive
  label: string; // "2026년 7월 정산"
  rangeLabel: string; // "6월 17일 ~ 7월 16일"
}

/** 1~28 범위로 정규화. 범위를 벗어나거나 숫자가 아니면 기본값(1일)로 폴백한다. */
export function normalizeSettlementDay(day: unknown): number {
  const n = typeof day === "string" ? Number(day) : day;
  if (typeof n !== "number" || !Number.isFinite(n)) return DEFAULT_DAY;
  const rounded = Math.round(n);
  if (rounded < MIN_DAY || rounded > MAX_DAY) return DEFAULT_DAY;
  return rounded;
}

export function loadSettlementDay(): number {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw === null) return DEFAULT_DAY;
    return normalizeSettlementDay(Number(raw));
  } catch {
    return DEFAULT_DAY;
  }
}

export function saveSettlementDay(day: number): number {
  const safe = normalizeSettlementDay(day);
  try {
    localStorage.setItem(STORAGE_KEY, String(safe));
  } catch {
    // 저장이 막혀도 메모리 상의 값은 그대로 유효하게 둔다.
  }
  return safe;
}

function pad2(n: number): string {
  return String(n).padStart(2, "0");
}

function dateKey(y: number, m: number, d: number): string {
  return `${y}-${pad2(m)}-${pad2(d)}`;
}

/**
 * 선택 월(monthKey)에 대응하는 정산기간을 계산한다.
 * settlementDay가 1이면 해당 월의 1일~말일(기존 달력월과 동일).
 * settlementDay가 N(>1)이면 전월 N일 ~ 해당 월 (N-1)일.
 *
 * 예: getSettlementPeriod("2026-07", 17)
 *  → { startDate: "2026-06-17", endDate: "2026-07-16",
 *      label: "2026년 7월 정산", rangeLabel: "6월 17일 ~ 7월 16일" }
 */
export function getSettlementPeriod(monthKey: string, settlementDay: number): SettlementPeriod {
  const day = normalizeSettlementDay(settlementDay);
  const [y, m] = monthKey.split("-").map(Number);

  let startY = y;
  let startM = m;
  if (day > 1) {
    const prev = new Date(y, m - 2, 1); // 0-based Date 생성자가 연도 경계를 알아서 처리한다
    startY = prev.getFullYear();
    startM = prev.getMonth() + 1;
  }
  const startDate = dateKey(startY, startM, day);

  const endDay = day === 1 ? getDaysInMonth(monthKey) : day - 1;
  const endDate = dateKey(y, m, endDay);

  const label = `${y}년 ${m}월 정산`;
  const rangeLabel = `${startM}월 ${day}일 ~ ${m}월 ${endDay}일`;

  return { startDate, endDate, label, rangeLabel };
}

/**
 * 임의의 날짜가 어느 정산기간(monthKey)에 속하는지 계산한다.
 * settlementDay가 1이면 그냥 달력월. 그 외에는 일자가 settlementDay 이상이면 다음 달 라벨,
 * 미만이면 같은 달 라벨로 묶인다 — getSettlementPeriod의 역연산에 해당한다.
 */
export function getSettlementMonthKeyForDate(dateIso: string, settlementDay: number): string {
  const day = normalizeSettlementDay(settlementDay);
  const d = new Date(dateIso);
  const y = d.getFullYear();
  const m = d.getMonth() + 1;

  if (day === 1) return `${y}-${pad2(m)}`;

  const dom = d.getDate();
  if (dom >= day) {
    const next = new Date(y, m, 1); // m은 1-based라 그대로 넘기면 다음 달 1일이 된다
    return `${next.getFullYear()}-${pad2(next.getMonth() + 1)}`;
  }
  return `${y}-${pad2(m)}`;
}

/** "YYYY-MM-DD" 날짜 키가 정산기간 안에 있는지 — 문자열 비교로 충분하다(고정폭 zero-padded). */
export function isDateKeyWithinPeriod(dateKeyStr: string, period: SettlementPeriod): boolean {
  return dateKeyStr >= period.startDate && dateKeyStr <= period.endDate;
}

/** ISO 날짜가 정산기간 안에 있는지 */
export function isIsoWithinPeriod(dateIso: string, period: SettlementPeriod): boolean {
  return isDateKeyWithinPeriod(dateKeyFromIso(dateIso), period);
}

/**
 * 입력 화면 기본 날짜로 쓸 날짜 키 — 오늘이 정산기간 안이면 오늘, 아니면 정산기간 시작일.
 * 홈에서 보던 정산기간으로 거래를 입력할 때 자연스러운 기본값을 제공한다.
 */
export function getDefaultDateKeyForPeriod(period: SettlementPeriod): string {
  const todayKey = getTodayDateKey();
  return isDateKeyWithinPeriod(todayKey, period) ? todayKey : period.startDate;
}

/**
 * <input type="datetime-local"> 기본값 — 오늘이 정산기간 안이면 오늘 날짜+현재 시각, 아니면
 * 정산기간 시작일 00:00. 거래 입력 화면에서 정산기간을 벗어나지 않는 기본 날짜를 제공한다.
 */
export function getDefaultDatetimeLocalForPeriod(period: SettlementPeriod): string {
  const todayKey = getTodayDateKey();
  const dateKeyStr = getDefaultDateKeyForPeriod(period);
  const isToday = dateKeyStr === todayKey;
  const [y, m, d] = dateKeyStr.split("-").map(Number);
  const now = new Date();
  const dt = new Date(y, m - 1, d, isToday ? now.getHours() : 0, isToday ? now.getMinutes() : 0);
  return `${dt.getFullYear()}-${pad2(dt.getMonth() + 1)}-${pad2(dt.getDate())}T${pad2(dt.getHours())}:${pad2(
    dt.getMinutes()
  )}`;
}

export { STORAGE_KEY as SETTLEMENT_DAY_KEY };
