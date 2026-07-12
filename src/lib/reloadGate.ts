declare global {
  interface Window {
    __ldgReloadBlockers?: Set<string>;
    __ldgPendingReload?: boolean;
  }
}

function blockerSet(): Set<string> {
  if (!window.__ldgReloadBlockers) window.__ldgReloadBlockers = new Set();
  return window.__ldgReloadBlockers;
}

/**
 * Registers or clears a named reason to defer the next auto-reload (e.g. a new
 * service worker taking over). Used so a new deploy never yanks the page out from
 * under an in-flight save or the PIN lock screen mid-interaction.
 */
export function setReloadBlocked(key: string, blocked: boolean) {
  const blockers = blockerSet();
  if (blocked) {
    blockers.add(key);
    return;
  }
  blockers.delete(key);
  if (blockers.size === 0 && window.__ldgPendingReload) {
    window.__ldgPendingReload = false;
    window.location.reload();
  }
}

export function requestReload() {
  if (blockerSet().size > 0) {
    window.__ldgPendingReload = true;
    return;
  }
  window.location.reload();
}
