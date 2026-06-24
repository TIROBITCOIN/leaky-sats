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
    <div className="ldg-card ldg-settlement-card">
      <div className="ldg-card-context">
        <div className="ldg-label">{year}년 판매한 비트코인</div>
        <span className="ldg-card-badge confirmed">확정</span>
      </div>
      <div className="ldg-card-helper">판매 확정한 기록 기준입니다.</div>
      <div className="ldg-inout-main neg ldg-settlement-value">
        {fmtBtcValue(summary.totalBtcSold, unit)}
      </div>
      <div className="ldg-balance-sub">
        {fmtKRW(summary.totalKrwCovered)} 충당 · {summary.count}건
      </div>
    </div>
  );
}
