import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  shouldAutoSyncWallets,
  syncIfDueAndVisible,
  WALLET_AUTO_SYNC_INTERVAL_MS,
} from "./useWalletAutoSync";

function mockLocalStorage() {
  const store = new Map<string, string>();
  return {
    getItem: (key: string) => (store.has(key) ? store.get(key)! : null),
    setItem: (key: string, value: string) => {
      store.set(key, value);
    },
    removeItem: (key: string) => {
      store.delete(key);
    },
    clear: () => store.clear(),
  };
}

describe("shouldAutoSyncWallets", () => {
  beforeEach(() => {
    vi.stubGlobal("localStorage", mockLocalStorage());
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("is false when wallet sync is disabled (default config)", () => {
    expect(shouldAutoSyncWallets()).toBe(false);
  });

  it("is true when enabled with at least one wallet registered", () => {
    localStorage.setItem(
      "myledger.wallet.config.v1",
      JSON.stringify({
        enabled: true,
        wallets: [
          {
            id: "w1",
            label: "지갑 1",
            descriptor: { kind: "addresses", addresses: ["bc1qcr8te4kr609gcawutmrza0j4xv80jy8z306fyu"] },
            includeInTotal: true,
            createdAt: "2026-07-12T00:00:00.000Z",
          },
        ],
        mempoolApiUrl: "",
        gapLimit: 200,
        includeUnconfirmed: true,
      })
    );
    expect(shouldAutoSyncWallets()).toBe(true);
  });

  it("is false when enabled but no wallets are registered", () => {
    localStorage.setItem(
      "myledger.wallet.config.v1",
      JSON.stringify({ enabled: true, wallets: [], mempoolApiUrl: "", gapLimit: 200, includeUnconfirmed: true })
    );
    expect(shouldAutoSyncWallets()).toBe(false);
  });

  it("uses a two-minute background interval", () => {
    expect(WALLET_AUTO_SYNC_INTERVAL_MS).toBe(2 * 60 * 1000);
  });

  it("passes force=true for an immediate foreground sync", () => {
    localStorage.setItem(
      "myledger.wallet.config.v1",
      JSON.stringify({
        enabled: true,
        wallets: [
          {
            id: "w1",
            label: "지갑 1",
            descriptor: { kind: "addresses", addresses: ["bc1qtest"] },
            includeInTotal: true,
            createdAt: "2026-07-12T00:00:00.000Z",
          },
        ],
        mempoolApiUrl: "",
        gapLimit: 200,
        includeUnconfirmed: true,
      })
    );
    vi.stubGlobal("document", { visibilityState: "visible" });
    const sync = vi.fn(async () => ({ ok: true, walletResults: [], aggregatedSats: 0 }));

    syncIfDueAndVisible(true, sync);

    expect(sync).toHaveBeenCalledWith({ force: true });
  });
});
