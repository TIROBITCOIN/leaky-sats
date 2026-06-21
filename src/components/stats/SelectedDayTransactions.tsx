import { useNavigate } from "react-router-dom";
import type { Currency, Txn } from "../../types";
import { useLedger } from "../../state/LedgerContext";
import SwipeableRow from "../transaction/SwipeableRow";
import TxnRow from "../home/TxnRow";

function formatSelectedDateLabel(dateKey: string): string {
  const [y, m, d] = dateKey.split("-").map(Number);
  return `${y}년 ${m}월 ${d}일`;
}

interface Props {
  dateKey: string;
  txns: Txn[];
  currency: Currency;
  btcKRW: number;
}

export default function SelectedDayTransactions({ dateKey, txns, currency, btcKRW }: Props) {
  const { deleteTxn } = useLedger();
  const navigate = useNavigate();

  return (
    <div className="ldg-card ldg-txns">
      <div className="ldg-label" style={{ marginBottom: 10 }}>
        {formatSelectedDateLabel(dateKey)}
      </div>
      <div className="ldg-txn-list">
        {txns.map((t) => (
          <SwipeableRow key={t.id} onEdit={() => navigate(`/add?edit=${t.id}`)} onDelete={() => deleteTxn(t.id)}>
            <TxnRow t={t} currency={currency} btcKRW={btcKRW} />
          </SwipeableRow>
        ))}
        {txns.length === 0 && <div className="ldg-page-sub">이 날의 거래가 없습니다.</div>}
      </div>
    </div>
  );
}
