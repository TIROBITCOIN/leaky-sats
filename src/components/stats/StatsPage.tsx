import { useMemo, useState } from "react";
import "../../styles/ledger.css";
import "../../styles/forms.css";
import { useLedger } from "../../state/LedgerContext";
import { fmtKRW, krwToSats } from "../../lib/format";
import { calculatePeriodStats, calculateSpendingBreakdown, getAnchorDate, type PeriodRange } from "../../lib/ledgerCalc.js";
import CategoryDonut from "./CategoryDonut";
import ChartCard from "../home/ChartCard";

const RANGES: { label: string; value: PeriodRange }[] = [
  { label: "일", value: "day" },
  { label: "월", value: "month" },
  { label: "년", value: "year" },
];

export default function StatsPage() {
  const { data } = useLedger();
  const [range, setRange] = useState<PeriodRange>("month");

  const periodStats = useMemo(() => calculatePeriodStats(data.txns, range, getAnchorDate(data.txns)), [data.txns, range]);
  const spending = useMemo(() => calculateSpendingBreakdown(periodStats.txns), [periodStats.txns]);
  const periodSats = krwToSats(periodStats.expense, data.btcKRW);

  return (
    <div className="ldg-screen">
      <div className="ldg-content">
        <div className="ldg-page-title">통계</div>
        <div className="ldg-page-sub">저장된 거래 기준으로 수입, 지출, 카테고리 분포를 계산합니다.</div>

        <div className="ldg-card">
          <div className="ldg-card-head">
            <div className="ldg-label">기간</div>
            <div className="ldg-range">
              {RANGES.map((r) => (
                <button key={r.value} className={range === r.value ? "on" : ""} onClick={() => setRange(r.value)}>
                  {r.label}
                </button>
              ))}
            </div>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
            <div>
              <div className="ldg-label">수입</div>
              <div className="ldg-inout-main pos">{fmtKRW(periodStats.income)}</div>
            </div>
            <div>
              <div className="ldg-label">지출</div>
              <div className="ldg-inout-main neg">{fmtKRW(periodStats.expense)}</div>
            </div>
          </div>
          <div className="ldg-preview" style={{ marginTop: 10 }}>
            순현금흐름 <b>{fmtKRW(periodStats.net)}</b> · 생활비 {fmtKRW(spending.livingExpense)} · BTC 투자{" "}
            {fmtKRW(spending.investmentExpense)}
          </div>
        </div>

        <div className="ldg-card">
          <div className="ldg-label" style={{ marginBottom: 10 }}>
            카테고리별 생활비 지출
          </div>
          <CategoryDonut txns={periodStats.txns} />
        </div>

        <ChartCard />

        <div className="ldg-preview">
          이번 기간 전체 지출을 사토시로 환산하면{" "}
          <b style={{ whiteSpace: "nowrap" }}>{periodSats.toLocaleString("en-US")} sats</b> 입니다.
        </div>
      </div>
    </div>
  );
}
