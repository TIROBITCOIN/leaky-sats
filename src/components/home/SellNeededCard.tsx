import type { SellResult } from "../../lib/sellCalculator";
import { fmtKRW, fmtBtcValue, type BtcUnit } from "../../lib/format";
import { getMonthLabel } from "../../lib/month";

interface Props {
  result: SellResult;
  unit: BtcUnit;
  selectedMonth: string;
  onConfirmSell?: () => void;
}

export default function SellNeededCard({ result, unit, selectedMonth, onConfirmSell }: Props) {
  const { deficitKrw, sellBtc, afterSellBtc, totalDeficitKrw, confirmedCoverageKrw } = result;
  const noSellNeeded = deficitKrw === 0;
  const hasConfirmed = confirmedCoverageKrw > 0;
  const monthLabel = getMonthLabel(selectedMonth);

  return (
    <div className="ldg-card ldg-settlement-card">
      <div className="ldg-card-context">
        <div className="ldg-label">판매해야 하는 비트코인</div>
        <span className="ldg-card-badge estimate">예상</span>
      </div>
      <div className="ldg-card-helper">현재 BTC 가격 기준 예상 판매량입니다.</div>
      {noSellNeeded ? (
        <div className="ldg-sell-empty">
          <div className="ldg-sell-empty-title">이번 정산기간에는 판매가 필요하지 않습니다.</div>
          <div className="ldg-balance-sub">{fmtBtcValue(0, unit)}</div>
          {hasConfirmed && (
            <div className="ldg-balance-sub" style={{ marginTop: 4 }}>
              판매 확정 기록으로 충당 {fmtKRW(confirmedCoverageKrw)}
            </div>
          )}
        </div>
      ) : (
        <>
          <div className="ldg-inout-main neg ldg-settlement-value">
            {fmtBtcValue(sellBtc, unit)}
          </div>
          <div className="ldg-balance-sub">
            {monthLabel} 남은 부족분 {fmtKRW(deficitKrw)} 기준
          </div>
          {hasConfirmed && (
            <div className="ldg-balance-sub" style={{ marginTop: 4 }}>
              판매 확정 {fmtKRW(confirmedCoverageKrw)} / 총 부족분 {fmtKRW(totalDeficitKrw)}
            </div>
          )}
          <div style={{ marginTop: 8, borderTop: "0.5px solid var(--ldg-border)", paddingTop: 8 }}>
            <div className="ldg-tiny">판매 후 보유 BTC</div>
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
              BTC 판매 확정
            </button>
          )}
        </>
      )}
    </div>
  );
}
