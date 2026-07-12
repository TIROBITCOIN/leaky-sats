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
  it("sums confirmed sats directly from per-address lookup fields", () => {
    const balance = buildWalletBalance(
      [
        { ok: true, address: "a1", confirmedSats: 10_000, unconfirmedSats: 0, utxos: null },
        { ok: true, address: "a2", confirmedSats: 20_000, unconfirmedSats: 0, utxos: null },
      ],
      { fetchedAt: "2026-01-01T00:00:00.000Z" }
    );
    expect(balance.confirmedSats).toBe(30_000);
    expect(balance.totalSats).toBe(30_000);
    expect(balance.status).toBe("online");
    expect(balance.failedAddresses).toBe(0);
  });

  it("splits confirmed vs unconfirmed", () => {
    const balance = buildWalletBalance([
      { ok: true, address: "a1", confirmedSats: 100, unconfirmedSats: 50, utxos: null },
    ]);
    expect(balance.confirmedSats).toBe(100);
    expect(balance.unconfirmedSats).toBe(50);
    expect(balance.totalSats).toBe(150);
  });

  it("excludes unconfirmed sats from total when includeUnconfirmed is false", () => {
    const balance = buildWalletBalance(
      [{ ok: true, address: "a1", confirmedSats: 100, unconfirmedSats: 50, utxos: null }],
      { includeUnconfirmed: false }
    );
    expect(balance.totalSats).toBe(100);
  });

  it("marks partial when some lookups fail", () => {
    const balance = buildWalletBalance([
      { ok: true, address: "a1", confirmedSats: 1, unconfirmedSats: 0, utxos: null },
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
    expect(balance.totalSats).toBe(0);
  });

  it("parseAddressUtxoArray rejects non-arrays", () => {
    expect(parseAddressUtxoArray({})).toBeNull();
  });

  it("leaves utxoCount undefined when any successful lookup has no utxo array (electrum backend)", () => {
    const balance = buildWalletBalance([
      {
        ok: true,
        address: "a1",
        confirmedSats: 1_000,
        unconfirmedSats: 0,
        utxos: [{ txid: "e".repeat(64), vout: 0, valueSats: 1_000, confirmed: true }],
      },
      { ok: true, address: "a2", confirmedSats: 0, unconfirmedSats: 0, utxos: null },
    ]);
    expect(balance.utxoCount).toBeUndefined();
  });

  it("dedupes outpoints across addresses when every lookup has a utxo array (esplora backend)", () => {
    const shared = {
      txid: "bb".repeat(32),
      vout: 0,
      valueSats: 10_000,
      confirmed: true,
    };
    const balance = buildWalletBalance([
      { ok: true, address: "a1", confirmedSats: 10_000, unconfirmedSats: 0, utxos: [shared] },
      {
        ok: true,
        address: "a2",
        confirmedSats: 30_000,
        unconfirmedSats: 0,
        utxos: [shared, { ...shared, vout: 1, valueSats: 20_000 }],
      },
    ]);
    expect(balance.utxoCount).toBe(2);
  });
});
