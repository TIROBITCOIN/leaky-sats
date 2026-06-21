import type { LedgerData } from "../../types";
import MonthSelector from "../common/MonthSelector";

interface Props {
  d: LedgerData;
  walletName: string;
  selectedMonth: string;
  onChangeMonth: (monthKey: string) => void;
}

export default function LedgerHeader({ d, walletName, selectedMonth, onChangeMonth }: Props) {
  return (
    <div className="ldg-header">
      <div>
        <MonthSelector selectedMonth={selectedMonth} onChangeMonth={onChangeMonth} />
        <div className="ldg-app-name">{walletName}</div>
      </div>
      <div className="ldg-block">
        <span className="ldg-block-dot" />
        <span className="ldg-block-num">#{d.blockHeight.toLocaleString("en-US")}</span>
      </div>
    </div>
  );
}
