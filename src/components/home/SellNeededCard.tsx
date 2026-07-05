import { useEffect, useRef, useState } from "react";
import type { BtcSellRecord, MonthSellSummary } from "../../lib/btcSellRecords";
import type { SellResult } from "../../lib/sellCalculator";
import { fmtKRW, fmtSats } from "../../lib/format";

interface Props {
  result: SellResult;
  monthlySellSummary: MonthSellSummary;
  records: BtcSellRecord[];
  onConfirmSell?: () => void;
  onEditRecord: (record: BtcSellRecord) => void;
  onDeleteRecord: (record: BtcSellRecord) => void;
}

function SellRecordMenu({
  open,
  onToggle,
  onEdit,
  onDelete,
}: {
  open: boolean;
  onToggle: () => void;
  onEdit: () => void;
  onDelete: () => void;
}) {
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

export default function SellNeededCard({
  result,
  monthlySellSummary,
  records,
  onConfirmSell,
  onEditRecord,
  onDeleteRecord,
}: Props) {
  const [openMenuId, setOpenMenuId] = useState<string | null>(null);
  const { deficitKrw, sellSats, totalDeficitKrw } = result;
  const everHadDeficit = totalDeficitKrw > 0;
  const sellRecorded = everHadDeficit && monthlySellSummary.totalKrwCovered >= totalDeficitKrw;
  const needSell = deficitKrw > 0 && !sellRecorded;
  const recentRecords = records.slice(0, 3);

  if (!everHadDeficit) return null;

  return (
    <div className="ldg-card">
      {sellRecorded ? (
        <>
          <div className="ldg-settlement-done">판매 완료</div>
          <div className="ldg-done-list">
            <div className="ldg-done-row">
              <span className="ldg-done-label">실제 판매량</span>
              <span className="ldg-done-val ldg-btc-val">
                <strong>{fmtSats(monthlySellSummary.totalSatsSold)}</strong>
              </span>
            </div>
          </div>
          {recentRecords.length > 0 && (
            <div style={{ marginTop: 10, borderTop: "0.5px solid var(--ldg-border)", paddingTop: 8 }}>
              {recentRecords.map((record) => (
                <div key={record.id} className="ldg-sell-record-row">
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                    <div className="ldg-sell-record-date">{record.date}</div>
                    <SellRecordMenu
                      open={openMenuId === record.id}
                      onToggle={() => setOpenMenuId((id) => (id === record.id ? null : record.id))}
                      onEdit={() => {
                        setOpenMenuId(null);
                        onEditRecord(record);
                      }}
                      onDelete={() => {
                        setOpenMenuId(null);
                        onDeleteRecord(record);
                      }}
                    />
                  </div>
                  <div className="ldg-sell-record-detail">
                    <span>{fmtSats(record.satsSold)}</span>
                    <span className="ldg-sell-record-krw">{fmtKRW(record.krwCovered)}</span>
                  </div>
                  <div className="ldg-sell-record-rate">BTC/KRW {fmtKRW(record.btcKrwAtSell)}</div>
                </div>
              ))}
            </div>
          )}
        </>
      ) : needSell ? (
        <>
          <div className="ldg-label">판매해야 하는 비트코인</div>
          <div className="ldg-sell-sats-primary">{fmtSats(sellSats)}</div>
          <div className="ldg-sell-krw-secondary">{fmtKRW(deficitKrw)}</div>
          {onConfirmSell && (
            <button type="button" className="ldg-submit-btn" style={{ marginTop: 12 }} onClick={onConfirmSell}>
              판매
            </button>
          )}
        </>
      ) : null}
    </div>
  );
}
