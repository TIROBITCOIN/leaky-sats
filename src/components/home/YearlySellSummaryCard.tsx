import { fmtKRW, fmtBtcValue, type BtcUnit } from "../../lib/format";
import type { YearSellSummary } from "../../lib/btcSellRecords";

interface Props {
  summary: YearSellSummary;
  unit: BtcUnit;
  year: string;
}

export default function YearlySellSummaryCard({ summary, unit, year }: Props) {
  if (summary.count === 0) return null;

  return (
    <div className="ldg-card">
      <div className="ldg-label">{year}년 판매한 비트코인</div>
      <div className="ldg-inout-main neg" style={{ marginTop: 6 }}>
        {fmtBtcValue(summary.totalBtcSold, unit)}
      </div>
      <div className="ldg-balance-sub">
        {fmtKRW(summary.totalKrwCovered)} 충당 · {summary.count}건
      </div>
    </div>
  );
}
