import type { LedgerData } from "../../types";

interface Props {
  d: LedgerData;
  walletName: string;
}

export default function LedgerHeader({ d, walletName }: Props) {
  return (
    <div className="ldg-header">
      <div className="ldg-app-name">{walletName}</div>
      <div className="ldg-block">
        <span className="ldg-block-dot" />
        <span className="ldg-block-num">#{d.blockHeight.toLocaleString("en-US")}</span>
      </div>
    </div>
  );
}
