/**
 * Watch-only wallet sync config/state in localStorage.
 * Heavy crypto/scan code lives in src/lib/wallet/* and is loaded dynamically.
 */
import type { WalletBalance, WalletBalanceStatus } from "./wallet/balance";
import { normalizeMempoolBaseUrl } from "./wallet/mempoolClient";
import type { WalletDescriptor } from "./wallet/xpub";

export const WALLET_CONFIG_KEY = "myledger.wallet.config.v1";
export const WALLET_ADDRESS_CACHE_KEY = "myledger.wallet.addressCache.v1";
export const WALLET_LAST_BALANCE_KEY = "myledger.wallet.lastBalance.v1";
export const WALLET_SYNC_EVENT = "myledger-wallet-sync";

export const WALLET_LABEL_MIN = 2;
export const WALLET_LABEL_MAX = 24;

export type HeldBtcMode = "manual" | "wallet-sync";

export type WalletEntry = {
  id: string;
  label: string;
  descriptor: WalletDescriptor;
  includeInTotal: boolean;
  createdAt: string;
};

export type WalletSyncConfig = {
  /** true → heldBtc from chain sync (wallet-sync mode) */
  enabled: boolean;
  wallets: WalletEntry[];
  mempoolApiUrl: string;
  gapLimit: number;
  includeUnconfirmed: boolean;
};

export type AddressCacheEntry = {
  receiveLastUsed: number;
  changeLastUsed: number;
  updatedAt: string;
};

export type StoredWalletBalance = WalletBalance & {
  /** Most recent attempt, including partial/offline attempts. */
  lastAttemptAt?: string;
  lastAttemptStatus?: WalletBalanceStatus;
  lastError?: string;
  /** Most recent fully successful balance timestamp. */
  lastOnlineAt?: string;
  /** True only when no online balance existed and a first partial result was retained. */
  stale?: boolean;
};

export type AddressCacheMap = Record<string, AddressCacheEntry>;
export type LastBalanceMap = Record<string, StoredWalletBalance>;

/** Fixed defaults (no settings UI): standard BIP discovery gap + unconfirmed included. */
export const WALLET_DEFAULT_GAP_LIMIT = 20;

const DEFAULT_CONFIG: WalletSyncConfig = {
  enabled: false,
  wallets: [],
  mempoolApiUrl: "",
  gapLimit: WALLET_DEFAULT_GAP_LIMIT,
  includeUnconfirmed: true,
};

function isWalletDescriptor(value: unknown): value is WalletDescriptor {
  if (!value || typeof value !== "object") return false;
  const d = value as Partial<WalletDescriptor>;
  if (d.kind === "xpub") {
    return typeof d.xpub === "string" && d.xpub.length > 0;
  }
  if (d.kind === "addresses") {
    return Array.isArray(d.addresses) && d.addresses.every((a) => typeof a === "string" && a.length > 0);
  }
  return false;
}

function isWalletEntry(value: unknown): value is WalletEntry {
  if (!value || typeof value !== "object") return false;
  const e = value as Partial<WalletEntry>;
  return (
    typeof e.id === "string" &&
    e.id.length > 0 &&
    typeof e.label === "string" &&
    typeof e.includeInTotal === "boolean" &&
    typeof e.createdAt === "string" &&
    isWalletDescriptor(e.descriptor)
  );
}

export function normalizeWalletLabel(raw: string, fallback: string): string {
  const trimmed = raw.trim().slice(0, WALLET_LABEL_MAX);
  if (trimmed.length >= WALLET_LABEL_MIN) return trimmed;
  return fallback;
}

export function defaultWalletLabel(existingCount: number): string {
  return `지갑 ${existingCount + 1}`;
}

export function loadWalletConfig(): WalletSyncConfig {
  try {
    const raw = localStorage.getItem(WALLET_CONFIG_KEY);
    if (!raw) return { ...DEFAULT_CONFIG, wallets: [] };
    const parsed = JSON.parse(raw) as Partial<WalletSyncConfig>;
    const wallets = Array.isArray(parsed.wallets) ? parsed.wallets.filter(isWalletEntry) : [];
    return {
      enabled: parsed.enabled === true,
      wallets,
      mempoolApiUrl: typeof parsed.mempoolApiUrl === "string" ? normalizeMempoolBaseUrl(parsed.mempoolApiUrl) : "",
      // UI removed: use the fixed product default and migrate the rate-limit-heavy 200 value.
      gapLimit: WALLET_DEFAULT_GAP_LIMIT,
      includeUnconfirmed: true,
    };
  } catch {
    return { ...DEFAULT_CONFIG, wallets: [] };
  }
}

export function saveWalletConfig(config: WalletSyncConfig): boolean {
  try {
    localStorage.setItem(
      WALLET_CONFIG_KEY,
      JSON.stringify({ ...config, mempoolApiUrl: normalizeMempoolBaseUrl(config.mempoolApiUrl) })
    );
    return true;
  } catch {
    return false;
  }
}

