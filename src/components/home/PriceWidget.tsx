import type { LedgerData } from "../../types";
import { kimchiPremium } from "../../lib/format";
import { useLedger } from "../../state/LedgerContext";
import { formatStalePriceStatus, formatUpdatedAt, getPriceTone, PRICE_TONE_COLOR } from "../../lib/priceStatus";

const TONE_LABEL: Record<ReturnType<typeof getPriceTone>, (time: string) => string> = {
  live: (time) => `LIVE${time ? ` · ${time} 갱신` : ""}`,
  loading: () => "시세 불러오는 중...",
  stale: (time) => `갱신 실패 · ${time || "마지막"} 값 유지`,
  offline: () => "오프라인 · 더미 시세 표시 중",
};

export default function PriceWidget({ d }: { d: LedgerData }) {
  const {
    priceStatus,
    isPriceFallback,
    isPriceStale,
    priceUpdatedAt,
    priceStaleSources,
    priceSourceUpdatedAt,
    priceSourceMeta,
  } = useLedger();
  const kimchi = kimchiPremium(d.btcKRW, d.btcUSD, d.usdKRW);
  const kimchiClass = kimchi > 3 ? "danger" : kimchi >= 0 ? "warn" : "good";

  const tone = getPriceTone(priceStatus, isPriceFallback, isPriceStale);
  const statusLabel =
    priceStaleSources.length > 0
      ? formatStalePriceStatus(priceStaleSources, priceSourceUpdatedAt)
      : TONE_LABEL[tone](formatUpdatedAt(priceUpdatedAt));

  return (
    <div className="ldg-card ldg-price">
      <div className="ldg-card-head">
        <div className="ldg-label">Bitcoin Price</div>
        <div className={`ldg-kimchi ${kimchiClass}`}>
          김프 근사 {kimchi >= 0 ? "+" : ""}
          {kimchi.toFixed(2)}%
        </div>
      </div>
      <div className="ldg-price-grid">
        <div>
          <div className="ldg-tiny">UPBIT · KRW</div>
          <div className="ldg-price-val">₩{(d.btcKRW / 1_000_000).toFixed(1)}M</div>
        </div>
        <div>
          <div className="ldg-tiny">{(priceSourceMeta.btcUsd ?? "BINANCE").toUpperCase()} · USD</div>
          <div className="ldg-price-val">${d.btcUSD.toLocaleString("en-US")}</div>
        </div>
        <div>
          <div className="ldg-tiny">{priceSourceMeta.usdKrw ? `${priceSourceMeta.usdKrw.toUpperCase()} · ` : ""}USD/KRW</div>
          <div className="ldg-price-val mono">{d.usdKRW.toLocaleString("en-US")}</div>
        </div>
      </div>
      <div className="ldg-tiny" style={{ marginTop: 8 }}>
        {priceSourceMeta.usdKrw === "Frankfurter" && priceSourceMeta.fxReferenceDate
          ? `환율 기준일 ${priceSourceMeta.fxReferenceDate} · 일일 환율 기준 김프(근사)`
          : priceSourceMeta.usdKrw === "Coinbase"
          ? "Coinbase 환율 기준 김프(근사)"
          : "환율 기준 김프(근사)"}
      </div>
      <div className="ldg-tiny" style={{ marginTop: 10, display: "flex", alignItems: "center", gap: 6 }}>
        <span
          style={{
            width: 6,
            height: 6,
            borderRadius: 99,
            background: PRICE_TONE_COLOR[tone],
            flexShrink: 0,
          }}
        />
        {statusLabel}
      </div>
    </div>
  );
}
