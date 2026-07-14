import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  _testInternals,
  calculateWalletScanHardCap,
  mergeAddressCacheAfterScan,
  mergeWalletBalanceAttempt,
  resolveEffectiveGapLimit,
  scanDescriptorWithFailover,
  syncAllWallets,
} from "./walletSync";
import {
  buildMempoolApiChain,
  clearMempoolApiHealth,
  isMempoolApiDead,
  markMempoolApiDead,
} from "./wallet/mempoolClient";
import type { WalletBalance } from "./wallet/balance";
import type { ScanWalletResult } from "./wallet/scan";
import {
  getAggregatedTotalSats,
  loadLastBalances,
  saveLastBalances,
  saveWalletConfig,
  type StoredWalletBalance,
} from "./walletConfig";

afterEach(() => {
  clearMempoolApiHealth();
  _testInternals.resetThrottle();
  vi.unstubAllGlobals();
  vi.useRealTimers();
});

describe("calculateWalletScanHardCap", () => {
  it("scans past the default gap so a used first xpub address can settle online", () => {
    expect(calculateWalletScanHardCap(undefined, 200)).toBe(2000);
  });

  it("keeps scanning through the last known used address plus the gap", () => {
    expect(
      calculateWalletScanHardCap(
        { receiveLastUsed: 250, changeLastUsed: 12, updatedAt: "2026-07-12T00:00:00.000Z" },
        200
      )
    ).toBe(451);
  });

  it("advances a partial discovery boundary so the next scan can complete its gap", () => {
    const prev = {
      receiveLastUsed: 3,
      changeLastUsed: -1,
      updatedAt: "2026-07-12T00:00:00.000Z",
    };
    expect(calculateWalletScanHardCap(prev, 20)).toBe(24);

    const next = mergeAddressCacheAfterScan(
      prev,
      4,
      -1,
      "2026-07-13T00:00:00.000Z"
    );
    expect(next.receiveLastUsed).toBe(4);
    expect(calculateWalletScanHardCap(next, 20)).toBe(25);
  });

  it("does not move a known discovery boundary backward after failures", () => {
    const next = mergeAddressCacheAfterScan(
      { receiveLastUsed: 10, changeLastUsed: 7, updatedAt: "2026-07-12T00:00:00.000Z" },
      3,
      -1,
      "2026-07-13T00:00:00.000Z"
    );
    expect(next).toMatchObject({ receiveLastUsed: 10, changeLastUsed: 7 });
  });
});

describe("resolveEffectiveGapLimit", () => {
  it("uses the full configured gap limit for first-time discovery", () => {
    expect(resolveEffectiveGapLimit(undefined, 200)).toBe(200);
  });

  it("shrinks to 20 addresses after usage has been discovered", () => {
    expect(
      resolveEffectiveGapLimit(
        { receiveLastUsed: 3, changeLastUsed: -1, updatedAt: "2026-07-12T00:00:00.000Z" },
        200
      )
    ).toBe(20);
  });

  it("never grows past a smaller configured gap limit", () => {
    expect(
      resolveEffectiveGapLimit(
        { receiveLastUsed: 3, changeLastUsed: -1, updatedAt: "2026-07-12T00:00:00.000Z" },
        5
      )
    ).toBe(5);
  });

  it("treats an all-unused cache as not yet discovered", () => {
    expect(
      resolveEffectiveGapLimit(
        { receiveLastUsed: -1, changeLastUsed: -1, updatedAt: "2026-07-12T00:00:00.000Z" },
        200
      )
    ).toBe(200);
  });
});

function scanResult(status: WalletBalance["status"], totalSats: number): ScanWalletResult {
  return {
    balance: {
      confirmedSats: totalSats,
      unconfirmedSats: 0,
      totalSats,
      utxoCount: 0,
      status,
      failedAddresses: status === "online" ? 0 : 1,
      fetchedAt: "2026-07-12T00:00:00.000Z",
    },
    chains: [],
    scannedAddresses: [],
    rateLimited: false,
  };
}

