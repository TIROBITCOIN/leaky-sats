import type { LedgerData } from "../../types";
import { fmtKRW, fmtBtcValue, type BtcUnit } from "../../lib/format";

export default function BalanceCard({ d, heldBtc, unit }: { d: LedgerData; heldBtc: number; unit: BtcUnit }) {
  const valuationKrw = d.btcKRW > 0 ? heldBtc * d.btcKRW : 0;
  return (
    <div className="ldg-card ldg-balance">
      <div className="ldg-label">보유 BTC</div>
      <div className="ldg-balance-main">{fmtBtcValue(heldBtc, unit)}</div>
      <div className="ldg-balance-sub">≈ {fmtKRW(valuationKrw)}</div>
    </div>
  );
}
