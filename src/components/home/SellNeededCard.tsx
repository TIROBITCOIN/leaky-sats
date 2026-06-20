import type { SellResult } from "../../lib/sellCalculator";
import { fmtKRW, fmtBtcValue, type BtcUnit } from "../../lib/format";

interface Props {
  result: SellResult;
  unit: BtcUnit;
  onConfirmSell?: () => void;
}

export default function SellNeededCard({ result, unit, onConfirmSell }: Props) {
  const { deficitKrw, sellBtc, afterSellBtc, totalDeficitKrw, confirmedCoverageKrw } = result;
  const noSellNeeded = deficitKrw === 0;
  const hasConfirmed = confirmedCoverageKrw > 0;

  return (
    <div className="ldg-card">
      <div className="ldg-label">팔아야 할 BTC</div>
      {noSellNeeded ? (
        <>
          <div className="ldg-inout-main pos" style={{ marginTop: 6 }}>
            {fmtBtcValue(0, unit)}
          </div>
          <div className="ldg-balance-sub">매도 필요 없음</div>
          {hasConfirmed && (
            <div className="ldg-balance-sub" style={{ marginTop: 4 }}>
              이미 반영 {fmtKRW(confirmedCoverageKrw)}
            </div>
          )}
        </>
      ) : (
        <>
          <div className="ldg-inout-main neg" style={{ marginTop: 6 }}>
            {fmtBtcValue(sellBtc, unit)}
          </div>
          <div className="ldg-balance-sub">
            남은 부족분 {fmtKRW(deficitKrw)} 기준
          </div>
          {hasConfirmed && (
            <div className="ldg-balance-sub" style={{ marginTop: 4 }}>
              이미 반영 {fmtKRW(confirmedCoverageKrw)} / 총 부족분 {fmtKRW(totalDeficitKrw)}
            </div>
          )}
          <div style={{ marginTop: 8, borderTop: "0.5px solid var(--ldg-border)", paddingTop: 8 }}>
            <div className="ldg-tiny">매도 후 보유 BTC</div>
            <div className="ldg-price-val" style={{ marginTop: 2 }}>
              {fmtBtcValue(afterSellBtc, unit)}
            </div>
          </div>
          {onConfirmSell && (
            <button
              type="button"
              className="ldg-submit-btn"
              style={{ marginTop: 12 }}
              onClick={onConfirmSell}
            >
              BTC 매도 반영
            </button>
          )}
        </>
      )}
    </div>
  );
}
