import { Link, useNavigate } from "react-router-dom";
import type { Currency, LedgerData } from "../../types";
import { isIsoWithinPeriod, type SettlementPeriod } from "../../lib/settlement";
import { useLedger } from "../../state/LedgerContext";
import SwipeableRow from "../transaction/SwipeableRow";
import TxnRow from "./TxnRow";

const HOME_TXN_LIMIT = 5;

export default function TxnsCard({
  d,
  currency,
  selectedMonth,
  period,
}: {
  d: LedgerData;
  currency: Currency;
  selectedMonth: string;
  period: SettlementPeriod;
}) {
  const { deleteTxn, setTxnSettled } = useLedger();
  const navigate = useNavigate();
  const visible = d.txns.filter((t) => isIsoWithinPeriod(t.date, period)).slice(0, HOME_TXN_LIMIT);

  return (
    <div className="ldg-card ldg-txns">
      <div className="ldg-card-head">
        <div className="ldg-label">이번 정산기간 최근 거래</div>
        <Link to={`/transactions?month=${selectedMonth}`} className="ldg-link">
          전체 보기 →
        </Link>
      </div>
      <div className="ldg-txn-list">
        {visible.map((t) => (
          <SwipeableRow
            key={t.id}
            txn={t}
            onEdit={() => navigate(`/add?edit=${t.id}&month=${selectedMonth}`)}
            onDelete={() => deleteTxn(t.id)}
          >
            <TxnRow t={t} currency={currency} btcKRW={d.btcKRW} onSettledChange={(settled) => setTxnSettled(t.id, settled)} />
          </SwipeableRow>
        ))}
        {visible.length === 0 && <div className="ldg-page-sub">이번 정산기간 거래 내역이 없어요.</div>}
      </div>
    </div>
  );
}
