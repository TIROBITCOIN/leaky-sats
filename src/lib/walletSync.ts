/**
 * Orchestrates watch-only wallet scans. Dynamically imports heavy wallet/* modules.
 */
import {
  buildMempoolApiChain,
  clearMempoolApiHealth,
  isMempoolApiDead,
  markMempoolApiDead,
  resolveHealthyMempoolApi,
  type MempoolApiCandidate,
} from "./wallet/mempoolClient";
import {
  getAggregatedTotalSats,
  loadAddressCache,
  loadLastBalances,
  loadWalletConfig,
  notifyWalletSync,
  saveAddressCache,
  saveLastBalances,
  saveWalletConfig,
  satsToBtc,
  type AddressCacheEntry,
  type StoredWalletBalance,
  type WalletEntry,
} from "./walletConfig";
import { setHeldBtc } from "./heldBtc";
import type { WalletBalance } from "./wallet/balance";
import type { ScanWalletResult } from "./wallet/scan";
import type { ScriptType, WalletDescriptor } from "./wallet/xpub";

const DEFAULT_THROTTLE_MS = 100_000;
const MAX_THROTTLE_MS = 10 * 60 * 1000;

let activeSyncPromise: Promise<SyncOutcome> | null = null;
let lastSyncAttemptAt = 0;
let currentThrottleMs = DEFAULT_THROTTLE_MS;

export type SyncOutcome = {
  ok: boolean;
  skipped?: boolean;
  reason?: string;
  walletResults: Array<{
    id: string;
    label: string;
    status: string;
    totalSats: number;
    error?: string;
  }>;
  aggregatedSats: number;
};

export function isWalletSyncRunning(): boolean {
  return activeSyncPromise !== null;
}

export function calculateWalletScanHardCap(prev: AddressCacheEntry | undefined, gapLimit: number): number {
  const maxHardCap = 2000;
  if (prev && (prev.receiveLastUsed >= 0 || prev.changeLastUsed >= 0)) {
    const lastUsed = Math.max(prev.receiveLastUsed, prev.changeLastUsed);
    return Math.min(maxHardCap, Math.max(gapLimit + 1, lastUsed + 1 + gapLimit));
  }
  return maxHardCap;
}

/** Advances discovery boundaries after a usable scan without ever moving a known boundary back. */
export function mergeAddressCacheAfterScan(
  prev: AddressCacheEntry | undefined,
  receiveLastUsed: number,
  changeLastUsed: number,
  updatedAt: string
): AddressCacheEntry {
  return {
    receiveLastUsed: Math.max(prev?.receiveLastUsed ?? -1, receiveLastUsed),
    changeLastUsed: Math.max(prev?.changeLastUsed ?? -1, changeLastUsed),
    updatedAt,
  };
}

/** BIP-44 convention gap limit, used to bound the address range re-checked on repeat syncs. */
const STANDARD_RESYNC_GAP_LIMIT = 20;

/**
 * First-time discovery (no address cache yet) uses the full configured gap limit to find
 * where a wallet's usage ends. Once that boundary is known, every later sync — now running
 * every 2 minutes in the background against public APIs — only needs to
 * re-verify balances and watch a standard-size gap past that boundary, not redo the full
 * discovery scan every cycle.
 */
export function resolveEffectiveGapLimit(prev: AddressCacheEntry | undefined, configuredGapLimit: number): number {
  const alreadyDiscovered = !!prev && (prev.receiveLastUsed >= 0 || prev.changeLastUsed >= 0);
  return alreadyDiscovered ? Math.min(configuredGapLimit, STANDARD_RESYNC_GAP_LIMIT) : configuredGapLimit;
}

function candidateDescriptors(descriptor: WalletDescriptor): WalletDescriptor[] {
  if (descriptor.kind !== "xpub" || descriptor.scriptType || !descriptor.xpub.startsWith("xpub")) {
    return [descriptor];
  }
  return [
    descriptor,
    { ...descriptor, scriptType: "native-segwit" },
    { ...descriptor, scriptType: "nested-segwit" },
  ];
}

async function scanDescriptor(
  descriptor: WalletDescriptor,
  baseUrl: string,
  gapLimit: number,
  hardCap: number,
  includeUnconfirmed: boolean
): Promise<ScanWalletResult> {
  const { scanWallet } = await import("./wallet/scan");
  return scanWallet(descriptor, baseUrl, {
    gapLimit,
    hardCap,
    batchSize: gapLimit,
    includeUnconfirmed,
  });
}