describe("scanDescriptorWithFailover", () => {
  it("falls back to the next API candidate when the first is offline", async () => {
    const chain = buildMempoolApiChain("");
    const scanFn = vi.fn(async (_descriptor, baseUrl: string) => {
      if (baseUrl === chain[0].baseUrl) return scanResult("offline", 0);
      return scanResult("online", 12_345);
    });

    const result = await scanDescriptorWithFailover(
      { kind: "addresses", addresses: ["bc1qcr8te4kr609gcawutmrza0j4xv80jy8z306fyu"] },
      chain,
      200,
      200,
      true,
      scanFn
    );

    expect(result.balance.totalSats).toBe(12_345);
    expect(result.rateLimited).toBe(false);
    expect(scanFn).toHaveBeenCalledTimes(2);
    expect(isMempoolApiDead(chain[0].baseUrl)).toBe(true);
  });

  it("dead-marks a 429 URL for Retry-After and preserves the signal after fallback succeeds", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-07-14T00:00:00.000Z"));
    const chain = buildMempoolApiChain("");
    const scanFn = vi.fn(async (_descriptor, baseUrl: string) => {
      if (baseUrl === chain[0].baseUrl) {
        return { ...scanResult("offline", 0), rateLimited: true, rateLimitRetryAfterMs: 120_000 };
      }
      return scanResult("online", 42_000);
    });

    const result = await scanDescriptorWithFailover(
      { kind: "addresses", addresses: ["bc1qcr8te4kr609gcawutmrza0j4xv80jy8z306fyu"] },
      chain,
      200,
      200,
      true,
      scanFn
    );

    expect(result.balance.status).toBe("online");
    expect(result.rateLimited).toBe(true);
    expect(result.rateLimitRetryAfterMs).toBe(120_000);
    expect(scanFn.mock.calls.map((call) => call[1])).toEqual([chain[0].baseUrl, chain[1].baseUrl]);
    expect(isMempoolApiDead(chain[0].baseUrl)).toBe(true);
    vi.advanceTimersByTime(119_999);
    expect(isMempoolApiDead(chain[0].baseUrl)).toBe(true);
    vi.advanceTimersByTime(1);
    expect(isMempoolApiDead(chain[0].baseUrl)).toBe(false);
  });

  it("keeps one base URL when the first candidate works", async () => {
    const chain = buildMempoolApiChain("https://umbrel.example/api");
    const scanFn = vi.fn(async (_descriptor: unknown, _baseUrl: string) =>
      scanResult("online", 1_000)
    );

    await scanDescriptorWithFailover(
      { kind: "addresses", addresses: ["bc1qcr8te4kr609gcawutmrza0j4xv80jy8z306fyu"] },
      chain,
      200,
      200,
      true,
      scanFn
    );

    expect(scanFn).toHaveBeenCalledTimes(1);
    expect(scanFn.mock.calls[0][1]).toBe("https://umbrel.example/api");
  });

  it("skips a candidate throughout its Retry-After window", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-07-14T00:00:00.000Z"));
    const chain = buildMempoolApiChain("");
    markMempoolApiDead(chain[0].baseUrl, 120_000);
    const scanFn = vi.fn(async (_descriptor: unknown, _baseUrl: string) =>
      scanResult("online", 1_000)
    );

    await scanDescriptorWithFailover(
      { kind: "addresses", addresses: ["bc1qcr8te4kr609gcawutmrza0j4xv80jy8z306fyu"] },
      chain,
      200,
      200,
      true,
      scanFn
    );

    expect(scanFn.mock.calls.map((call) => call[1])).toEqual([chain[1].baseUrl]);
  });

  it("returns the last offline result when every candidate is down", async () => {
    const chain = buildMempoolApiChain("");
    const scanFn = vi.fn(async () => scanResult("offline", 0));

    const result = await scanDescriptorWithFailover(
      { kind: "addresses", addresses: ["bc1qcr8te4kr609gcawutmrza0j4xv80jy8z306fyu"] },
      chain,
      200,
      200,
      true,
      scanFn
    );

    expect(result.balance.status).toBe("offline");
    expect(scanFn).toHaveBeenCalledTimes(chain.length);
  });
});

function walletBalance(
  status: WalletBalance["status"],
  confirmedSats: number,
  fetchedAt: string
): WalletBalance {
  return {
    confirmedSats,
    unconfirmedSats: 0,
    totalSats: confirmedSats,
    utxoCount: 1,
    status,
    failedAddresses: status === "online" ? 0 : 1,
    fetchedAt,
  };
}

