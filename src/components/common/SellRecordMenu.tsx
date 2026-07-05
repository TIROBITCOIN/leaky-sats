import { useEffect, useRef } from "react";

interface Props {
  open: boolean;
  onToggle: () => void;
  onEdit: () => void;
  onDelete: () => void;
}

export default function SellRecordMenu({ open, onToggle, onEdit, onDelete }: Props) {
  const menuRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!open) return;
    const onDocPointerDown = (event: PointerEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) onToggle();
    };
    document.addEventListener("pointerdown", onDocPointerDown);
    return () => document.removeEventListener("pointerdown", onDocPointerDown);
  }, [open, onToggle]);

  return (
    <div style={{ position: "relative" }}>
      <button type="button" className="ldg-txn-menu-btn" onClick={onToggle} aria-label="판매 기록 더보기">
        ⋯
      </button>
      {open && (
        <div className="ldg-txn-menu" ref={menuRef}>
          <button type="button" onClick={onEdit}>
            수정
          </button>
          <button type="button" onClick={onDelete}>
            삭제
          </button>
        </div>
      )}
    </div>
  );
}