/**
 * Scans one descriptor against the API chain: a saved self-hosted URL first (if any), then
 * the built-in public APIs. Tries alive candidates before ones currently dead-marked, so a
 * whole scan session keeps a single base URL (no mixing APIs across addresses) unless that
 * candidate comes back fully offline, in which case it's dead-marked and the next candidate
 * gets a one-shot retry of this same wallet scan.
 */
export async function scanDescriptorWithFailover(
  descriptor: WalletDescriptor,
  chain: MempoolApiCandidate[],
  gapLimit: number,
  hardCap: number,
  includeUnconfirmed: boolean,
  scanFn: typeof scanDescriptor = scanDescriptor
): Promise<ScanWalletResult> {
  const ordered = chain.filter((candidate) => !isMempoolApiDead(candidate.baseUrl));
  if (ordered.length === 0) {
    throw new Error("모든 API가 일시적으로 대기 중입니다.");
  }

  let result: ScanWalletResult | null = null;
  let rateLimitSeen = false;
  let rateLimitRetryAfterMs: number | undefined;
  for (const candidate of ordered) {
    result = await scanFn(descriptor, candidate.baseUrl, gapLimit, hardCap, includeUnconfirmed);
    if (result.rateLimited) {
      rateLimitSeen = true;
      if (result.rateLimitRetryAfterMs !== undefined) {
        rateLimitRetryAfterMs = Math.max(rateLimitRetryAfterMs ?? 0, result.rateLimitRetryAfterMs);
      }
      markMempoolApiDead(candidate.baseUrl, result.rateLimitRetryAfterMs);
      continue;
    }
    if (result.balance.status !== "offline") {
      clearMempoolApiHealth(candidate.baseUrl);
      return rateLimitSeen
        ? { ...result, rateLimited: true, rateLimitRetryAfterMs }
        : result;
    }
    markMempoolApiDead(candidate.baseUrl);
  }
  if (!result) throw new Error("mempool API chain is empty");
  return rateLimitSeen
    ? { ...result, rateLimited: true, rateLimitRetryAfterMs }
    : result;
}

function walletAttemptError(status: WalletBalance["status"], rateLimited: boolean): string {
  if (rateLimited) return "요청 한도 초과로 동기화 지연";
  return status === "offline" ? "조회 실패" : "일부 주소 조회 실패 또는 추가 스캔 필요";
}

function isAcceptedStoredBalance(balance: StoredWalletBalance): boolean {
  return balance.status === "online" || balance.status === "partial";
}

/** Applies one scan attempt without ever replacing a known amount with partial/offline data. */
export function mergeWalletBalanceAttempt(
  existing: StoredWalletBalance | undefined,
  fresh: WalletBalance,
  attemptedAt: string,
  rateLimited = false
): StoredWalletBalance | null {
  if (fresh.status === "online") {
    return {
      ...fresh,
      lastAttemptAt: attemptedAt,
      lastAttemptStatus: "online",
      lastError: undefined,
      lastOnlineAt: fresh.fetchedAt,
      stale: false,
    };
  }

  const lastError = walletAttemptError(fresh.status, rateLimited);
  if (existing && isAcceptedStoredBalance(existing)) {
    return {
      ...existing,
      lastAttemptAt: attemptedAt,
      lastAttemptStatus: fresh.status,
      lastError,
    };
  }

  if (fresh.status === "partial") {
    return {
      ...fresh,
      lastAttemptAt: attemptedAt,
      lastAttemptStatus: "partial",
      lastError,
      stale: true,
    };
  }

  if (existing) {
    return {
      ...existing,
      lastAttemptAt: attemptedAt,
      lastAttemptStatus: "offline",
      lastError,
    };
  }

  return null;
}

function persistThrownWalletAttempt(
  walletId: string,
  attemptedAt: string,
  error: string
): StoredWalletBalance | null {
  const balances = loadLastBalances();
  const existing = balances[walletId];
  const failed = mergeWalletBalanceAttempt(
    existing,
    {
      confirmedSats: 0,
      unconfirmedSats: 0,
      totalSats: 0,
      utxoCount: 0,
      status: "offline",
      failedAddresses: 0,
      fetchedAt: attemptedAt,
    },
    attemptedAt
  );
  if (!failed) return null;

  const next = { ...failed, lastError: error };
  balances[walletId] = next;
  saveLastBalances(balances);
  return next;
}

function rememberDetectedScriptType(walletId: string, scriptType: ScriptType | undefined): void {
  if (!scriptType) return;
  const config = loadWalletConfig();
  const wallets = config.wallets.map((wallet) => {
    if (wallet.id !== walletId || wallet.descriptor.kind !== "xpub") return wallet;
    return { ...wallet, descriptor: { ...wallet.descriptor, scriptType } };
  });
  saveWalletConfig({ ...config, wallets });
}

