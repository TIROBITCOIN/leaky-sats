import { afterEach, describe, expect, it, vi } from "vitest";
import { lookupAddressActivity, scanWallet } from "./scan";
import { MempoolHttpError } from "./mempoolClient";

const ZPUB =
  "zpub6rFR7y4Q2AijBEqTUquhVz398htDFrtymD9xYYfG1m4wAcvPhXNfE3EfH1r1ADqtfSdVCToUG868RvUUkgDKf31mGDtKsAYz2oz2AGutZYs";

afterEach(() => {
  vi.useRealTimers();
});

function throwUtxoNotImplemented(): never {
  throw new MempoolHttpError(404);
}

function stats(
  txCount: number,
  fundedSats = 0,
  spentSats = 0,
  mempoolFundedSats = 0,
  mempoolSpentSats = 0
) {
  return {
    chain_stats: { tx_count: txCount, funded_txo_sum: fundedSats, spent_txo_sum: spentSats },
    mempool_stats: { tx_count: 0, funded_txo_sum: mempoolFundedSats, spent_txo_sum: mempoolSpentSats },
  };
}

function addressFromUrl(url: string): string {
  return decodeURIComponent(url.split("/address/")[1] ?? "");
}

describe("scanWallet", () => {
  it("defaults first xpub discovery to the standard 20-address gap", async () => {
    const fetchJson = vi.fn(async () => stats(0));

    const result = await scanWallet(
      { kind: "xpub", xpub: ZPUB },
      "https://mempool.example/api",
      { fetchJson }
    );

    expect(result.balance.status).toBe("online");
    expect(result.scannedAddresses).toHaveLength(40);
    expect(fetchJson).toHaveBeenCalledTimes(40);
  });

  it.each(["receive", "change"] as const)(
    "includes a cached %s address beyond an earlier 20-address empty gap",
    async (chain) => {
      const { deriveAddresses } = await import("./xpub");
      const firstUsed = deriveAddresses({ xpub: ZPUB, chain, startIndex: 0, limit: 1 })[0];
      const cachedLastUsed = deriveAddresses({ xpub: ZPUB, chain, startIndex: 25, limit: 1 })[0];
      const fetchJson = vi.fn(async (url: string) => {
        const address = addressFromUrl(url);
        if (address === firstUsed.address) return stats(1, 10_000);
        if (address === cachedLastUsed.address) return stats(1, 90_000);
        return stats(0);
      });

      const result = await scanWallet(
        { kind: "xpub", xpub: ZPUB },
        "https://mempool.example/api",
        {
          gapLimit: 20,
          hardCap: 46,
          batchSize: 20,
          fetchJson,
          knownLastUsed: chain === "receive" ? { receive: 25 } : { change: 25 },
        }
      );

      expect(fetchJson.mock.calls.map(([url]) => addressFromUrl(url))).toContain(cachedLastUsed.address);
      expect(result.balance.totalSats).toBe(100_000);
      expect(result.chains.find((resultChain) => resultChain.chain === chain)?.lastUsedIndex).toBe(25);
    }
  );

  it("treats an API that forgets a cached used address as non-authoritative", async () => {
    const { deriveAddresses } = await import("./xpub");
    const cachedLastUsed = deriveAddresses({
      xpub: ZPUB,
      chain: "receive",
      startIndex: 25,
      limit: 1,
    })[0];
    const fetchJson = vi.fn(async (_url: string) => stats(0));

    const result = await scanWallet(
      { kind: "xpub", xpub: ZPUB },
      "https://mempool.example/api",
      {
        gapLimit: 20,
        hardCap: 46,
        batchSize: 20,
        fetchJson,
        knownLastUsed: { receive: 25 },
      }
    );

    expect(fetchJson.mock.calls.map(([url]) => addressFromUrl(url))).toContain(cachedLastUsed.address);
    expect(result.balance.status).toBe("partial");
    expect(result.balance.failedAddresses).toBeGreaterThan(0);
    expect(result.chains.find((chain) => chain.chain === "receive")?.stoppedReason).toBe("apiFailure");
  });

  it("continues past an API-zero cached boundary and includes a newer used address", async () => {
    const { deriveAddresses } = await import("./xpub");
    const newerUsed = deriveAddresses({
      xpub: ZPUB,
      chain: "receive",
      startIndex: 30,
      limit: 1,
    })[0];
    const fetchJson = vi.fn(async (url: string) =>
      addressFromUrl(url) === newerUsed.address ? stats(1, 123_456) : stats(0)
    );

    const result = await scanWallet(
      { kind: "xpub", xpub: ZPUB },
      "https://mempool.example/api",
      {
        gapLimit: 20,
        hardCap: 51,
        batchSize: 20,
        fetchJson,
        knownLastUsed: { receive: 25 },
      }
    );

    expect(fetchJson.mock.calls.map(([url]) => addressFromUrl(url))).toContain(newerUsed.address);
    expect(result.balance).toMatchObject({ status: "partial", totalSats: 123_456 });
    expect(result.balance.failedAddresses).toBeGreaterThan(0);
    expect(result.chains.find((chain) => chain.chain === "receive")?.stoppedReason).toBe("apiFailure");
    expect(result.chains.find((chain) => chain.chain === "receive")?.lastUsedIndex).toBe(30);
  });

  it("resets gap after a used address with zero balance but history", async () => {
    const { deriveAddresses } = await import("./xpub");
    const receive = deriveAddresses({ xpub: ZPUB, chain: "receive", startIndex: 0, limit: 5 });
    const usedAddress = receive[1].address;

    const fetchJson = vi.fn(async (url: string) => {
      if (url.endsWith("/utxo")) return throwUtxoNotImplemented();
      const addr = addressFromUrl(url);
      if (addr === usedAddress) return stats(2, 5_000, 5_000); // spent == funded → zero balance, but used
      return stats(0);
    });

    const result = await scanWallet(
      { kind: "xpub", xpub: ZPUB },
      "https://mempool.example/api",
      { gapLimit: 2, hardCap: 20, batchSize: 5, fetchJson }
    );

    const receiveChain = result.chains.find((c) => c.chain === "receive");
    expect(receiveChain?.lastUsedIndex).toBe(1);
    expect(receiveChain?.stoppedReason).toBe("gap");
    // After index 1 used, need 2 consecutive unused → stops after scanning index 3
    expect(receiveChain!.addresses.length).toBeGreaterThanOrEqual(3);
  });

  it("stops with hardCap when activity never ends", async () => {
    const fetchJson = vi.fn(async (url: string) => {
      if (url.endsWith("/utxo")) return throwUtxoNotImplemented();
      return stats(1, 1_000);
    });

    const result = await scanWallet(
      { kind: "xpub", xpub: ZPUB },
      "https://mempool.example/api",
      { gapLimit: 5, hardCap: 8, batchSize: 4, fetchJson }
    );

    const receiveChain = result.chains.find((c) => c.chain === "receive");
    expect(receiveChain?.stoppedReason).toBe("hardCap");
    expect(receiveChain!.addresses.length).toBe(8);
    expect(result.balance.status).toBe("partial");
  });

  it("marks partial when some address lookups fail", async () => {
    // Use the first address to create a persistent failure (always fails, not recovered by retry)
    const failAddr = "bc1qcr8te4kr609gcawutmrza0j4xv80jy8z306fyu";
    const fetchJson = vi.fn(async (url: string) => {
      if (url.endsWith("/utxo")) return throwUtxoNotImplemented();
      const addr = addressFromUrl(url);
      if (addr === failAddr) throw new TypeError("network");
      return stats(0);
    });

    const result = await scanWallet(
      { kind: "addresses", addresses: ["bc1qcr8te4kr609gcawutmrza0j4xv80jy8z306fyu", "bc1qnjg0jd8228aq7egyzacy8cys3knf9xvrerkf9g"] },
      "https://mempool.example/api",
      { fetchJson, gapLimit: 20, hardCap: 20 }
    );

    expect(result.balance.failedAddresses).toBeGreaterThanOrEqual(1);
    expect(["partial", "offline"]).toContain(result.balance.status);
  });

  it("retries one transient address failure after 500ms and does not mark it failed", async () => {
    vi.useFakeTimers();
    const fetchJson = vi
      .fn()
      .mockRejectedValueOnce(new TypeError("network"))
      .mockResolvedValueOnce(stats(1, 1_000));

    const pending = lookupAddressActivity("https://mempool.example/api", "bc1qtest", fetchJson);
    await vi.advanceTimersByTimeAsync(500);
    const result = await pending;

    expect(result.failed).toBe(false);
    expect(result.confirmedSats).toBe(1_000);
    expect(fetchJson).toHaveBeenCalledTimes(2);
  });

  it("stops scheduling address calls after 429 and carries Retry-After upstream", async () => {
    const fetchJson = vi.fn(async () => {
      throw new MempoolHttpError(429, 120_000);
    });

    const result = await scanWallet(
      {
        kind: "addresses",
        addresses: [
          "bc1qcr8te4kr609gcawutmrza0j4xv80jy8z306fyu",
          "bc1qnjg0jd8228aq7egyzacy8cys3knf9xvrerkf9g",
          "bc1qtestthirdaddress",
        ],
      },
      "https://mempool.example/api",
      { fetchJson, concurrency: 1 }
    );

    expect(result.rateLimited).toBe(true);
    expect(result.rateLimitRetryAfterMs).toBe(120_000);
    expect(fetchJson).toHaveBeenCalledTimes(1);
  });

  it("stops scheduling new addresses after a candidate fails its retry", async () => {
    vi.useFakeTimers();
    const fetchJson = vi.fn(async () => {
      throw new TypeError("network down");
    });

    const pending = scanWallet(
      {
        kind: "addresses",
        addresses: [
          "bc1qcr8te4kr609gcawutmrza0j4xv80jy8z306fyu",
          "bc1qnjg0jd8228aq7egyzacy8cys3knf9xvrerkf9g",
          "bc1qtestthirdaddress",
        ],
      },
      "https://mempool.example/api",
      { fetchJson, concurrency: 1 }
    );
    await vi.advanceTimersByTimeAsync(500);
    const result = await pending;

    expect(fetchJson).toHaveBeenCalledTimes(2);
    expect(result.chains[0].stoppedReason).toBe("apiFailure");
  });

  it("skips the xpub change chain when the API candidate fails", async () => {
    vi.useFakeTimers();
    const fetchJson = vi.fn(async () => {
      throw new TypeError("network down");
    });

    const pending = scanWallet(
      { kind: "xpub", xpub: ZPUB },
      "https://mempool.example/api",
      { gapLimit: 2, hardCap: 2, batchSize: 2, concurrency: 1, fetchJson }
    );
    await vi.advanceTimersByTimeAsync(500);
    const result = await pending;

    expect(fetchJson).toHaveBeenCalledTimes(2);
    expect(result.chains[0].stoppedReason).toBe("apiFailure");
    expect(result.chains[1]).toMatchObject({
      chain: "change",
      addresses: [],
      stoppedReason: "apiFailure",
    });
  });

  it("aborts an in-flight address request", async () => {
    const controller = new AbortController();
    const fetchJson = vi.fn(
      (_url: string, signal?: AbortSignal) =>
        new Promise<unknown>((_resolve, reject) => {
          signal?.addEventListener("abort", () => reject(signal.reason), { once: true });
        })
    );

    const pending = scanWallet(
      { kind: "addresses", addresses: ["bc1qcr8te4kr609gcawutmrza0j4xv80jy8z306fyu"] },
      "https://mempool.example/api",
      { fetchJson, concurrency: 1, signal: controller.signal }
    );
    await Promise.resolve();
    controller.abort(new Error("cancelled"));

    await expect(pending).rejects.toThrow("cancelled");
  });

  it("cancels another worker's delayed retry after a concurrent 429", async () => {
    vi.useFakeTimers();
    const addresses = [
      "bc1qcr8te4kr609gcawutmrza0j4xv80jy8z306fyu",
      "bc1qnjg0jd8228aq7egyzacy8cys3knf9xvrerkf9g",
    ];
    const fetchJson = vi.fn(async (url: string) => {
      if (addressFromUrl(url) === addresses[0]) throw new TypeError("network");
      throw new MempoolHttpError(429);
    });

    const pending = scanWallet(
      { kind: "addresses", addresses },
      "https://mempool.example/api",
      { fetchJson, concurrency: 2 }
    );
    await Promise.resolve();
    await vi.runAllTimersAsync();
    const result = await pending;

    expect(result.rateLimited).toBe(true);
    expect(fetchJson).toHaveBeenCalledTimes(2);
  });

  it("keeps the longest Retry-After from concurrent 429 responses", async () => {
    const addresses = [
      "bc1qcr8te4kr609gcawutmrza0j4xv80jy8z306fyu",
      "bc1qnjg0jd8228aq7egyzacy8cys3knf9xvrerkf9g",
    ];
    const fetchJson = vi.fn(async (url: string) => {
      if (addressFromUrl(url) === addresses[0]) {
        throw new MempoolHttpError(429, 60_000);
      }
      await Promise.resolve();
      throw new MempoolHttpError(429, 180_000);
    });

    const result = await scanWallet(
      { kind: "addresses", addresses },
      "https://mempool.example/api",
      { fetchJson, concurrency: 2 }
    );

    expect(result.rateLimited).toBe(true);
    expect(result.rateLimitRetryAfterMs).toBe(180_000);
    expect(fetchJson).toHaveBeenCalledTimes(2);
  });

  it("addresses mode only queries listed addresses", async () => {
    const addrs = ["bc1qcr8te4kr609gcawutmrza0j4xv80jy8z306fyu"];
    const fetchJson = vi.fn(async (url: string) => {
      if (url.endsWith("/utxo")) return throwUtxoNotImplemented();
      return stats(1, 25_000);
    });

    const result = await scanWallet(
      { kind: "addresses", addresses: addrs },
      "https://mempool.example/api/",
      { fetchJson }
    );

    expect(result.scannedAddresses).toHaveLength(1);
    expect(result.balance.confirmedSats).toBe(25_000);
    expect(result.balance.status).toBe("online");
    expect(fetchJson).toHaveBeenCalled();
  });

  it("regression: electrum backend (no /utxo endpoint) still reports online with correct balance", async () => {
    const addrs = ["bc1qcr8te4kr609gcawutmrza0j4xv80jy8z306fyu", "bc1qnjg0jd8228aq7egyzacy8cys3knf9xvrerkf9g"];
    const fetchJson = vi.fn(async (url: string) => {
      // electrum (romanz/electrs) backend does not implement /address/{addr}/utxo
      if (url.endsWith("/utxo")) return throwUtxoNotImplemented();
      const addr = addressFromUrl(url);
      if (addr === addrs[0]) return stats(3, 40_000, 10_000, 5_000, 0);
      return stats(0);
    });

    const result = await scanWallet(
      { kind: "addresses", addresses: addrs },
      "https://mempool.example/api",
      { fetchJson }
    );

    expect(result.balance.status).toBe("online");
    expect(result.balance.confirmedSats).toBe(30_000); // 40_000 - 10_000
    expect(result.balance.unconfirmedSats).toBe(5_000);
    expect(result.balance.totalSats).toBe(35_000);

    const utxoCalls = fetchJson.mock.calls.filter(([url]) => url.endsWith("/utxo")).length;
    const statsCalls = fetchJson.mock.calls.filter(([url]) => !url.endsWith("/utxo")).length;
    expect(utxoCalls).toBe(0);
    expect(statsCalls).toBe(addrs.length);
  });

  it("marks offline when every stats lookup fails", async () => {
    const addrs = ["bc1qcr8te4kr609gcawutmrza0j4xv80jy8z306fyu"];
    const fetchJson = vi.fn(async (url: string) => {
      if (url.endsWith("/utxo")) return throwUtxoNotImplemented();
      throw new TypeError("network down");
    });

    const result = await scanWallet(
      { kind: "addresses", addresses: addrs },
      "https://mempool.example/api",
      { fetchJson }
    );

    expect(result.balance.status).toBe("offline");
    expect(result.balance.totalSats).toBe(0);
  });

  it("clamps negative confirmed/unconfirmed sats from malformed stats to zero", async () => {
    const addrs = ["bc1qcr8te4kr609gcawutmrza0j4xv80jy8z306fyu"];
    const fetchJson = vi.fn(async (url: string) => {
      if (url.endsWith("/utxo")) return throwUtxoNotImplemented();
      return stats(1, 100, 500); // spent > funded
    });

    const result = await scanWallet(
      { kind: "addresses", addresses: addrs },
      "https://mempool.example/api",
      { fetchJson }
    );

    expect(result.balance.confirmedSats).toBe(0);
  });
});
