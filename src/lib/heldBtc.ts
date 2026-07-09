import { getAggregatedTotalSats, getHeldBtcMode, satsToBtc, type HeldBtcMode } from "./walletConfig";

const STORAGE_KEY = "myledger.heldBtc.v1";

export type { HeldBtcMode };

export function getHeldBtc(): number {
  if (getHeldBtcMode() === "wallet-sync") {
    return satsToBtc(getAggregatedTotalSats().totalSats);
  }
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw === null) return 0;
    const val = parseFloat(raw);
    return Number.isFinite(val) && val >= 0 ? val : 0;
  } catch {
    return 0;
  }
}

/**
 * Manual mode: write localStorage.
 * Wallet-sync mode: no-op unless force (used by sync to mirror aggregate for compatibility).
 */
export function setHeldBtc(value: number, options?: { force?: boolean }): number {
  const safe = Number.isFinite(value) && value >= 0 ? value : 0;
  if (getHeldBtcMode() === "wallet-sync" && !options?.force) {
    return getHeldBtc();
  }
  try {
    localStorage.setItem(STORAGE_KEY, String(safe));
  } catch {
    // keep in-memory value
  }
  return safe;
}

export function normalizeHeldBtcInput(input: string): number {
  const trimmed = input.trim();
  if (trimmed === "") return 0;
  const val = parseFloat(trimmed);
  if (!Number.isFinite(val) || val < 0) return 0;
  return val;
}

export function calculateHeldBtcValuation(heldBtc: number, btcKrw: number): number {
  if (!Number.isFinite(heldBtc) || !Number.isFinite(btcKrw) || btcKrw <= 0) return 0;
  return heldBtc * btcKrw;
}

export { STORAGE_KEY as HELD_BTC_STORAGE_KEY, getHeldBtcMode };
