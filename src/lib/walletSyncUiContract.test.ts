import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const walletSyncUiSources = [
  new URL("../components/home/BalanceCard.tsx", import.meta.url),
  new URL("../components/home/HomePage.tsx", import.meta.url),
  new URL("../components/settings/WalletSyncSettings.tsx", import.meta.url),
];

describe("wallet sync UI copy contract", () => {
  it("does not render the removed per-wallet delay wording", () => {
    const source = walletSyncUiSources.map((file) => readFileSync(file, "utf8")).join("\n");
    expect(source).not.toContain("동기화 지연");
    expect(source).not.toContain("SyncDelayBadge");
  });
});