function memoryStorage(): Storage {
  const data = new Map<string, string>();
  return {
    getItem: (key) => data.get(key) ?? null,
    setItem: (key, value) => data.set(key, value),
    removeItem: (key) => data.delete(key),
    clear: () => data.clear(),
    key: (index) => [...data.keys()][index] ?? null,
    get length() {
      return data.size;
    },
  } as Storage;
}

describe("mergeWalletBalanceAttempt", () => {
  const lastOnlineAt = "2026-07-13T00:00:00.000Z";
  const attemptedAt = "2026-07-14T00:00:00.000Z";
  let existing: StoredWalletBalance;

  beforeEach(() => {
    existing = {
      ...walletBalance("online", 100_000, lastOnlineAt),
      unconfirmedSats: 5_000,
      totalSats: 105_000,
      lastAttemptAt: lastOnlineAt,
      lastAttemptStatus: "online",
      lastOnlineAt,
      stale: false,
    };
  });

  it("keeps every stored amount and last-online timestamp after a partial scan", () => {
    const next = mergeWalletBalanceAttempt(
      existing,
      walletBalance("partial", 40_000, attemptedAt),
      attemptedAt
    );

    expect(next).toMatchObject({
      confirmedSats: 100_000,
      unconfirmedSats: 5_000,
      totalSats: 105_000,
      status: "online",
      fetchedAt: lastOnlineAt,
      lastOnlineAt,
      lastAttemptAt: attemptedAt,
      lastAttemptStatus: "partial",
      stale: false,
    });
  });

  it("keeps the stored amounts after an offline scan", () => {
    const next = mergeWalletBalanceAttempt(
      existing,
      walletBalance("offline", 0, attemptedAt),
      attemptedAt
    );

    expect(next).toMatchObject({
      confirmedSats: 100_000,
      unconfirmedSats: 5_000,
      totalSats: 105_000,
      status: "online",
      lastAttemptStatus: "offline",
      lastOnlineAt,
    });
  });

  it("stores a first-ever partial result as stale", () => {
    const next = mergeWalletBalanceAttempt(
      undefined,
      walletBalance("partial", 40_000, attemptedAt),
      attemptedAt
    );

    expect(next).toMatchObject({ totalSats: 40_000, status: "partial", stale: true });
  });

  it("replaces a legacy offline zero with the first partial snapshot", () => {
    const legacyOffline: StoredWalletBalance = walletBalance("offline", 0, lastOnlineAt);
    const next = mergeWalletBalanceAttempt(
      legacyOffline,
      walletBalance("partial", 40_000, attemptedAt),
      attemptedAt
    );

    expect(next).toMatchObject({ totalSats: 40_000, status: "partial", stale: true });
  });

  it("does not create a zero balance record for a first-ever offline result", () => {
    expect(
      mergeWalletBalanceAttempt(undefined, walletBalance("offline", 0, attemptedAt), attemptedAt)
    ).toBeNull();
  });

  it("accepts a lower amount only after a complete online scan", () => {
    const priorFailure = {
      ...existing,
      lastAttemptStatus: "partial" as const,
      lastError: "일부 주소 조회 실패",
    };
    const next = mergeWalletBalanceAttempt(
      priorFailure,
      walletBalance("online", 80_000, attemptedAt),
      attemptedAt
    );

    expect(next).toMatchObject({
      totalSats: 80_000,
      status: "online",
      lastAttemptStatus: "online",
      lastOnlineAt: attemptedAt,
      stale: false,
    });
    expect(next?.lastError).toBeUndefined();
  });

  it("keeps the aggregate and reports the oldest stale constituent after persistence", () => {
    vi.stubGlobal("localStorage", memoryStorage());
    saveWalletConfig({
      enabled: true,
      wallets: [
        {
          id: "w1",
          label: "지갑 1",
          descriptor: { kind: "addresses", addresses: ["bc1qtest1"] },
          includeInTotal: true,
          createdAt: lastOnlineAt,
        },
        {
          id: "w2",
          label: "지갑 2",
          descriptor: { kind: "addresses", addresses: ["bc1qtest2"] },
          includeInTotal: true,
          createdAt: lastOnlineAt,
        },
      ],
      mempoolApiUrl: "",
      gapLimit: 200,
      includeUnconfirmed: true,
    });
    const delayed = mergeWalletBalanceAttempt(
      existing,
      walletBalance("partial", 1_000, attemptedAt),
      attemptedAt
    );
    saveLastBalances({
      w1: delayed!,
      w2: {
        ...walletBalance("online", 50_000, attemptedAt),
        lastAttemptAt: attemptedAt,
        lastAttemptStatus: "online",
        lastOnlineAt: attemptedAt,
      },
    });

    const aggregate = getAggregatedTotalSats();
    expect(aggregate.totalSats).toBe(155_000);
    expect(aggregate.anyPartialOrOffline).toBe(true);
    expect(aggregate.oldestIncludedFetchedAt).toBe(lastOnlineAt);
  });

  it("does not aggregate a legacy offline zero or treat its fetchedAt as successful", () => {
    vi.stubGlobal("localStorage", memoryStorage());
    saveWalletConfig({
      enabled: true,
      wallets: [
        {
          id: "legacy",
          label: "legacy",
          descriptor: { kind: "addresses", addresses: ["bc1qtest"] },
          includeInTotal: true,
          createdAt: lastOnlineAt,
        },
      ],
      mempoolApiUrl: "",
      gapLimit: 200,
      includeUnconfirmed: true,
    });
    saveLastBalances({ legacy: walletBalance("offline", 123_000, lastOnlineAt) });

    const aggregate = getAggregatedTotalSats();
    expect(aggregate.totalSats).toBe(0);
    expect(aggregate.lastFetchedAt).toBeNull();
    expect(aggregate.oldestIncludedFetchedAt).toBeNull();
    expect(aggregate.wallets[0]).toMatchObject({ totalSats: 0, fetchedAt: null });
  });
});

