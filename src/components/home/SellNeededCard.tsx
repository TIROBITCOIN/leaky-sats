import type { SellResult } from "../../lib/sellCalculator";
import { fmtKRW } from "../../lib/format";

export default function SellNeededCard({ result }: { result: SellResult }) {
  const { deficitKrw, sellBtc, sellSats, afterSellBtc } = result;
  const noSellNeeded = deficitKrw === 0;

  return (
    <div className="ldg-card">
      <div className="ldg-label">팔아야 할 BTC</div>
      {noSellNeeded ? (
        <>
          <div className="ldg-inout-main pos" style={{ marginTop: 6 }}>0 BTC</div>
          <div className="ldg-balance-sub">매도 필요 없음</div>
        </>
      ) : (
        <>
          <div className="ldg-inout-main neg" style={{ marginTop: 6 }}>
            {sellBtc.toFixed(8)} BTC
          </div>
          <div className="ldg-balance-sub">
            ≈ {sellSats.toLocaleString("en-US")} sats
          </div>
          <div className="ldg-balance-sub">
            부족분 {fmtKRW(deficitKrw)} 기준
          </div>
          <div style={{ marginTop: 8, borderTop: "0.5px solid var(--ldg-border)", paddingTop: 8 }}>
            <div className="ldg-tiny">매도 후 보유 BTC</div>
            <div className="ldg-price-val" style={{ marginTop: 2 }}>
              {afterSellBtc.toFixed(8)} BTC
            </div>
          </div>
        </>
      )}
    </div>
  );
}
