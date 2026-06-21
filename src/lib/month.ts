/** Month utility functions for current-month display and month navigation */

/** "YYYY-MM" key for today */
export function getCurrentMonthKey(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

/** "YYYY년 M월" label for today */
export function getCurrentMonthLabel(): string {
  return getMonthLabel(getCurrentMonthKey());
}

/** "YYYY-MM" key from any Date */
export function getMonthKey(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
}

/** "YYYY년 M월" from a "YYYY-MM" key */
export function getMonthLabel(monthKey: string): string {
  const [year, month] = monthKey.split("-");
  return `${year}년 ${parseInt(month, 10)}월`;
}

/** "YYYY" from a "YYYY-MM" key */
export function getYearFromMonthKey(monthKey: string): string {
  return monthKey.split("-")[0];
}

/** Add delta months to a "YYYY-MM" key and return a new "YYYY-MM" key */
export function addMonthsToMonthKey(monthKey: string, delta: number): string {
  const [y, m] = monthKey.split("-").map(Number);
  const d = new Date(y, m - 1 + delta, 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

/** Previous month key */
export function getPreviousMonthKey(monthKey: string): string {
  return addMonthsToMonthKey(monthKey, -1);
}

/** Next month key */
export function getNextMonthKey(monthKey: string): string {
  return addMonthsToMonthKey(monthKey, 1);
}

/** Check if a monthKey is the current month */
export function isCurrentMonth(monthKey: string): boolean {
  return monthKey === getCurrentMonthKey();
}

/** Parse "YYYY-MM" into a Date (1st of that month) for anchorDate usage */
export function monthKeyToAnchorDate(monthKey: string): Date {
  const [y, m] = monthKey.split("-").map(Number);
  return new Date(y, m - 1, 15); // mid-month avoids timezone edge cases
}

/** "YYYY-MM" key format check, e.g. "2026-05" */
export function isValidMonthKey(value: string | null): value is string {
  return !!value && /^\d{4}-\d{2}$/.test(value);
}

/**
 * <input type="datetime-local"> default value for a given month key — 1일, 현재 시각 기준.
 * 홈에서 보고 있던 월로 거래 입력 화면을 열었을 때 그 월에 바로 기록되도록 한다.
 */
export function monthKeyToDatetimeLocal(monthKey: string): string {
  const [y, m] = monthKey.split("-").map(Number);
  const now = new Date();
  const d = new Date(y, m - 1, 1, now.getHours(), now.getMinutes());
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(
    d.getMinutes()
  )}`;
}

/** "YYYY-MM-DD" key from a Date — 통계 달력에서 날짜를 묶는 키로 쓴다. */
export function dateKeyFromDate(date: Date): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

/** "YYYY-MM-DD" key from an ISO datetime string (Txn.date 형식) */
export function dateKeyFromIso(iso: string): string {
  return dateKeyFromDate(new Date(iso));
}

/** "YYYY-MM-DD" key for today */
export function getTodayDateKey(): string {
  return dateKeyFromDate(new Date());
}

/** "YYYY-MM" 월의 일수 */
export function getDaysInMonth(monthKey: string): number {
  const [y, m] = monthKey.split("-").map(Number);
  return new Date(y, m, 0).getDate();
}

/** "YYYY-MM" 월 1일의 요일(0=일 ~ 6=토) — 달력 grid의 앞쪽 빈 칸 수로 쓴다. */
export function getFirstWeekdayOfMonth(monthKey: string): number {
  const [y, m] = monthKey.split("-").map(Number);
  return new Date(y, m - 1, 1).getDay();
}

/** "YYYY-MM-DD"의 요일(0=일 ~ 6=토) — 정산기간 달력의 앞쪽 빈 칸 수를 셀 때 쓴다. */
export function getWeekdayOfDateKey(dateKeyStr: string): number {
  const [y, m, d] = dateKeyStr.split("-").map(Number);
  return new Date(y, m - 1, d).getDay();
}

/** startDate~endDate(둘 다 포함, "YYYY-MM-DD") 사이의 모든 날짜 키를 순서대로 반환한다. */
export function enumerateDateKeysInRange(startDate: string, endDate: string): string[] {
  const [sy, sm, sd] = startDate.split("-").map(Number);
  const [ey, em, ed] = endDate.split("-").map(Number);
  const end = new Date(ey, em - 1, ed);
  const out: string[] = [];
  for (let d = new Date(sy, sm - 1, sd); d <= end; d = new Date(d.getFullYear(), d.getMonth(), d.getDate() + 1)) {
    out.push(dateKeyFromDate(d));
  }
  return out;
}
