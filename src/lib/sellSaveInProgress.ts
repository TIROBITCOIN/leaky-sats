declare global {
  interface Window {
    __ldgSaveInProgress?: boolean;
    __ldgPendingReloadAfterSave?: boolean;
  }
}

export function setSellSaveInProgress(inProgress: boolean) {
  window.__ldgSaveInProgress = inProgress;

  if (!inProgress && window.__ldgPendingReloadAfterSave) {
    window.__ldgPendingReloadAfterSave = false;
    window.location.reload();
  }
}

export function requestReloadAfterSellSave() {
  if (window.__ldgSaveInProgress) {
    window.__ldgPendingReloadAfterSave = true;
    return;
  }

  window.location.reload();
}

