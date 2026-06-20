/** Month utility functions for current-month display and future month navigation */

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
