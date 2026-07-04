import type { Currency } from "../types";

export const CURRENCY_STORAGE_KEY = "myledger.currency.v1";
export const REFRESH_INTERVAL_STORAGE_KEY = "myledger.refreshInterval.v1";

export const DEFAULT_CURRENCY: Currency = "KRW";
export const DEFAULT_REFRESH_INTERVAL_MS = 1_000;
export const MIN_REFRESH_INTERVAL_MS = 1_000;

export function normalizeCurrency(value: unknown): Currency {
  return value === "KRW" || value === "BTC" ? value : DEFAULT_CURRENCY;
}

export function loadCurrency(): Currency {
  try {
    const raw = localStorage.getItem(CURRENCY_STORAGE_KEY);
    return normalizeCurrency(raw);
  } catch {
    // localStorage 접근 실패 시 기본 통화로 폴백한다.
  }
  return DEFAULT_CURRENCY;
}

export function saveCurrency(currency: unknown): Currency {
  const normalized = normalizeCurrency(currency);
  try {
    localStorage.setItem(CURRENCY_STORAGE_KEY, normalized);
  } catch {
    // 저장 실패 시에도 현재 세션의 상태는 유지한다.
  }
  return normalized;
}

export function normalizeRefreshInterval(value: unknown): number {
  const interval = typeof value === "number" ? value : Number(value);
  return Number.isFinite(interval) && interval >= MIN_REFRESH_INTERVAL_MS
    ? Math.round(interval)
    : DEFAULT_REFRESH_INTERVAL_MS;
}

export function loadRefreshInterval(): number {
  try {
    const raw = localStorage.getItem(REFRESH_INTERVAL_STORAGE_KEY);
    return normalizeRefreshInterval(raw);
  } catch {
    return DEFAULT_REFRESH_INTERVAL_MS;
  }
}

export function saveRefreshInterval(intervalMs: number): number {
  const normalized = normalizeRefreshInterval(intervalMs);
  try {
    localStorage.setItem(REFRESH_INTERVAL_STORAGE_KEY, String(normalized));
  } catch {
    // 저장 실패 시에도 현재 세션의 상태는 유지한다.
  }
  return normalized;
}
