import type { ReactNode } from "react";
import { createPortal } from "react-dom";
import { useBodyScrollLock } from "../../lib/bodyScrollLock";

type Props = {
  title: string;
  onClose: () => void;
  children: ReactNode;
  /** Optional header-right slot, e.g. CategoryManager's "+ 새 카테고리" button. */
  headerAction?: ReactNode;
  ariaLabel?: string;
};

/**
 * Shared full-screen sub-modal for settings pages (recurring rules, category manager, ...).
 * Portals into .app-frame (same convention as the amount keypad) so it sits in the app shell's
 * own stacking context — unambiguously above the tab bar — and stays contained within the
 * phone-frame box on wide viewports. Locks background scroll for its lifetime and gives its
 * body the only scrollable region, with overscroll containment so reaching the top/bottom
 * never chains into the page behind it.
 */
export default function FullScreenModal({ title, onClose, children, headerAction, ariaLabel }: Props) {
  useBodyScrollLock();

  const portalTarget =
    (typeof document !== "undefined" && document.querySelector(".app-frame")) ||
    (typeof document !== "undefined" ? document.body : null);
  if (!portalTarget) return null;

  return createPortal(
    <div
      className="ldg-fs-modal-backdrop"
      role="dialog"
      aria-modal="true"
      aria-label={ariaLabel ?? title}
      onClick={onClose}
      onTouchMove={(event) => {
        if (event.target === event.currentTarget) event.preventDefault();
      }}
    >
      <div className="ldg-fs-modal-panel" onClick={(event) => event.stopPropagation()}>
        <div className="ldg-fs-modal-header">
          <div className="ldg-modal-title">{title}</div>
          {headerAction}
        </div>
        <div className="ldg-fs-modal-body">{children}</div>
        <div className="ldg-fs-modal-footer">
          <button type="button" className="ldg-submit-btn secondary" onClick={onClose}>
            닫기
          </button>
        </div>
      </div>
    </div>,
    portalTarget
  );
}
