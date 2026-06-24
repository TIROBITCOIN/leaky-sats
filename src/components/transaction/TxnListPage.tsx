import { useNavigate } from "react-router-dom";
import "../../styles/ledger.css";
import "../../styles/forms.css";
import { useLedger } from "../../state/LedgerContext";
import SwipeableRow from "./SwipeableRow";
import TxnRow from "../home/TxnRow";

export default function TxnListPage() {
  const { data, currency, deleteTxn } = useLedger();
  const navigate = useNavigate();

  return (
    <div className="ldg-screen">
      <div className="ldg-content">
        <div className="ldg-page-title">전체 거래</div>
        <div className="ldg-page-sub">왼쪽으로 밀면 삭제, 오른쪽으로 밀면 수정이에요.</div>

        <div className="ldg-card ldg-txns">
          <div className="ldg-txn-list">
            {data.txns.map((t) => (
              <SwipeableRow key={t.id} txn={t} onEdit={() => navigate(`/add?edit=${t.id}`)} onDelete={() => deleteTxn(t.id)}>
                <TxnRow t={t} currency={currency} btcKRW={data.btcKRW} />
              </SwipeableRow>
            ))}
            {data.txns.length === 0 && <div className="ldg-page-sub">아직 거래 내역이 없어요.</div>}
          </div>
        </div>
      </div>
    </div>
  );
}
