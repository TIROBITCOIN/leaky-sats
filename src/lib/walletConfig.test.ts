import { afterEach, describe, expect, it, vi } from "vitest";
import {
  loadWalletConfig,
  WALLET_CONFIG_KEY,
  WALLET_DEFAULT_GAP_LIMIT,
} from "./walletConfig";

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

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("wallet sync defaults", () => {
  it("uses the standard 20-address discovery gap", () => {
    vi.stubGlobal("localStorage", memoryStorage());

    expect(WALLET_DEFAULT_GAP_LIMIT).toBe(20);
    expect(loadWalletConfig().gapLimit).toBe(20);
  });

  it("migrates a stored 200-address gap to the fixed default", () => {
    vi.stubGlobal("localStorage", memoryStorage());
    localStorage.setItem(
      WALLET_CONFIG_KEY,
      JSON.stringify({
        enabled: true,
        wallets: [],
        mempoolApiUrl: "",
        gapLimit: 200,
        includeUnconfirmed: true,
      })
    );

    expect(loadWalletConfig().gapLimit).toBe(20);
  });
});