/**
 * Tries the API chain in order (self-hosted URL first if set, then the public APIs) and
 * reports which one answered. An empty customUrl means "public API only" — no self-hosted
 * node required.
 */
export async function testMempoolConnection(
  customUrl: string
): Promise<{ ok: boolean; height?: number; apiName?: string; error?: string }> {
  const trimmed = customUrl.trim();

  const isHttp =
    /^http:\/\//i.test(trimmed) &&
    !/^http:\/\/(localhost|127\.0\.0\.1)(:|\/|$)/i.test(trimmed);
  if (isHttp && typeof location !== "undefined" && location.protocol === "https:") {
    return {
      ok: false,
      error:
        "HTTPS 앱에서는 http:// 노드 API를 직접 호출할 수 없습니다. Tailscale https://….ts.net 같은 HTTPS mempool API 주소를 사용하세요.",
    };
  }

  const chain = buildMempoolApiChain(trimmed);
  const resolved = await resolveHealthyMempoolApi(chain);
  if (!resolved) {
    return {
      ok: false,
      error: "모든 API 연결에 실패했습니다. 네트워크 연결 또는 self-hosted 노드 상태를 확인하세요.",
    };
  }
  return { ok: true, height: resolved.height, apiName: resolved.candidate.name };
}

export async function previewXpubAddresses(xpub: string, scriptType?: ScriptType): Promise<string[]> {
  const { deriveAddresses } = await import("./wallet/xpub");
  return deriveAddresses({ xpub: xpub.trim(), chain: "receive", startIndex: 0, limit: 3, scriptType }).map(
    (a) => a.address
  );
}

export async function validateXpub(xpub: string, scriptType?: ScriptType): Promise<{ ok: boolean; error?: string }> {
  try {
    const { detectExtendedPublicKeyKind, deriveAddresses } = await import("./wallet/xpub");
    detectExtendedPublicKeyKind(xpub.trim());
    deriveAddresses({ xpub: xpub.trim(), chain: "receive", startIndex: 0, limit: 1, scriptType });
    return { ok: true };
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : String(error) };
  }
}

async function syncOneWallet(
  wallet: WalletEntry,
  mempoolApiUrl: string,
  gapLimit: number,
  includeUnconfirmed: boolean
): Promise<{ status: string; totalSats: number; error?: string; rateLimited?: boolean }> {
  const cache = loadAddressCache();
  const prev = cache[wallet.id];
  const effectiveGapLimit = resolveEffectiveGapLimit(prev, gapLimit);
  const hardCap = calculateWalletScanHardCap(prev, effectiveGapLimit);
  const chain = buildMempoolApiChain(mempoolApiUrl);

  let result: ScanWalletResult | null = null;
  let rateLimitSeen = false;
  let selectedDescriptor = wallet.descriptor;
  for (const descriptor of candidateDescriptors(wallet.descriptor)) {
    const next = await scanDescriptorWithFailover(descriptor, chain, effectiveGapLimit, hardCap, includeUnconfirmed);
    rateLimitSeen ||= next.rateLimited;
    result = next;
    selectedDescriptor = descriptor;
    if (next.balance.status === "offline") break;
    if (next.balance.totalSats > 0 || descriptor.kind !== "xpub") {
      break;
    }
  }

  if (!result) {
    throw new Error("지갑 스캔 실패");
  }

  const receive = result.chains.find((c) => c.chain === "receive");
  const change = result.chains.find((c) => c.chain === "change");
  const nowIso = new Date().toISOString();
  const freshBalance = {
    ...result.balance,
    scannedAddressCount: result.scannedAddresses.length,
    receiveLastUsed: receive?.lastUsedIndex ?? -1,
    changeLastUsed: change?.lastUsedIndex ?? -1,
    stoppedReason: [...new Set(result.chains.map((c) => c.stoppedReason))].join("/"),
    scriptType: selectedDescriptor.kind === "xpub" ? selectedDescriptor.scriptType : undefined,
  };

  const balances = loadLastBalances();
  const existing = balances[wallet.id];
  const nextBalance = mergeWalletBalanceAttempt(existing, freshBalance, nowIso, rateLimitSeen);
  if (nextBalance) {
    balances[wallet.id] = nextBalance;
    saveLastBalances(balances);
  }

  if (result.balance.status !== "offline") {
    const nextCache = loadAddressCache();
    nextCache[wallet.id] = mergeAddressCacheAfterScan(
      prev,
      receive?.lastUsedIndex ?? -1,
      change?.lastUsedIndex ?? -1,
      nowIso
    );
    saveAddressCache(nextCache);
  }

  if (
    selectedDescriptor.kind === "xpub" &&
    wallet.descriptor.kind === "xpub" &&
    selectedDescriptor.scriptType &&
    selectedDescriptor.scriptType !== wallet.descriptor.scriptType &&
    result.balance.status === "online" &&
    result.balance.totalSats > 0
  ) {
    rememberDetectedScriptType(wallet.id, selectedDescriptor.scriptType);
  }

  return {
    status: result.balance.status,
    totalSats:
      result.balance.status === "online"
        ? result.balance.totalSats
        : (nextBalance?.totalSats ?? result.balance.totalSats),
    error:
      result.balance.status === "online"
        ? undefined
        : result.balance.status === "partial"
          ? "일부 주소 조회 실패 또는 추가 스캔 필요"
          : "조회 실패",
    rateLimited: rateLimitSeen,
  };
}

