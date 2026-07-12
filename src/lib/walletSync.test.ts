import { afterEach, describe, expect, it, vi } from "vitest";
import { calculateWalletScanHardCap, resolveEffectiveGapLimit, scanDescriptorWithFailover } from "./walletSync";
import { buildMempoolApiChain, clearMempoolApiHealth, isMempoolApiDead } from "./wallet/mempoolClient";

afterEach(() => {
  clearMempoolApiHealth();
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
});

describe("resolveEffectiveGapLimit", () => {
  it("uses the full configured gap limit for first-time discovery (no address cache yet)", () => {
    expect(resolveEffectiveGapLimit(undefined, 200)).toBe(200);
  });

  it("shrinks to the standard 20-address gap limit once usage has already been discovered", () => {
    // Repeat syncs (e.g. the 30s background auto-sync) only need to re-verify balances and
    // watch a standard-size gap past the already-known usage boundary, not redo a full
    // 200-address discovery scan every cycle — that would hammer the public API for nothing.
    expect(
      resolveEffectiveGapLimit({ receiveLastUsed: 3, changeLastUsed: -1, updatedAt: "2026-07-12T00:00:00.000Z" }, 200)
    ).toBe(20);
  });

  it("never grows past the configured gap limit even if that is smaller than 20", () => {
    expect(
      resolveEffectiveGapLimit({ receiveLastUsed: 3, changeLastUsed: -1, updatedAt: "2026-07-12T00:00:00.000Z" }, 5)
    ).toBe(5);
  });

  it("treats an all-unused cache (-1/-1) as not yet discovered", () => {
    expect(
      resolveEffectiveGapLimit({ receiveLastUsed: -1, changeLastUsed: -1, updatedAt: "2026-07-12T00:00:00.000Z" }, 200)
    ).toBe(200);
  });
});

function offlineResult() {
  return {
    balance: { confirmedSats: 0, unconfirmedSats: 0, totalSats: 0, utxoCount: 0, status: "offline", failedAddresses: 1, fetchedAt: "2026-07-12T00:00:00.000Z" },
    chains: [],
    scannedAddresses: [],
  } as any;
}

function onlineResult(totalSats: number) {
  return {
    balance: { confirmedSats: totalSats, unconfirmedSats: 0, totalSats, utxoCount: 0, status: "online", failedAddresses: 0, fetchedAt: "2026-07-12T00:00:00.000Z" },
    chains: [],
    scannedAddresses: [],
  } as any;
}

describe("scanDescriptorWithFailover", () => {
  it("falls back to the next API candidate when the first is fully offline (e.g. mempool.space down)", async () => {
    const chain = buildMempoolApiChain("");
    const scanFn = vi.fn(async (_descriptor, baseUrl: string) => {
      if (baseUrl === chain[0].baseUrl) return offlineResult();
      return onlineResult(12_345);
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
    expect(result.balance.totalSats).toBe(12_345);
    expect(scanFn).toHaveBeenCalledTimes(2);
    expect(isMempoolApiDead(chain[0].baseUrl)).toBe(true);
  });

  it("keeps a single base URL for the whole scan when the first candidate already works", async () => {
    const chain = buildMempoolApiChain("https://umbrel.example/api");
    const usedBaseUrls: string[] = [];
    const scanFn = vi.fn(async (_descriptor, baseUrl: string) => {
      usedBaseUrls.push(baseUrl);
      return onlineResult(1_000);
    });

    await scanDescriptorWithFailover(
      { kind: "addresses", addresses: ["bc1qcr8te4kr609gcawutmrza0j4xv80jy8z306fyu"] },
      chain,
      200,
      200,
      true,
      scanFn
    );

    expect(scanFn).toHaveBeenCalledTimes(1);
    expect(usedBaseUrls).toEqual(["https://umbrel.example/api"]);
  });

  it("returns the last offline result when every candidate in the chain is down", async () => {
    const chain = buildMempoolApiChain("");
    const scanFn = vi.fn(async () => offlineResult());

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
