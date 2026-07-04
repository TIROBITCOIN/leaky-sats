import type { LedgerData } from "../../types";
import { fmtKRW, kimchiPremium, MAX_REASONABLE_KIMCHI_PREMIUM_ABS } from "../../lib/format";
import { useLedger } from "../../state/LedgerContext";
import {
  formatPriceSourceDelayDetail,
  formatStalePriceStatus,
  formatUpdatedAt,
  getPriceTone,
  PRICE_TONE_COLOR,
} from "../../lib/priceStatus";

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
    btcKrwIsFallback,
    priceUpdatedAt,
    priceStaleSources,
    priceSourceUpdatedAt,
  } = useLedger();
  const kimchi = kimchiPremium(d.btcKRW, d.btcUSD, d.usdKRW);
  const priceSourceTimes = [priceSourceUpdatedAt.btcKRW, priceSourceUpdatedAt.btcUSD, priceSourceUpdatedAt.usdKRW];
  const sourcesFresh =
    !isPriceFallback &&
    !isPriceStale &&
    !btcKrwIsFallback &&
    priceStaleSources.length === 0 &&
    priceSourceTimes.every((value): value is number => value !== null) &&
    new Set(priceSourceTimes).size === 1;
  const kimchiOutlier = !Number.isFinite(kimchi) || Math.abs(kimchi) > MAX_REASONABLE_KIMCHI_PREMIUM_ABS;
  const canShowKimchi = sourcesFresh && !kimchiOutlier;
  const kimchiClass = !canShowKimchi ? "pending" : kimchi > 3 ? "danger" : kimchi >= 0 ? "warn" : "good";
  const kimchiDelayDetail = btcKrwIsFallback
    ? "김프 보류(해외 환산 표시 중)"
    : priceStaleSources.length > 0
    ? formatPriceSourceDelayDetail(priceStaleSources, priceSourceUpdatedAt)
    : isPriceFallback
    ? "아직 모든 시세가 한 번 이상 정상 갱신되지 않았습니다."
    : kimchiOutlier
    ? "계산값이 비정상 범위를 벗어나 확인을 기다리는 중입니다."
    : "";
  const kimchiLabel = canShowKimchi
    ? `김프 ${kimchi >= 0 ? "+" : ""}${kimchi.toFixed(2)}%`
    : sourcesFresh
    ? "김프 계산 보류"
    : "시세 일부 지연";

  const tone = getPriceTone(priceStatus, isPriceFallback, isPriceStale);
  const statusLabel =
    priceStaleSources.length > 0
      ? formatStalePriceStatus(priceStaleSources, priceSourceUpdatedAt)
      : TONE_LABEL[tone](formatUpdatedAt(priceUpdatedAt));

  return (
    <div className="ldg-card ldg-price">
      <div className="ldg-card-head">
        <div className="ldg-label">Bitcoin Price</div>
        <div className={`ldg-kimchi ${kimchiClass}`}>{kimchiLabel}</div>
      </div>
      <div className="ldg-price-grid">
        <div className="ldg-price-col">
          <div className="ldg-tiny">BTC · KRW</div>
          <div className="ldg-price-val full-krw">{fmtKRW(d.btcKRW)}</div>
        </div>
        <div className="ldg-price-col">
          <div className="ldg-tiny">BTC · USD</div>
          <div className="ldg-price-val">${d.btcUSD.toLocaleString("en-US")}</div>
        </div>
        <div className="ldg-price-col">
          <div className="ldg-tiny">USD/KRW</div>
          <div className="ldg-price-val mono">{d.usdKRW.toLocaleString("en-US")}</div>
        </div>
      </div>
      {!canShowKimchi && kimchiDelayDetail && (
        <div className="ldg-tiny" style={{ marginTop: 8 }}>
          {kimchiDelayDetail}
        </div>
      )}
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
