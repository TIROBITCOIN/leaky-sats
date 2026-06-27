export const MONTHLY_CASH_KEY = "myledger.monthlyCash.v1";

const MONTH_KEY_RE = /^\d{4}-\d{2}$/;

function isValidMonth(month: string): boolean {
  return MONTH_KEY_RE.test(month);
}

function safeCash(value: unknown): number | null {
  const n = typeof value === "number" ? value : Number(value);
  return Number.isFinite(n) && n >= 0 ? n : null;
}

function loadMonthlyCash(): Record<string, number> {
  try {
    const raw = localStorage.getItem(MONTHLY_CASH_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) return {};

    const result: Record<string, number> = {};
    for (const [month, value] of Object.entries(parsed)) {
      const cash = safeCash(value);
      if (isValidMonth(month) && cash !== null) result[month] = cash;
    }
    return result;
  } catch {
    return {};
  }
}

export function getMonthlyCash(month: string): number {
  if (!isValidMonth(month)) return 0;
  return loadMonthlyCash()[month] ?? 0;
}

export function setMonthlyCash(month: string, krw: number): void {
  const cash = safeCash(krw);
  if (!isValidMonth(month) || cash === null) return;

  try {
    const records = loadMonthlyCash();
    if (cash === 0) {
      delete records[month];
    } else {
      records[month] = cash;
    }

    if (Object.keys(records).length === 0) {
      localStorage.removeItem(MONTHLY_CASH_KEY);
    } else {
      localStorage.setItem(MONTHLY_CASH_KEY, JSON.stringify(records));
    }
  } catch {
    // Ignore storage failures; the rest of the app can continue without this optional value.
  }
}
