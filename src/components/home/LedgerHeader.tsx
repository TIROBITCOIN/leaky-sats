import type { LedgerData } from "../../types";
import { getCurrentMonthLabel } from "../../lib/month";

export default function LedgerHeader({ d, walletName }: { d: LedgerData; walletName: string }) {
  return (
    <div className="ldg-header">
      <div>
        <div className="ldg-month">{getCurrentMonthLabel()}</div>
        <div className="ldg-app-name">{walletName}</div>
      </div>
      <div className="ldg-block">
        <span className="ldg-block-dot" />
        <span className="ldg-block-num">#{d.blockHeight.toLocaleString("en-US")}</span>
      </div>
    </div>
  );
}
