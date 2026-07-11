/**
 * Orchestrates watch-only wallet scans. Dynamically imports heavy wallet/* modules.
 */
import {
  getAggregatedTotalSats,
  loadAddressCache,
  loadLastBalances,
  loadWalletConfig,
  notifyWalletSync,
  saveAddressCache,
  saveLastBalances,
  satsToBtc,
  type WalletEntry,
} from "./walletConfig";
import { setHeldBtc } from "./heldBtc";

const THROTTLE_MS = 5 * 60 * 1000;

let syncInProgress = false;
let lastSyncAttemptAt = 0;

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
  return syncInProgress;
}

export async function testMempoolConnection(
  baseUrl: string
): Promise<{ ok: boolean; height?: number; error?: string }> {
  const url = baseUrl.trim();
  if (!url) return { ok: false, error: "mempool API URL을 입력하세요." };

  const isHttp =
    /^http:\/\//i.test(url) &&
    !/^http:\/\/(localhost|127\.0\.0\.1)(:|\/|$)/i.test(url);
  if (isHttp && typeof location !== "undefined" && location.protocol === "https:") {
    return {
      ok: false,
      error:
        "HTTPS 앱에서는 http:// 노드 API를 직접 호출할 수 없습니다. Tailscale https://….ts.net 같은 HTTPS mempool API 주소를 사용하세요.",
    };
  }

  try {
    const { tipHeightUrl, fetchMempoolJson } = await import("./wallet/mempoolClient");
    const raw = await fetchMempoolJson(tipHeightUrl(url));
    const height = typeof raw === "number" ? raw : Number(raw);
    if (!Number.isFinite(height)) {
      return { ok: false, error: "응답 형식이 올바르지 않습니다." };
    }
    return { ok: true, height };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    const name = error instanceof Error ? error.name : "";
    if (name === "AbortError" || name === "TimeoutError" || /aborted|timeout/i.test(message)) {
      return {
        ok: false,
        error: "시간 초과. 기기의 Tailscale 연결, Umbrel mempool 앱, Tailscale Serve 상태를 확인하세요.",
      };
    }
    if (/Failed to fetch|NetworkError|CORS|Load failed/i.test(message)) {
      return {
        ok: false,
        error:
          "네트워크 또는 CORS 차단입니다. 주소창에서 tip height 숫자는 보이는데 앱만 실패하면 응답 헤더가 Access-Control-Allow-Origin=* 하나로 나오는지 확인하세요.",
      };
    }
    return { ok: false, error: message };
  }
}

export async function previewXpubAddresses(xpub: string): Promise<string[]> {
  const { deriveAddresses } = await import("./wallet/xpub");
  return deriveAddresses({ xpub: xpub.trim(), chain: "receive", startIndex: 0, limit: 3 }).map(
    (a) => a.address
  );
}

export async function validateXpub(xpub: string): Promise<{ ok: boolean; error?: string }> {
  try {
    const { detectExtendedPublicKeyKind, deriveAddresses } = await import("./wallet/xpub");
    detectExtendedPublicKeyKind(xpub.trim());
    deriveAddresses({ xpub: xpub.trim(), chain: "receive", startIndex: 0, limit: 1 });
    return { ok: true };
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : String(error) };
  }
}

async function syncOneWallet(
  wallet: WalletEntry,
  baseUrl: string,
  gapLimit: number,
  includeUnconfirmed: boolean
): Promise<{ status: string; totalSats: number; error?: string }> {
  const { scanWallet } = await import("./wallet/scan");
  const cache = loadAddressCache();
  const prev = cache[wallet.id];
  const hardCap =
    prev && (prev.receiveLastUsed >= 0 || prev.changeLastUsed >= 0)
      ? Math.min(200, Math.max(prev.receiveLastUsed, prev.changeLastUsed) + 1 + gapLimit)
      : 200;

  const result = await scanWallet(wallet.descriptor, baseUrl, {
    gapLimit,
    hardCap,
    batchSize: gapLimit,
    includeUnconfirmed,
  });

  // Only persist balance when online (full success for that wallet's lookups).
  // partial/offline keep previous lastBalance for that wallet.
  if (result.balance.status === "online") {
    const balances = loadLastBalances();
    balances[wallet.id] = result.balance;
    saveLastBalances(balances);

    const receive = result.chains.find((c) => c.chain === "receive");
    const change = result.chains.find((c) => c.chain === "change");
    const nextCache = loadAddressCache();
    nextCache[wallet.id] = {
      receiveLastUsed: receive?.lastUsedIndex ?? -1,
      changeLastUsed: change?.lastUsedIndex ?? -1,
      updatedAt: new Date().toISOString(),
    };
    saveAddressCache(nextCache);
  }

  return {
    status: result.balance.status,
    totalSats: result.balance.totalSats,
    error:
      result.balance.status === "online"
        ? undefined
        : result.balance.status === "partial"
          ? "일부 주소 조회 실패"
          : "조회 실패",
  };
}

/**
 * Sync all configured wallets. force=true bypasses 5-minute throttle (manual / post-sell).
 */
export async function syncAllWallets(options: { force?: boolean } = {}): Promise<SyncOutcome> {
  if (syncInProgress) {
    return {
      ok: false,
      skipped: true,
      reason: "already-running",
      walletResults: [],
      aggregatedSats: getAggregatedTotalSats().totalSats,
    };
  }

  const now = Date.now();
  if (!options.force && lastSyncAttemptAt > 0 && now - lastSyncAttemptAt < THROTTLE_MS) {
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
  if (!config.mempoolApiUrl.trim()) {
    return {
      ok: false,
      reason: "no-url",
      walletResults: [],
      aggregatedSats: getAggregatedTotalSats().totalSats,
    };
  }

  syncInProgress = true;
  lastSyncAttemptAt = now;
  const walletResults: SyncOutcome["walletResults"] = [];

  try {
    for (const wallet of config.wallets) {
      try {
        const one = await syncOneWallet(
          wallet,
          config.mempoolApiUrl,
          config.gapLimit,
          config.includeUnconfirmed
        );
        walletResults.push({
          id: wallet.id,
          label: wallet.label,
          status: one.status,
          totalSats: one.totalSats,
          error: one.error,
        });
      } catch (error) {
        walletResults.push({
          id: wallet.id,
          label: wallet.label,
          status: "offline",
          totalSats: 0,
          error: error instanceof Error ? error.message : String(error),
        });
      }
    }

    const agg = getAggregatedTotalSats();
    // Mirror aggregate into heldBtc storage for consumers that only read the key after sync.
    setHeldBtc(satsToBtc(agg.totalSats), { force: true });
    notifyWalletSync();

    const allOnline = walletResults.every((r) => r.status === "online");
    return {
      ok: allOnline,
      walletResults,
      aggregatedSats: agg.totalSats,
    };
  } finally {
    syncInProgress = false;
  }
}
