import { useEffect, useRef, useState } from "react";
import { fmtKRW, fmtBtcValue, type BtcUnit } from "../../lib/format";
import { getMonthLabel } from "../../lib/month";
import { deleteBtcSellRecord, type MonthSellSummary, type BtcSellRecord } from "../../lib/btcSellRecords";
import { getHeldBtc, setHeldBtc } from "../../lib/heldBtc";

interface Props {
  summary: MonthSellSummary;
  records: BtcSellRecord[];
  unit: BtcUnit;
  selectedMonth: string;
  onEditRecord: (record: BtcSellRecord) => void;
  onRecordsChanged: () => void;
}

function SellRecordMenu({ open, onToggle, onEdit, onDelete }: { open: boolean; onToggle: () => void; onEdit: () => void; onDelete: () => void }) {
  const menuRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!open) return;
    const onDocPointerDown = (e: PointerEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) onToggle();
    };
    document.addEventListener("pointerdown", onDocPointerDown);
    return () => document.removeEventListener("pointerdown", onDocPointerDown);
  }, [open, onToggle]);

  return (
    <div style={{ position: "relative" }}>
      <button type="button" className="ldg-txn-menu-btn" onClick={onToggle} aria-label="더보기">
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

export default function MonthlySellSummaryCard({ summary, records, unit, selectedMonth, onEditRecord, onRecordsChanged }: Props) {
  const [openMenuId, setOpenMenuId] = useState<string | null>(null);
  if (summary.count === 0) return null;

  const monthLabel = getMonthLabel(selectedMonth);
  const recentRecords = records.slice(0, 3);

  const handleDelete = (r: BtcSellRecord) => {
    setOpenMenuId(null);
    if (!window.confirm("이 BTC 판매 기록을 삭제할까요?")) return;

    let restore = false;
    if (r.deductedFromHeldBtc) {
      restore = window.confirm("보유 BTC에 되돌릴까요?\n확인: 보유 BTC에 복원 / 취소: 기록만 삭제");
    }
    deleteBtcSellRecord(r.id);
    if (restore) {
      const amount = r.deductedBtcAmount ?? r.btcSold;
      setHeldBtc(getHeldBtc() + amount);
    }
    onRecordsChanged();
  };

  return (
    <div className="ldg-card">
      <div className="ldg-label">{monthLabel} 판매한 비트코인</div>
      <div className="ldg-inout-main neg" style={{ marginTop: 6 }}>
        {fmtBtcValue(summary.totalBtcSold, unit)}
      </div>
      <div className="ldg-balance-sub">
        {fmtKRW(summary.totalKrwCovered)} 충당 · {summary.count}건
      </div>

      {recentRecords.length > 0 && (
        <div style={{ marginTop: 10, borderTop: "0.5px solid var(--ldg-border)", paddingTop: 8 }}>
          {recentRecords.map((r) => (
            <div key={r.id} className="ldg-sell-record-row">
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <div className="ldg-sell-record-date">{r.date}</div>
                <SellRecordMenu
                  open={openMenuId === r.id}
                  onToggle={() => setOpenMenuId((id) => (id === r.id ? null : r.id))}
                  onEdit={() => {
                    setOpenMenuId(null);
                    onEditRecord(r);
                  }}
                  onDelete={() => handleDelete(r)}
                />
              </div>
              <div className="ldg-sell-record-detail">
                <span>{fmtBtcValue(r.btcSold, unit)}</span>
                <span className="ldg-sell-record-krw">{fmtKRW(r.krwCovered)}</span>
              </div>
              <div className="ldg-sell-record-rate">
                BTC/KRW {fmtKRW(r.btcKrwAtSell)}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
