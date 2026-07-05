import { useState } from "react";
import { deleteBtcSellRecord, type BtcSellRecord, type MonthSellSummary } from "../../lib/btcSellRecords";
import type { SellResult } from "../../lib/sellCalculator";
import { fmtKRW, fmtSats } from "../../lib/format";
import { getHeldBtc, setHeldBtc } from "../../lib/heldBtc";
import SellRecordMenu from "../common/SellRecordMenu";

interface Props {
  result: SellResult;
  monthlySellSummary: MonthSellSummary;
  records: BtcSellRecord[];
  onConfirmSell?: () => void;
  onEditRecord: (record: BtcSellRecord) => void;
  onRecordsChanged: () => void;
}

export default function SellNeededCard({
  result,
  monthlySellSummary,
  records,
  onConfirmSell,
  onEditRecord,
  onRecordsChanged,
}: Props) {
  const [recordsOpen, setRecordsOpen] = useState(false);
  const [openMenuId, setOpenMenuId] = useState<string | null>(null);
  const { deficitKrw, sellSats, totalDeficitKrw } = result;
  const everHadDeficit = totalDeficitKrw > 0;
  const sellRecorded = everHadDeficit && monthlySellSummary.totalKrwCovered >= totalDeficitKrw;
  const needSell = deficitKrw > 0 && !sellRecorded;
  const recentRecords = records.slice(0, 3);

  if (!everHadDeficit) return null;

  const handleDelete = (record: BtcSellRecord) => {
    setOpenMenuId(null);
    if (!window.confirm("이 BTC 판매 기록을 삭제할까요?")) return;

    let restore = false;
    if (record.deductedFromHeldBtc) {
      restore = window.confirm("보유 BTC에 되돌릴까요?\n확인: 보유 BTC에 복원 / 취소: 기록만 삭제");
    }

    deleteBtcSellRecord(record.id);
    if (restore) {
      const amount = record.deductedBtcAmount ?? record.btcSold;
      setHeldBtc(getHeldBtc() + amount);
    }
    onRecordsChanged();
  };

  return (
    <div className="ldg-card">
      {sellRecorded ? (
        <>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10 }}>
            <div className="ldg-settlement-done">판매 완료</div>
            {recentRecords.length > 0 && (
              <button
                type="button"
                className="ldg-txn-menu-btn"
                onClick={() => setRecordsOpen((open) => !open)}
                aria-label="판매 기록 펼치기"
                aria-expanded={recordsOpen}
              >
                ⋯
              </button>
            )}
          </div>
          <div className="ldg-done-list">
            <div className="ldg-done-row">
              <span className="ldg-done-label">실제 판매량</span>
              <span className="ldg-done-val ldg-btc-val">
                <strong>{fmtSats(monthlySellSummary.totalSatsSold)}</strong>
              </span>
            </div>
          </div>
          {recordsOpen && recentRecords.length > 0 && (
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
                        handleDelete(record);
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