export function loadAddressCache(): AddressCacheMap {
  try {
    const raw = localStorage.getItem(WALLET_ADDRESS_CACHE_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object") return {};
    return parsed as AddressCacheMap;
  } catch {
    return {};
  }
}

export function saveAddressCache(cache: AddressCacheMap): boolean {
  try {
    localStorage.setItem(WALLET_ADDRESS_CACHE_KEY, JSON.stringify(cache));
    return true;
  } catch {
    return false;
  }
}

export function loadLastBalances(): LastBalanceMap {
  try {
    const raw = localStorage.getItem(WALLET_LAST_BALANCE_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object") return {};
    return parsed as LastBalanceMap;
  } catch {
    return {};
  }
}

export function saveLastBalances(map: LastBalanceMap): boolean {
  try {
    localStorage.setItem(WALLET_LAST_BALANCE_KEY, JSON.stringify(map));
    return true;
  } catch {
    return false;
  }
}

export function getHeldBtcMode(): HeldBtcMode {
  return loadWalletConfig().enabled ? "wallet-sync" : "manual";
}

/** Sum the accepted display balances (last online, or a first partial marked stale). */
export function getAggregatedTotalSats(): {
  totalSats: number;
  unconfirmedSats: number;
  walletCount: number;
  includedCount: number;
  lastFetchedAt: string | null;
  oldestIncludedFetchedAt: string | null;
  anyPartialOrOffline: boolean;
  wallets: Array<{
    id: string;
    label: string;
    totalSats: number;
    unconfirmedSats: number;
    status: string;
    fetchedAt: string | null;
    lastAttemptStatus?: string;
    lastAttemptAt?: string;
    stale?: boolean;
  }>;
} {
  const config = loadWalletConfig();
  const balances = loadLastBalances();
  let totalSats = 0;
  let unconfirmedSats = 0;
  let lastFetchedAt: string | null = null;
  let oldestIncludedFetchedAt: string | null = null;
  let anyPartialOrOffline = false;
  const wallets = config.wallets.map((w) => {
    const bal = balances[w.id];
    // Legacy versions persisted offline zeroes. Only a complete online balance or a
    // first-partial snapshot is accepted for display and aggregation.
    const accepted = bal?.status === "online" || bal?.status === "partial";
    const attemptFailed = bal?.lastAttemptStatus !== undefined && bal.lastAttemptStatus !== "online";
    if (bal && (bal.status === "partial" || bal.status === "offline" || attemptFailed)) {
      anyPartialOrOffline = true;
    }
    if (w.includeInTotal && bal && accepted) {
      const sats = config.includeUnconfirmed ? bal.totalSats : bal.confirmedSats;
      totalSats += sats;
      unconfirmedSats += bal.unconfirmedSats;
      if (!lastFetchedAt || bal.fetchedAt > lastFetchedAt) lastFetchedAt = bal.fetchedAt;
      if (!oldestIncludedFetchedAt || bal.fetchedAt < oldestIncludedFetchedAt) {
        oldestIncludedFetchedAt = bal.fetchedAt;
      }
    }
    return {
      id: w.id,
      label: w.label,
      totalSats: bal && accepted ? (config.includeUnconfirmed ? bal.totalSats : bal.confirmedSats) : 0,
      unconfirmedSats: bal && accepted ? bal.unconfirmedSats : 0,
      status: bal?.status ?? "offline",
      fetchedAt: bal && accepted ? bal.fetchedAt : null,
      lastAttemptStatus: bal?.lastAttemptStatus,
      lastAttemptAt: bal?.lastAttemptAt,
      stale: bal?.stale,
    };
  });
  return {
    totalSats,
    unconfirmedSats,
    walletCount: config.wallets.length,
    includedCount: config.wallets.filter((w) => w.includeInTotal).length,
    lastFetchedAt,
    oldestIncludedFetchedAt,
    anyPartialOrOffline,
    wallets,
  };
}

export function satsToBtc(sats: number): number {
  if (!Number.isFinite(sats) || sats <= 0) return 0;
  return sats / 1e8;
}

export function generateWalletId(): string {
  return `wal_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 7)}`;
}

export function notifyWalletSync(): void {
  try {
    window.dispatchEvent(new CustomEvent(WALLET_SYNC_EVENT));
  } catch {
    // ignore
  }
}

/** Descriptor fingerprint for duplicate detection (never shown in UI). */
export function descriptorFingerprint(descriptor: WalletDescriptor): string {
  if (descriptor.kind === "xpub") return `xpub:${descriptor.scriptType ?? "auto"}:${descriptor.xpub.trim()}`;
  return `addr:${[...descriptor.addresses].map((a) => a.trim()).sort().join(",")}`;
}

export function isDuplicateDescriptor(descriptor: WalletDescriptor, wallets: WalletEntry[], excludeId?: string): boolean {
  const fp = descriptorFingerprint(descriptor);
  return wallets.some((w) => w.id !== excludeId && descriptorFingerprint(w.descriptor) === fp);
}

/** True if backup would include watch-only xpubs / address lists (privacy warning). */
export function backupContainsWatchDescriptors(): boolean {
  const config = loadWalletConfig();
  return config.wallets.some(
    (w) =>
      (w.descriptor.kind === "xpub" && w.descriptor.xpub.length > 0) ||
      (w.descriptor.kind === "addresses" && w.descriptor.addresses.length > 0)
  );
}