describe("sync exception persistence", () => {
  it("keeps a known online amount and records an offline attempt when scanning throws", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-07-14T00:00:00.000Z"));
    vi.stubGlobal("localStorage", memoryStorage());
    const previousAt = "2026-07-13T00:00:00.000Z";
    saveWalletConfig({
      enabled: true,
      wallets: [
        {
          id: "w1",
          label: "wallet",
          descriptor: { kind: "addresses", addresses: ["bc1qtest"] },
          includeInTotal: true,
          createdAt: previousAt,
        },
      ],
      mempoolApiUrl: "",
      gapLimit: 200,
      includeUnconfirmed: true,
    });
    saveLastBalances({
      w1: {
        ...walletBalance("online", 105_000, previousAt),
        lastAttemptAt: previousAt,
        lastAttemptStatus: "online",
        lastOnlineAt: previousAt,
        stale: false,
      },
    });
    for (const candidate of buildMempoolApiChain("")) {
      markMempoolApiDead(candidate.baseUrl, 60_000);
    }

    const outcome = await syncAllWallets({ force: true });
    const saved = loadLastBalances().w1;

    expect(outcome.walletResults[0]).toMatchObject({ status: "offline", totalSats: 105_000 });
    expect(outcome.aggregatedSats).toBe(105_000);
    expect(saved).toMatchObject({
      totalSats: 105_000,
      status: "online",
      fetchedAt: previousAt,
      lastOnlineAt: previousAt,
      lastAttemptAt: "2026-07-14T00:00:00.000Z",
      lastAttemptStatus: "offline",
    });
    expect(saved.lastError).toBeTruthy();
  });
});

describe("adaptive sync backoff", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-07-14T00:00:00.000Z"));
    _testInternals.resetThrottle();
  });

  it("doubles after a 429 cycle and resets after a fully online cycle", () => {
    _testInternals.recordAttempt();
    _testInternals.applyAdaptiveBackoff(true, true);

    expect(_testInternals.currentThrottleMs).toBe(200_000);
    vi.advanceTimersByTime(199_999);
    expect(_testInternals.isWithinSyncThrottle()).toBe(true);
    vi.advanceTimersByTime(1);
    expect(_testInternals.isWithinSyncThrottle()).toBe(false);

    _testInternals.applyAdaptiveBackoff(false, true);
    expect(_testInternals.currentThrottleMs).toBe(100_000);
  });

  it("caps repeated 429 backoff at ten minutes", () => {
    for (let i = 0; i < 10; i += 1) {
      _testInternals.applyAdaptiveBackoff(true, false);
    }
    expect(_testInternals.currentThrottleMs).toBe(10 * 60 * 1000);
  });
});
