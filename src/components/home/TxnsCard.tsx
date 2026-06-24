import { Link, useNavigate } from "react-router-dom";
import type { Currency, LedgerData } from "../../types";
import { useLedger } from "../../state/LedgerContext";
import SwipeableRow from "../transaction/SwipeableRow";
import TxnRow from "./TxnRow";

const HOME_TXN_LIMIT = 5;

export default function TxnsCard({ d, currency }: { d: LedgerData; currency: Currency }) {
  const { deleteTxn } = useLedger();
  const navigate = useNavigate();
  const visible = d.txns.slice(0, HOME_TXN_LIMIT);

  return (
    <div className="ldg-card ldg-txns">
      <div className="ldg-card-head">
        <div className="ldg-label">최근 거래</div>
        <Link to="/transactions" className="ldg-link">
          전체 보기 →
        </Link>
      </div>
      <div className="ldg-txn-list">
        {visible.map((t) => (
          <SwipeableRow key={t.id} txn={t} onEdit={() => navigate(`/add?edit=${t.id}`)} onDelete={() => deleteTxn(t.id)}>
            <TxnRow t={t} currency={currency} btcKRW={d.btcKRW} />
          </SwipeableRow>
        ))}
        {visible.length === 0 && <div className="ldg-page-sub">아직 거래 내역이 없어요.</div>}
      </div>
    </div>
  );
}
