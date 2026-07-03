import type { Currency, Txn } from "../../types";
import { fmtKRW, krwToBtc, krwToSats, formatCategoryLabel, formatTxnDateLabel } from "../../lib/format";
import { isTxnSettled } from "../../lib/sellCalculator";
import CategoryIcon from "./CategoryIcon";

function getTxnDisplayTime(txn: Txn): string {
  const parsed = new Date(txn.date);
  if (!Number.isNaN(parsed.getTime())) return formatTxnDateLabel(txn.date);
  return txn.time;
}

export default function TxnRow({
  t,
  currency,
  btcKRW,
  onSettledChange,
}: {
  t: Txn;
  currency: Currency;
  btcKRW: number;
  onSettledChange?: (settled: boolean) => void;
}) {
  const isPos = t.amount >= 0;
  const settled = isTxnSettled(t);
  const settledLabel = isPos ? "입금완료" : "출금완료";
  // 사토시/BTC 환산은 거래 당시 시세(t.btcAt)가 아니라 항상 현재 시세(btcKRW) 기준
  const main =
    currency === "KRW"
      ? (isPos ? "+" : "") + fmtKRW(t.amount)
      : `${isPos ? "+" : "-"}₿ ${krwToBtc(Math.abs(t.amount), btcKRW).toFixed(6)}`;
  const sub =
    currency === "KRW"
      ? `${krwToSats(Math.abs(t.amount), btcKRW).toLocaleString("en-US")} sats`
      : fmtKRW(Math.abs(t.amount));
  // 큰 항목만 고르고 세부 기관명을 안 적으면 title이 catLabel과 같아진다(applyAddTxn의 fallback).
  // 이 경우 "월세 / 월세 · 시간"처럼 같은 말이 두 줄로 겹쳐 보이지 않게 둘째 줄엔 시간만 남긴다.
  const catLabel = formatCategoryLabel(t.catLabel);
  const title = t.cat === "btc_buy" ? formatCategoryLabel(t.title) : t.title;
  const showCatLabel = catLabel !== title;

  return (
    <>
      <CategoryIcon cat={t.cat} />
      <div className="ldg-txn-mid">
        <div className="ldg-txn-title">
          {title}
          {t.memo?.trim() && (
            <span className="ldg-txn-memo-indicator" aria-label="메모 있음">
              ●
            </span>
          )}
        </div>
        <div className="ldg-txn-meta">{showCatLabel ? `${catLabel} · ${getTxnDisplayTime(t)}` : getTxnDisplayTime(t)}</div>
      </div>
      <div className="ldg-txn-amt">
        <div className={`ldg-txn-main ${isPos ? "pos" : "neg"}`}>{main}</div>
        <div className="ldg-txn-sub">{sub}</div>
        {onSettledChange && (
          <label className="ldg-txn-settled-toggle" onClick={(event) => event.stopPropagation()}>
            <input
              type="checkbox"
              checked={settled}
              onChange={(event) => onSettledChange(event.target.checked)}
              aria-label={`${title} ${settledLabel}`}
            />
            <span>{settledLabel}</span>
          </label>
        )}
      </div>
    </>
  );
}
