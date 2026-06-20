const STORAGE_KEY = "myledger.heldBtc.v1";

export function getHeldBtc(): number {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw === null) return 0;
    const val = parseFloat(raw);
    return Number.isFinite(val) && val >= 0 ? val : 0;
  } catch {
    return 0;
  }
}

export function setHeldBtc(value: number): number {
  const safe = Number.isFinite(value) && value >= 0 ? value : 0;
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

export { STORAGE_KEY as HELD_BTC_STORAGE_KEY };
