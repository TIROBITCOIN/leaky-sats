import { describe, expect, it, vi } from "vitest";
import { scanWallet } from "./scan";
import { MempoolHttpError } from "./mempoolClient";

const ZPUB =
  "zpub6rFR7y4Q2AijBEqTUquhVz398htDFrtymD9xYYfG1m4wAcvPhXNfE3EfH1r1ADqtfSdVCToUG868RvUUkgDKf31mGDtKsAYz2oz2AGutZYs";

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
    let call = 0;
    const fetchJson = vi.fn(async (url: string) => {
      if (url.endsWith("/utxo")) return throwUtxoNotImplemented();
      call += 1;
      if (call === 1) throw new TypeError("network");
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
