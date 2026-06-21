import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import "../../styles/ledger.css";
import "../../styles/forms.css";
import { useLedger } from "../../state/LedgerContext";
import { fmtKRW, fmtBtcValue, loadBtcUnit, type BtcUnit } from "../../lib/format";
import { getHeldBtc } from "../../lib/heldBtc";
import { calculateBitcoinPortfolio } from "../../lib/ledgerCalc.js";
import PriceWidget from "../home/PriceWidget";

export default function AssetsPage() {
  const { data } = useLedger();
  // 자산 탭의 현재 보유량/Total Balance는 항상 heldBtc(설정에서 입력한 값 + 판매 확정 차감)를
  // source of truth로 쓴다 — 거래 내역으로 다시 추정해서 덮어쓰지 않는다.
  const [heldBtc, setHeldBtc] = useState(getHeldBtc);
  const [unit, setUnit] = useState<BtcUnit>(loadBtcUnit);

  useEffect(() => {
    const refresh = () => {
      setHeldBtc(getHeldBtc());
      setUnit(loadBtcUnit());
    };
    const onVisibility = () => {
      if (document.visibilityState === "visible") refresh();
    };
    document.addEventListener("visibilitychange", onVisibility);
    window.addEventListener("focus", refresh);
    return () => {
      document.removeEventListener("visibilitychange", onVisibility);
      window.removeEventListener("focus", refresh);
    };
  }, []);

  // 적립 추이(누적 sats)만 거래 내역에서 뽑아 쓴다 — 현재 보유량 표시와는 별개의, 과거 흐름용 데이터다.
  const portfolio = useMemo(() => calculateBitcoinPortfolio(data.txns, data.btcKRW), [data.txns, data.btcKRW]);
  const valuationKrw = data.btcKRW > 0 ? heldBtc * data.btcKRW : 0;

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
        <div className="ldg-page-sub">HODL 중인 BTC의 현재 가치를 확인합니다.</div>

        <div className="ldg-card ldg-balance">
          <div className="ldg-label">Total Balance</div>
          <div className="ldg-balance-main">{fmtKRW(Math.round(valuationKrw))}</div>
          <div className="ldg-balance-sub">
            {unit === "sats" ? (
              <>
                {fmtBtcValue(heldBtc, "sats")} · {fmtBtcValue(heldBtc, "BTC")}
              </>
            ) : (
              <>
                {fmtBtcValue(heldBtc, "BTC")} · {fmtBtcValue(heldBtc, "sats")}
              </>
            )}
          </div>
          {heldBtc === 0 && (
            <div style={{ marginTop: 10, paddingTop: 10, borderTop: "0.5px solid var(--ldg-border)" }}>
              <div className="ldg-page-sub" style={{ margin: 0 }}>
                설정에서 보유 BTC를 입력하면 현재 가치를 확인할 수 있습니다.
              </div>
              <Link to="/settings" className="ldg-link" style={{ display: "inline-block", marginTop: 8 }}>
                보유 BTC 입력하기 →
              </Link>
            </div>
          )}
        </div>

        <PriceWidget d={data} />

        <div className="ldg-card">
          <div className="ldg-label" style={{ marginBottom: 4 }}>
            적립 추이
          </div>
          <div className="ldg-page-sub" style={{ marginBottom: 10 }}>
            BTC 구매/판매 기록을 바탕으로 보유 흐름을 표시합니다.
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
            <div className="ldg-page-sub">아직 BTC 구매/판매 기록이 없습니다.</div>
          )}
        </div>
      </div>
    </div>
  );
}
