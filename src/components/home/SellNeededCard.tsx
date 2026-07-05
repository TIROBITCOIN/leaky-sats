import type { MonthSellSummary } from "../../lib/btcSellRecords";
import type { SellResult } from "../../lib/sellCalculator";
import { fmtKRW, fmtSats } from "../../lib/format";

interface Props {
  result: SellResult;
  monthlySellSummary: MonthSellSummary;
  onConfirmSell?: () => void;
}

export default function SellNeededCard({ result, monthlySellSummary, onConfirmSell }: Props) {
  const { deficitKrw, sellSats, totalDeficitKrw } = result;
  const everHadDeficit = totalDeficitKrw > 0;
  const sellRecorded = everHadDeficit && monthlySellSummary.totalKrwCovered >= totalDeficitKrw;
  const needSell = deficitKrw > 0 && !sellRecorded;

  if (!everHadDeficit) return null;

  return (
    <div className="ldg-card">
      {sellRecorded ? (
        <>
          <div className="ldg-settlement-done">판매 완료</div>
          <div className="ldg-done-list">
            <div className="ldg-done-row">
              <span className="ldg-done-label">실제 판매량</span>
              <span className="ldg-done-val ldg-btc-val">
                <strong>{fmtSats(monthlySellSummary.totalSatsSold)}</strong>
              </span>
            </div>
          </div>
        </>
      ) : needSell ? (
        <>
          <div className="ldg-label">판매해야 하는 비트코인</div>
          <div className="ldg-sell-sats-primary">{fmtSats(sellSats)}</div>
          <div className="ldg-sell-krw-secondary">{fmtKRW(deficitKrw)}</div>
          {onConfirmSell && (
            <button type="button" className="ldg-submit-btn" style={{ marginTop: 12 }} onClick={onConfirmSell}>
              판매
            </button>
          )}
        </>
      ) : null}
    </div>
  );
}
