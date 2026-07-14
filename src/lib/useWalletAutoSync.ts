import { useEffect } from "react";
import { loadWalletConfig } from "./walletConfig";
import { syncAllWallets } from "./walletSync";

/** Public APIs are polled conservatively; force-triggered user/visibility syncs stay immediate. */
export const WALLET_AUTO_SYNC_INTERVAL_MS = 2 * 60 * 1000;

type VisibilitySource = {
  readonly visibilityState: DocumentVisibilityState;
  addEventListener(type: "visibilitychange", listener: EventListener): void;
  removeEventListener(type: "visibilitychange", listener: EventListener): void;
};

type OnlineSource = {
  addEventListener(type: "online", listener: EventListener): void;
  removeEventListener(type: "online", listener: EventListener): void;
};

export function shouldAutoSyncWallets(): boolean {
  const config = loadWalletConfig();
  return config.enabled && config.wallets.length > 0;
}

export function syncIfDueAndVisible(
  force = false,
  sync: typeof syncAllWallets = syncAllWallets,
  visibilityState: DocumentVisibilityState = document.visibilityState,
  retryAfterRunning = false
): void {
  if (visibilityState !== "visible") return;
  if (!shouldAutoSyncWallets()) return;
  void sync({ force, ...(retryAfterRunning ? { retryAfterRunning: true } : {}) }).catch(() => undefined);
}

/** Starts immediate and recurring wallet sync triggers and returns their complete cleanup. */
export function startWalletAutoSync(
  sync: typeof syncAllWallets = syncAllWallets,
  visibilitySource: VisibilitySource = document,
  onlineSource: OnlineSource = window
): () => void {
  syncIfDueAndVisible(true, sync, visibilitySource.visibilityState);

  const interval = setInterval(
    () => syncIfDueAndVisible(false, sync, visibilitySource.visibilityState),
    WALLET_AUTO_SYNC_INTERVAL_MS
  );
  const onVisibilityChange: EventListener = () => {
    if (visibilitySource.visibilityState === "visible") {
      syncIfDueAndVisible(true, sync, visibilitySource.visibilityState, true);
    }
  };
  const onOnline: EventListener = () => {
    syncIfDueAndVisible(true, sync, visibilitySource.visibilityState, true);
  };
  visibilitySource.addEventListener("visibilitychange", onVisibilityChange);
  onlineSource.addEventListener("online", onOnline);

  return () => {
    clearInterval(interval);
    visibilitySource.removeEventListener("visibilitychange", onVisibilityChange);
    onlineSource.removeEventListener("online", onOnline);
  };
}

/**
 * Keeps wallet balances fresh in the background regardless of which tab is active. Runs on a
 * fixed interval while the app is visible, immediately on app start, and whenever the app
 * regains visibility or network connectivity. syncAllWallets() bounds and dedupes runs.
 */
export function useWalletAutoSync(): void {
  useEffect(() => startWalletAutoSync(), []);
}