/**
 * Sync all configured wallets. force=true bypasses adaptive throttling (manual / foreground / post-sell).
 */
export function syncAllWallets(options: { force?: boolean } = {}): Promise<SyncOutcome> {
  if (activeSyncPromise) {
    return activeSyncPromise;
  }

  const promise = runWalletSync(options);
  activeSyncPromise = promise;
  return promise.finally(() => {
    if (activeSyncPromise === promise) {
      activeSyncPromise = null;
    }
  });
}

async function runWalletSync(options: { force?: boolean } = {}): Promise<SyncOutcome> {

  const now = Date.now();
  if (!options.force && isWithinSyncThrottle(now)) {
    return {
      ok: false,
      skipped: true,
      reason: "throttled",
      walletResults: [],
      aggregatedSats: getAggregatedTotalSats().totalSats,
    };
  }

  const config = loadWalletConfig();
  if (!config.enabled || config.wallets.length === 0) {
    return {
      ok: false,
      reason: "disabled-or-empty",
      walletResults: [],
      aggregatedSats: 0,
    };
  }
  lastSyncAttemptAt = now;
  const walletResults: SyncOutcome["walletResults"] = [];
  let anyRateLimited = false;

  for (const wallet of config.wallets) {
    try {
      const one = await syncOneWallet(
        wallet,
        config.mempoolApiUrl,
        config.gapLimit,
        config.includeUnconfirmed
      );
      if (one.rateLimited) anyRateLimited = true;
      walletResults.push({
        id: wallet.id,
        label: wallet.label,
        status: one.status,
        totalSats: one.totalSats,
        error: one.error,
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      const saved = persistThrownWalletAttempt(wallet.id, new Date().toISOString(), message);
      walletResults.push({
        id: wallet.id,
        label: wallet.label,
        status: "offline",
        totalSats: saved?.totalSats ?? 0,
        error: message,
      });
    }
  }

  const allOnline = walletResults.every((r) => r.status === "online");
  applyAdaptiveBackoff(anyRateLimited, allOnline);

  const agg = getAggregatedTotalSats();
  // Mirror aggregate into heldBtc storage for consumers that only read the key after sync.
  setHeldBtc(satsToBtc(agg.totalSats), { force: true });
  notifyWalletSync();

  return {
    ok: allOnline,
    walletResults,
    aggregatedSats: agg.totalSats,
  };
}

function isWithinSyncThrottle(now: number): boolean {
  return lastSyncAttemptAt > 0 && now - lastSyncAttemptAt < currentThrottleMs;
}

function applyAdaptiveBackoff(rateLimited: boolean, allOnline: boolean): void {
  if (rateLimited) {
    currentThrottleMs = Math.min(currentThrottleMs * 2, MAX_THROTTLE_MS);
  } else if (allOnline) {
    currentThrottleMs = DEFAULT_THROTTLE_MS;
  }
}

/** Exposed for tests only — not part of public API. */
export const _testInternals = {
  get currentThrottleMs() {
    return currentThrottleMs;
  },
  set currentThrottleMs(v: number) {
    currentThrottleMs = v;
  },
  resetThrottle() {
    currentThrottleMs = DEFAULT_THROTTLE_MS;
    lastSyncAttemptAt = 0;
  },
  recordAttempt(now = Date.now()) {
    lastSyncAttemptAt = now;
  },
  isWithinSyncThrottle(now = Date.now()) {
    return isWithinSyncThrottle(now);
  },
  applyAdaptiveBackoff(rateLimited: boolean, allOnline: boolean) {
    applyAdaptiveBackoff(rateLimited, allOnline);
  },
  DEFAULT_THROTTLE_MS,
  MAX_THROTTLE_MS,
};
