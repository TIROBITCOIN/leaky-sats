import { describe, expect, it, vi } from "vitest";
import { scanWallet } from "./scan";

const ZPUB =
  "zpub6rFR7y4Q2AijBEqTUquhVz398htDFrtymD9xYYfG1m4wAcvPhXNfE3EfH1r1ADqtfSdVCToUG868RvUUkgDKf31mGDtKsAYz2oz2AGutZYs";

function emptyUtxo() {
  return [];
}

function utxo(value = 1000, confirmed = true) {
  return [{ txid: "ab".repeat(32), vout: 0, value, status: { confirmed } }];
}

function stats(txCount: number) {
  return {
    chain_stats: { tx_count: txCount },
    mempool_stats: { tx_count: 0 },
  };
}

describe("scanWallet", () => {
  it("resets gap after a used address with empty UTXOs but history", async () => {
    const { deriveAddresses } = await import("./xpub");
    const receive = deriveAddresses({ xpub: ZPUB, chain: "receive", startIndex: 0, limit: 5 });
    const usedAddress = receive[1].address;

    const fetchJson = vi.fn(async (url: string) => {
      if (url.endsWith("/utxo")) {
        return emptyUtxo();
      }
      const addr = decodeURIComponent(url.split("/address/")[1] ?? "");
      if (addr === usedAddress) return stats(2);
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
      if (url.endsWith("/utxo")) return utxo(1);
      return stats(1);
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
      if (url.endsWith("/utxo")) {
        call += 1;
        if (call === 1) throw new TypeError("network");
        return emptyUtxo();
      }
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
      if (url.endsWith("/utxo")) return utxo(25_000, true);
      return stats(1);
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
});
