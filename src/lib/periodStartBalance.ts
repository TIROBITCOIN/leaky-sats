export const PERIOD_START_BALANCE_KEY = "myledger.periodStartBalance.v1";
export const MONTHLY_CASH_KEY = "myledger.monthlyCash.v1";

const MONTH_KEY_RE = /^\d{4}-\d{2}$/;

export interface PeriodStartBalanceRecord {
  startBalanceKrw: number;
  skipped?: boolean;
  actualBalanceKrw?: number;
}

export type PeriodStartBalanceRecords = Record<string, PeriodStartBalanceRecord>;

function isValidMonth(month: string): boolean {
  return MONTH_KEY_RE.test(month);
}

function safeNonNegative(value: unknown): number | null {
  const n = typeof value === "number" ? value : Number(value);
  return Number.isFinite(n) && n >= 0 ? n : null;
}

function normalizeRecord(value: unknown): PeriodStartBalanceRecord | null {
  if (typeof value === "number" || typeof value === "string") {
    const startBalanceKrw = safeNonNegative(value);
    return startBalanceKrw === null ? null : { startBalanceKrw };
  }
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const raw = value as Partial<PeriodStartBalanceRecord>;
  const startBalanceKrw = safeNonNegative(raw.startBalanceKrw);
  if (startBalanceKrw === null) return null;
  const actualBalanceKrw = raw.actualBalanceKrw === undefined ? undefined : safeNonNegative(raw.actualBalanceKrw);
  return {
    startBalanceKrw,
    skipped: raw.skipped === true,
    ...(actualBalanceKrw === null || actualBalanceKrw === undefined ? {} : { actualBalanceKrw }),
  };
}

export function normalizePeriodStartBalances(value: unknown): PeriodStartBalanceRecords {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  const result: PeriodStartBalanceRecords = {};
  for (const [month, rawRecord] of Object.entries(value)) {
    if (!isValidMonth(month)) continue;
    const record = normalizeRecord(rawRecord);
    if (record) result[month] = record;
  }
  return result;
}

function loadLegacyMonthlyCash(): Record<string, number> {
  try {
    const raw = localStorage.getItem(MONTHLY_CASH_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return {};
    const result: Record<string, number> = {};
    for (const [month, value] of Object.entries(parsed)) {
      const cash = safeNonNegative(value);
      if (isValidMonth(month) && cash !== null) result[month] = cash;
    }
    return result;
  } catch {
    return {};
  }
}

function migrateMonthlyCash(records: PeriodStartBalanceRecords): PeriodStartBalanceRecords {
  const legacy = loadLegacyMonthlyCash();
  if (Object.keys(legacy).length === 0) return records;
  const next = { ...records };
  for (const [month, startBalanceKrw] of Object.entries(legacy)) {
    if (!next[month]) next[month] = { startBalanceKrw };
  }
  try {
    localStorage.removeItem(MONTHLY_CASH_KEY);
  } catch {
    // The migration is best effort; invalid storage should not block app startup.
  }
  return next;
}

export function loadPeriodStartBalances(): PeriodStartBalanceRecords {
  try {
    const raw = localStorage.getItem(PERIOD_START_BALANCE_KEY);
    const records = normalizePeriodStartBalances(raw ? JSON.parse(raw) : {});
    const migrated = migrateMonthlyCash(records);
    if (JSON.stringify(migrated) !== JSON.stringify(records)) savePeriodStartBalances(migrated);
    return migrated;
  } catch {
    return migrateMonthlyCash({});
  }
}

export function savePeriodStartBalances(records: PeriodStartBalanceRecords): void {
  try {
    const normalized = normalizePeriodStartBalances(records);
    if (Object.keys(normalized).length === 0) {
      localStorage.removeItem(PERIOD_START_BALANCE_KEY);
      return;
    }
    localStorage.setItem(PERIOD_START_BALANCE_KEY, JSON.stringify(normalized));
  } catch {
    // Keep the in-memory state working when storage writes are unavailable.
  }
}
