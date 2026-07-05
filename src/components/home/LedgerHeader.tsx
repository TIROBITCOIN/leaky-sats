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
        block height : {d.blockHeight.toLocaleString("en-US")}
      </div>
    </div>
  );
}
