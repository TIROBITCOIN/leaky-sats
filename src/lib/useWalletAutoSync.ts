import { useEffect } from "react";
import { loadWalletConfig } from "./walletConfig";
import { syncAllWallets } from "./walletSync";

/** Public APIs are polled conservatively; force-triggered user/visibility syncs stay immediate. */
export const WALLET_AUTO_SYNC_INTERVAL_MS = 2 * 60 * 1000;

export function shouldAutoSyncWallets(): boolean {
  const config = loadWalletConfig();
  return config.enabled && config.wallets.length > 0;
}

export function syncIfDueAndVisible(
  force = false,
  sync: typeof syncAllWallets = syncAllWallets
): void {
  if (document.visibilityState !== "visible") return;
  if (!shouldAutoSyncWallets()) return;
  void sync({ force });
}

/**
 * Keeps wallet balances fresh in the background regardless of which tab is active. Runs on a
 * fixed interval while the app is visible, plus once immediately whenever the app regains
 * visibility (e.g. switching back from another app). syncAllWallets() already dedupes
 * concurrent calls and throttles rapid repeats, so this can fire freely.
 */
export function useWalletAutoSync(): void {
  useEffect(() => {
    const interval = setInterval(() => syncIfDueAndVisible(), WALLET_AUTO_SYNC_INTERVAL_MS);

    const onVisibilityChange = () => {
      if (document.visibilityState === "visible") syncIfDueAndVisible(true);
    };
    document.addEventListener("visibilitychange", onVisibilityChange);

    return () => {
      clearInterval(interval);
      document.removeEventListener("visibilitychange", onVisibilityChange);
    };
  }, []);
}
