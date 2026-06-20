import { fmtKRW, fmtBtcValue, type BtcUnit } from "../../lib/format";
import type { MonthSellSummary } from "../../lib/btcSellRecords";
import type { BtcSellRecord } from "../../lib/btcSellRecords";

interface Props {
  summary: MonthSellSummary;
  records: BtcSellRecord[];
  unit: BtcUnit;
}

export default function MonthlySellSummaryCard({ summary, records, unit }: Props) {
  if (summary.count === 0) return null;

  const recentRecords = records.slice(0, 3);

  return (
    <div className="ldg-card">
      <div className="ldg-label">이번 달 BTC 매도 반영</div>
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
              <div className="ldg-sell-record-date">{r.date}</div>
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
