import { useState } from "react";
import { fmtKRW, fmtBtcValue, type BtcUnit } from "../../lib/format";
import { deleteBtcSellRecord, type MonthSellSummary, type BtcSellRecord } from "../../lib/btcSellRecords";
import { getHeldBtc, setHeldBtc } from "../../lib/heldBtc";
import type { SettlementPeriod } from "../../lib/settlement";
import SellRecordMenu from "../common/SellRecordMenu";

interface Props {
  summary: MonthSellSummary;
  records: BtcSellRecord[];
  unit: BtcUnit;
  selectedMonth: string;
  period: SettlementPeriod;
  onEditRecord: (record: BtcSellRecord) => void;
  onRecordsChanged: () => void;
}

/** 정산기간을 "M/D - M/D" 형식으로 — 정산일이 1일이면 "7/1 - 7/31"처럼 그 달 전체가 된다. */
function formatPeriodRange(period: SettlementPeriod): string {
  const [, sm, sd] = period.startDate.split("-").map(Number);
  const [, em, ed] = period.endDate.split("-").map(Number);
  return `${sm}/${sd} - ${em}/${ed}`;
}

export default function MonthlySellSummaryCard({ summary, records, unit, period, onEditRecord, onRecordsChanged }: Props) {
  const [openMenuId, setOpenMenuId] = useState<string | null>(null);
  if (summary.count === 0) return null;

  const rangeTitle = formatPeriodRange(period);
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
      <div className="ldg-label">{rangeTitle} 판매한 비트코인</div>
      <div className="ldg-inout-main neg" style={{ marginTop: 6 }}>
        {fmtBtcValue(summary.totalBtcSold, unit)}
      </div>
      <div className="ldg-balance-sub">
        {fmtKRW(summary.totalKrwCovered)} 충당 · {summary.count}건
      </div>
      {(summary.avgEffectivePriceKrw != null || summary.avgPremiumPct != null) && (
        <div className="ldg-balance-sub" style={{ marginTop: 4 }}>
          {summary.avgEffectivePriceKrw != null && (
            <span>실효 평균 {fmtKRW(Math.round(summary.avgEffectivePriceKrw))}</span>
          )}
          {summary.avgEffectivePriceKrw != null && summary.avgPremiumPct != null && " · "}
          {summary.avgPremiumPct != null && (
            <span>
              시세 대비 {summary.avgPremiumPct >= 0 ? "+" : ""}
              {summary.avgPremiumPct.toFixed(2)}%
            </span>
          )}
        </div>
      )}

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
                실효 {fmtKRW(r.btcKrwAtSell)}
                {typeof r.marketBtcKrwAtSell === "number" &&
                  r.marketBtcKrwAtSell > 0 &&
                  Number.isFinite(r.btcKrwAtSell) && (
                    <>
                      {" · "}
                      시세 대비{" "}
                      {(((r.btcKrwAtSell - r.marketBtcKrwAtSell) / r.marketBtcKrwAtSell) * 100 >= 0
                        ? "+"
                        : "") +
                        (
                          ((r.btcKrwAtSell - r.marketBtcKrwAtSell) / r.marketBtcKrwAtSell) *
                          100
                        ).toFixed(2)}
                      %
                    </>
                  )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
