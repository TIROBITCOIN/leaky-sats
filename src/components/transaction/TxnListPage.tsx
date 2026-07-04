import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import "../../styles/ledger.css";
import "../../styles/forms.css";
import { useLedger } from "../../state/LedgerContext";
import { fmtKRW } from "../../lib/format";
import { useSelectedMonth } from "../../lib/useSelectedMonth";
import {
  getSettlementMonthKeyForDate,
  getSettlementPeriod,
  isIsoWithinPeriod,
  loadSettlementDay,
} from "../../lib/settlement";
import MonthSelector from "../common/MonthSelector";
import SwipeableRow from "./SwipeableRow";
import TxnRow from "../home/TxnRow";

type Segment = "all" | "income" | "expense";
const SEGMENTS: { key: Segment; label: string }[] = [
  { key: "all", label: "전체" },
  { key: "income", label: "수입" },
  { key: "expense", label: "지출" },
];

const EMPTY_MESSAGES: Record<Segment, string> = {
  all: "이번 정산기간 거래 내역이 없어요.",
  income: "수입 내역이 없어요.",
  expense: "지출 내역이 없어요.",
};

export default function TxnListPage() {
  const { data, currency, deleteTxn } = useLedger();
  const navigate = useNavigate();
  const [segment, setSegment] = useState<Segment>("all");
  const [settlementDay, setSettlementDay] = useState(loadSettlementDay);
  const defaultSettlementMonthKey = getSettlementMonthKeyForDate(new Date().toISOString(), settlementDay);
  const [selectedMonth, setSelectedMonth] = useSelectedMonth(defaultSettlementMonthKey);
  const period = useMemo(() => getSettlementPeriod(selectedMonth, settlementDay), [selectedMonth, settlementDay]);

  useEffect(() => {
    const onVisibility = () => {
      if (document.visibilityState === "visible") setSettlementDay(loadSettlementDay());
    };
    const refresh = () => setSettlementDay(loadSettlementDay());
    document.addEventListener("visibilitychange", onVisibility);
    window.addEventListener("focus", refresh);
    return () => {
      document.removeEventListener("visibilitychange", onVisibility);
      window.removeEventListener("focus", refresh);
    };
  }, []);

  const periodTxns = useMemo(
    () => data.txns.filter((t) => isIsoWithinPeriod(t.date, period)),
    [data.txns, period]
  );

  const filtered = useMemo(() => {
    if (segment === "all") return periodTxns;
    if (segment === "income") return periodTxns.filter((t) => t.amount > 0);
    return periodTxns.filter((t) => t.amount < 0);
  }, [periodTxns, segment]);

  const segmentTotal = useMemo(() => {
    if (segment === "all") return null;
    return filtered.reduce((sum, t) => sum + Math.abs(t.amount), 0);
  }, [filtered, segment]);

  return (
    <div className="ldg-screen">
      <div className="ldg-content">
        <div className="ldg-page-title">전체 거래</div>
        <div className="ldg-page-sub">왼쪽으로 밀면 삭제, 오른쪽으로 밀면 수정이에요.</div>

        <div className="ldg-stats-month-selector">
          <MonthSelector selectedMonth={selectedMonth} onChangeMonth={setSelectedMonth} label={period.label} />
          <div className="ldg-settlement-range-label">{period.rangeLabel}</div>
        </div>

        <div className="ldg-segment-control">
          {SEGMENTS.map((s) => (
            <button
              type="button"
              key={s.key}
              className={`ldg-segment-btn${segment === s.key ? " active" : ""}`}
              onClick={() => setSegment(s.key)}
            >
              {s.label}
            </button>
          ))}
        </div>

        {segmentTotal !== null && (
          <div className="ldg-segment-total">
            {segment === "income" ? "수입" : "지출"} 합계:{" "}
            <strong className={segment === "income" ? "pos" : "neg"}>
              {fmtKRW(segmentTotal)}
            </strong>
          </div>
        )}

        <div className="ldg-card ldg-txns">
          <div className="ldg-txn-list">
            {filtered.map((t) => (
              <SwipeableRow
                key={t.id}
                txn={t}
                onEdit={() => navigate(`/add?edit=${t.id}&month=${selectedMonth}`)}
                onDelete={() => deleteTxn(t.id)}
              >
                <TxnRow t={t} currency={currency} btcKRW={data.btcKRW} />
              </SwipeableRow>
            ))}
            {filtered.length === 0 && <div className="ldg-page-sub">{EMPTY_MESSAGES[segment]}</div>}
          </div>
        </div>
      </div>
    </div>
  );
}
