import { fmtBtcValue, type BtcUnit } from "../../lib/format";

export default function BalanceCard({ heldBtc, unit }: { heldBtc: number; unit: BtcUnit }) {
  const otherUnit: BtcUnit = unit === "sats" ? "BTC" : "sats";
  return (
    <div className="ldg-card ldg-balance">
      <div className="ldg-label">보유 BTC</div>
      <div className="ldg-balance-main">{fmtBtcValue(heldBtc, unit)}</div>
      <div className="ldg-balance-sub">{fmtBtcValue(heldBtc, otherUnit)}</div>
    </div>
  );
}
