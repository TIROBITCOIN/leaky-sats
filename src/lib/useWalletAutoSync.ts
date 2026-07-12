import { useEffect } from "react";
import { loadWalletConfig } from "./walletConfig";
import { syncAllWallets } from "./walletSync";

/** Matches walletSync.ts's THROTTLE_MS so the interval and the in-flight dedupe stay in sync. */
export const WALLET_AUTO_SYNC_INTERVAL_MS = 30_000;

export function shouldAutoSyncWallets(): boolean {
  const config = loadWalletConfig();
  return config.enabled && config.wallets.length > 0;
}

function syncIfDueAndVisible(): void {
  if (document.visibilityState !== "visible") return;
  if (!shouldAutoSyncWallets()) return;
  void syncAllWallets();
}

/**
 * Keeps wallet balances fresh in the background regardless of which tab is active. Runs on a
 * fixed interval while the app is visible, plus once immediately whenever the app regains
 * visibility (e.g. switching back from another app). syncAllWallets() already dedupes
 * concurrent calls and throttles rapid repeats, so this can fire freely.
 */
export function useWalletAutoSync(): void {
  useEffect(() => {
    const interval = setInterval(syncIfDueAndVisible, WALLET_AUTO_SYNC_INTERVAL_MS);

    const onVisibilityChange = () => {
      if (document.visibilityState === "visible") syncIfDueAndVisible();
    };
    document.addEventListener("visibilitychange", onVisibilityChange);

    return () => {
      clearInterval(interval);
      document.removeEventListener("visibilitychange", onVisibilityChange);
    };
  }, []);
}
