import { useMemo } from "react";
import "../../styles/ledger.css";
import "../../styles/forms.css";
import { useLedger } from "../../state/LedgerContext";
import { fmtKRW, fmtSats } from "../../lib/format";
import { calculateBitcoinPortfolio } from "../../lib/ledgerCalc.js";

export default function AssetsPage() {
  const { data } = useLedger();
  const portfolio = useMemo(() => calculateBitcoinPortfolio(data.txns, data.btcKRW), [data.txns, data.btcKRW]);
  const pnlClass = portfolio.unrealizedPnlKrw >= 0 ? "pos" : "neg";

  // BTC quantity is estimated from manual KRW transactions using abs(amount) / btcAt.
  const W = 320;
  const H = 90;
  const pad = 8;
  const points = portfolio.accumulation.map((p) => p.cumulativeSats);
  const minSats = Math.min(...points, 0);
  const maxSats = Math.max(...points, 1);
  const range = maxSats - minSats || 1;
  const valueToY = (v: number) => pad + (1 - (v - minSats) / range) * (H - pad * 2);
  const pointCoords = points.map((v, i) => {
    const x = points.length === 1 ? pad : pad + i * ((W - pad * 2) / (points.length - 1));
    return { x, y: valueToY(v) };
  });
  const linePath = pointCoords.map((p, i) => (i === 0 ? "M" : "L") + p.x.toFixed(1) + "," + p.y.toFixed(1)).join(" ");
  const zeroY = valueToY(0);

  return (
    <div className="ldg-screen">
      <div className="ldg-content">
        <div className="ldg-page-title">자산</div>
        <div className="ldg-page-sub">BTC 매수/매도 거래를 기준으로 보유량과 평가액을 계산합니다.</div>

        <div className="ldg-card ldg-balance">
          <div className="ldg-label">보유 BTC 평가액</div>
          <div className="ldg-balance-main">{fmtKRW(Math.round(portfolio.valuationKrw))}</div>
          <div className="ldg-balance-sub">
            {portfolio.holdingBtc.toFixed(8)} BTC · {fmtSats(portfolio.holdingSats)}
          </div>
        </div>

        <div className="ldg-inout">
          <div className="ldg-card ldg-inout-card">
            <div className="ldg-label">평가손익</div>
            <div className={`ldg-inout-main ${pnlClass}`}>
              {portfolio.unrealizedPnlKrw >= 0 ? "+" : ""}
              {fmtKRW(Math.round(portfolio.unrealizedPnlKrw))}
            </div>
            <div className="ldg-inout-sub">
              {portfolio.unrealizedPnlPct >= 0 ? "+" : ""}
              {portfolio.unrealizedPnlPct.toFixed(2)}%
            </div>
          </div>
          <div className="ldg-card ldg-inout-card">
            <div className="ldg-label">평균 매입가</div>
            <div className="ldg-inout-main">
              {portfolio.averageCostKrwPerBtc > 0 ? fmtKRW(Math.round(portfolio.averageCostKrwPerBtc)) : "-"}
            </div>
            <div className="ldg-inout-sub">총 매수 {fmtKRW(portfolio.totalBuyKrw)}</div>
          </div>
        </div>

        <div className="ldg-card">
          <div className="ldg-label" style={{ marginBottom: 10 }}>
            BTC 포지션
          </div>
          <div className="ldg-page-sub">
            현재가 {fmtKRW(portfolio.currentPrice)} · 총 매도 {fmtKRW(portfolio.totalSellKrw)} · 순투입금{" "}
            {fmtKRW(portfolio.netInvestedKrw)}
          </div>
        </div>

        <div className="ldg-card">
          <div className="ldg-label" style={{ marginBottom: 10 }}>
            적립 추이 (누적 sats)
          </div>
          {pointCoords.length > 1 ? (
            <svg className="ldg-chart" viewBox={`0 0 ${W} ${H}`} role="img" aria-label="누적 사토시 적립 추이">
              <line x1={pad} x2={W - pad} y1={zeroY} y2={zeroY} stroke="rgba(255,255,255,0.06)" />
              <path d={linePath} fill="none" stroke="#F7931A" strokeWidth="1.5" />
              <path d={linePath} fill="none" stroke="#F7931A" strokeWidth="3" opacity="0.25" />
            </svg>
          ) : pointCoords.length === 1 ? (
            <svg className="ldg-chart" viewBox={`0 0 ${W} ${H}`} role="img" aria-label="누적 사토시 적립 추이">
              <line x1={pad} x2={W - pad} y1={zeroY} y2={zeroY} stroke="rgba(255,255,255,0.06)" />
              <line
                x1={pointCoords[0].x}
                x2={pointCoords[0].x}
                y1={zeroY}
                y2={pointCoords[0].y}
                stroke="#F7931A"
                strokeWidth="2"
                opacity="0.5"
              />
              <circle cx={pointCoords[0].x} cy={pointCoords[0].y} r="4" fill="#F7931A" />
            </svg>
          ) : (
            <div className="ldg-page-sub">아직 BTC 매수/매도 거래가 없습니다.</div>
          )}
        </div>
      </div>
    </div>
  );
}
