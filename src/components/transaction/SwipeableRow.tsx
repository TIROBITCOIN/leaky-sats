import { useEffect, useRef, useState, type PointerEvent as ReactPointerEvent, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { fmtKRW } from "../../lib/format";
import type { Txn } from "../../types";

const ACTION_WIDTH = 76;
const REVEAL_THRESHOLD = 36;
const COMMIT_THRESHOLD = 120;
const MAX_DRAG = COMMIT_THRESHOLD;
const TAP_CLOSE_THRESHOLD = 6;

export default function SwipeableRow({
  children,
  txn,
  onEdit,
  onDelete,
}: {
  children: ReactNode;
  txn?: Txn;
  onEdit: () => void;
  onDelete: () => void;
}) {
  const [offset, setOffset] = useState(0);
  const [dragging, setDragging] = useState(false);
  const [sheetOpen, setSheetOpen] = useState(false);
  const offsetRef = useRef(0);
  const startXRef = useRef(0);
  const startOffsetRef = useRef(0);
  const triggeredRef = useRef(false);
  const draggingRef = useRef(false);

  useEffect(() => {
    if (!sheetOpen) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setSheetOpen(false);
    };
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [sheetOpen]);

  const setOffsetBoth = (value: number) => {
    offsetRef.current = value;
    setOffset(value);
  };

  const handlePointerDown = (event: ReactPointerEvent<HTMLDivElement>) => {
    if ((event.target as HTMLElement).closest("button, input, label")) return;
    startXRef.current = event.clientX;
    startOffsetRef.current = offsetRef.current;
    triggeredRef.current = false;
    draggingRef.current = true;
    setDragging(true);
    try {
      event.currentTarget.setPointerCapture(event.pointerId);
    } catch {
      // 합성 포인터 이벤트처럼 capture를 지원하지 않는 환경에서는 제스처만 계속 처리한다.
    }
  };

  const handlePointerMove = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (!draggingRef.current || triggeredRef.current) return;
    const delta = event.clientX - startXRef.current;
    const next = Math.max(-MAX_DRAG, Math.min(MAX_DRAG, startOffsetRef.current + delta));
    setOffsetBoth(next);
    if (next <= -COMMIT_THRESHOLD) {
      triggeredRef.current = true;
      draggingRef.current = false;
      setDragging(false);
      setOffsetBoth(0);
      onDelete();
    } else if (next >= COMMIT_THRESHOLD) {
      triggeredRef.current = true;
      draggingRef.current = false;
      setDragging(false);
      setOffsetBoth(0);
      onEdit();
    }
  };

  const settle = () => {
    if (triggeredRef.current) return;
    const dragDistance = Math.abs(offsetRef.current - startOffsetRef.current);
    if (startOffsetRef.current !== 0 && dragDistance < TAP_CLOSE_THRESHOLD) {
      setOffsetBoth(0);
      return;
    }
    const value = offsetRef.current;
    if (value <= -REVEAL_THRESHOLD) setOffsetBoth(-ACTION_WIDTH);
    else if (value >= REVEAL_THRESHOLD) setOffsetBoth(ACTION_WIDTH);
    else setOffsetBoth(0);
  };

  const handlePointerUp = () => {
    draggingRef.current = false;
    setDragging(false);
    settle();
  };

  return (
    <div className={`swipe-row ${offset !== 0 || dragging ? "swiping" : ""}`}>
      <button type="button" className="swipe-row-action swipe-row-action-edit" onClick={onEdit}>
        <span>수정</span>
      </button>
      <button type="button" className="swipe-row-action swipe-row-action-delete" onClick={onDelete}>
        <span>삭제</span>
      </button>
      <div
        className={`ldg-txn swipe-row-content ${dragging ? "dragging" : ""}`}
        style={{ transform: `translateX(${offset}px)` }}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerCancel={handlePointerUp}
      >
        {children}
        <button
          type="button"
          className="ldg-txn-menu-btn"
          onClick={() => setSheetOpen(true)}
          aria-label="거래 더보기"
        >
          ⋯
        </button>
      </div>
      {sheetOpen &&
        createPortal(
          <div className="ldg-action-sheet-layer" role="presentation">
            <button
              type="button"
              className="ldg-action-sheet-backdrop"
              aria-label="거래 메뉴 닫기"
              onClick={() => setSheetOpen(false)}
            />
            <section className="ldg-action-sheet" role="dialog" aria-modal="true" aria-label="거래 작업">
              {txn && (
                <div className="ldg-action-sheet-summary">
                  <div>
                    <div className="ldg-action-sheet-title">{txn.title}</div>
                    <div className="ldg-action-sheet-meta">{txn.catLabel}</div>
                  </div>
                  <div className={`ldg-action-sheet-amount ${txn.amount >= 0 ? "pos" : "neg"}`}>
                    {txn.amount >= 0 ? "+" : ""}
                    {fmtKRW(txn.amount)}
                  </div>
                </div>
              )}
              {txn?.memo?.trim() && (
                <div className="ldg-action-sheet-memo">
                  <div className="ldg-action-sheet-label">메모</div>
                  <div>{txn.memo}</div>
                </div>
              )}
              <div className="ldg-action-sheet-actions">
                <button
                  type="button"
                  onClick={() => {
                    setSheetOpen(false);
                    onEdit();
                  }}
                >
                  수정
                </button>
                <button
                  type="button"
                  className="danger"
                  onClick={() => {
                    setSheetOpen(false);
                    onDelete();
                  }}
                >
                  삭제
                </button>
                <button type="button" onClick={() => setSheetOpen(false)}>
                  닫기
                </button>
              </div>
            </section>
          </div>,
          document.body
        )}
    </div>
  );
}
