const STORAGE_KEY = "myledger.walletName.v1";
const DEFAULT_NAME = "Leaky Sats";
const MAX_LENGTH = 24;
const MIN_LENGTH = 2;

export function loadWalletName(): string {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw && raw.trim().length >= MIN_LENGTH) return raw.trim();
  } catch {
    // fall through
  }
  return DEFAULT_NAME;
}

export function saveWalletName(name: string): string {
  const trimmed = name.trim().slice(0, MAX_LENGTH);
  const final = trimmed.length >= MIN_LENGTH ? trimmed : DEFAULT_NAME;
  try {
    if (final === DEFAULT_NAME) {
      localStorage.removeItem(STORAGE_KEY);
    } else {
      localStorage.setItem(STORAGE_KEY, final);
    }
  } catch {
    // keep in-memory value
  }
  return final;
}

export { DEFAULT_NAME, MAX_LENGTH, MIN_LENGTH, STORAGE_KEY };
