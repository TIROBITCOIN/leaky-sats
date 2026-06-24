import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import "../../styles/ledger.css";
import "../../styles/forms.css";
import { useLedger } from "../../state/LedgerContext";
import { fmtKRW } from "../../lib/format";
import SwipeableRow from "./SwipeableRow";
import TxnRow from "../home/TxnRow";

type Segment = "all" | "income" | "expense";
const SEGMENTS: { key: Segment; label: string }[] = [
  { key: "all", label: "전체" },
  { key: "income", label: "수입" },
  { key: "expense", label: "지출" },
];

const EMPTY_MESSAGES: Record<Segment, string> = {
  all: "아직 거래 내역이 없어요.",
  income: "수입 내역이 없어요.",
  expense: "지출 내역이 없어요.",
};

export default function TxnListPage() {
  const { data, currency, deleteTxn } = useLedger();
  const navigate = useNavigate();
  const [segment, setSegment] = useState<Segment>("all");

  const filtered = useMemo(() => {
    if (segment === "all") return data.txns;
    if (segment === "income") return data.txns.filter((t) => t.amount > 0);
    return data.txns.filter((t) => t.amount < 0);
  }, [data.txns, segment]);

  const segmentTotal = useMemo(() => {
    if (segment === "all") return null;
    return filtered.reduce((sum, t) => sum + Math.abs(t.amount), 0);
  }, [filtered, segment]);

  return (
    <div className="ldg-screen">
      <div className="ldg-content">
        <div className="ldg-page-title">전체 거래</div>
        <div className="ldg-page-sub">왼쪽으로 밀면 삭제, 오른쪽으로 밀면 수정이에요.</div>

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
              <SwipeableRow key={t.id} txn={t} onEdit={() => navigate(`/add?edit=${t.id}`)} onDelete={() => deleteTxn(t.id)}>
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
