import { describe, expect, it } from "vitest";
import { buildWalletBalance, parseAddressUtxo, parseAddressUtxoArray } from "./balance";

describe("parseAddressUtxo", () => {
  it("parses esplora utxo objects", () => {
    const parsed = parseAddressUtxo({
      txid: "aa".repeat(32),
      vout: 1,
      value: 50_000,
      status: { confirmed: true, block_height: 800_000, block_time: 1_700_000_000 },
    });
    expect(parsed).toEqual({
      txid: "aa".repeat(32),
      vout: 1,
      valueSats: 50_000,
      confirmed: true,
    });
  });

  it("returns null for invalid payloads", () => {
    expect(parseAddressUtxo(null)).toBeNull();
    expect(parseAddressUtxo({ txid: "x" })).toBeNull();
  });
});

describe("buildWalletBalance", () => {
  it("dedupes outpoints across addresses", () => {
    const shared = {
      txid: "bb".repeat(32),
      vout: 0,
      valueSats: 10_000,
      confirmed: true,
    };
    const balance = buildWalletBalance(
      [
        { ok: true, address: "a1", utxos: [shared] },
        { ok: true, address: "a2", utxos: [shared, { ...shared, vout: 1, valueSats: 20_000 }] },
      ],
      { fetchedAt: "2026-01-01T00:00:00.000Z" }
    );
    expect(balance.utxoCount).toBe(2);
    expect(balance.confirmedSats).toBe(30_000);
    expect(balance.totalSats).toBe(30_000);
    expect(balance.status).toBe("online");
    expect(balance.failedAddresses).toBe(0);
  });

  it("splits confirmed vs unconfirmed", () => {
    const balance = buildWalletBalance([
      {
        ok: true,
        address: "a1",
        utxos: [
          { txid: "c".repeat(64), vout: 0, valueSats: 100, confirmed: true },
          { txid: "d".repeat(64), vout: 0, valueSats: 50, confirmed: false },
        ],
      },
    ]);
    expect(balance.confirmedSats).toBe(100);
    expect(balance.unconfirmedSats).toBe(50);
    expect(balance.totalSats).toBe(150);
  });

  it("marks partial when some lookups fail", () => {
    const balance = buildWalletBalance([
      { ok: true, address: "a1", utxos: [{ txid: "e".repeat(64), vout: 0, valueSats: 1, confirmed: true }] },
      { ok: false, address: "a2", error: "timeout" },
    ]);
    expect(balance.status).toBe("partial");
    expect(balance.failedAddresses).toBe(1);
  });

  it("marks offline when every lookup fails", () => {
    const balance = buildWalletBalance([
      { ok: false, address: "a1", error: "fail" },
      { ok: false, address: "a2", error: "fail" },
    ]);
    expect(balance.status).toBe("offline");
    expect(balance.utxoCount).toBe(0);
    expect(balance.totalSats).toBe(0);
  });

  it("parseAddressUtxoArray rejects non-arrays", () => {
    expect(parseAddressUtxoArray({})).toBeNull();
  });
});
