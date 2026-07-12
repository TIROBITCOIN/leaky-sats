import { useEffect } from "react";

/**
 * This app never scrolls document.body/window — each routed page owns its own scrollable
 * .ldg-content div (see ledger.css). A full-screen modal must therefore freeze that div, not
 * the (already static) body, or background scroll chaining leaks through once the modal's own
 * scroll region hits a boundary. Toggling a body class lets CSS target ".ldg-content" globally
 * without needing a ref to whichever page happens to be mounted.
 */
export const BODY_SCROLL_LOCK_CLASS = "ldg-modal-open";

let lockCount = 0;

export function acquireBodyScrollLock(): void {
  lockCount += 1;
  if (lockCount === 1) {
    document.body.classList.add(BODY_SCROLL_LOCK_CLASS);
  }
}

export function releaseBodyScrollLock(): void {
  lockCount = Math.max(0, lockCount - 1);
  if (lockCount === 0) {
    document.body.classList.remove(BODY_SCROLL_LOCK_CLASS);
  }
}

/** Ref-counted so nested/overlapping full-screen modals don't unlock each other early. */
export function useBodyScrollLock(): void {
  useEffect(() => {
    acquireBodyScrollLock();
    return () => releaseBodyScrollLock();
  }, []);
}
