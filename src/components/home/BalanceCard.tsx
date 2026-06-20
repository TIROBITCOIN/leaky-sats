import type { LedgerData } from "../../types";
import { fmtKRW } from "../../lib/format";

export default function BalanceCard({ d, heldBtc }: { d: LedgerData; heldBtc: number }) {
  const valuationKrw = d.btcKRW > 0 ? heldBtc * d.btcKRW : 0;
  const sats = Math.round(heldBtc * 1e8);
  return (
    <div className="ldg-card ldg-balance">
      <div className="ldg-label">보유 BTC</div>
      <div className="ldg-balance-main">{heldBtc.toFixed(8)} BTC</div>
      <div className="ldg-balance-sub">
        ≈ {fmtKRW(valuationKrw)} · {sats.toLocaleString("en-US")} sats
      </div>
    </div>
  );
}
