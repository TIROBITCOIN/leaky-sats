import { describe, expect, it } from "vitest";
import { calculateWalletScanHardCap } from "./walletSync";

describe("calculateWalletScanHardCap", () => {
  it("scans past the default gap so a used first xpub address can settle online", () => {
    expect(calculateWalletScanHardCap(undefined, 200)).toBe(400);
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
