import type { Currency, Txn } from "../../types";
import { fmtKRW, krwToBtc, krwToSats, formatCategoryLabel } from "../../lib/format";
import CategoryIcon from "./CategoryIcon";

export default function TxnRow({ t, currency, btcKRW }: { t: Txn; currency: Currency; btcKRW: number }) {
  const isPos = t.amount >= 0;
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
  const showCatLabel = catLabel !== t.title;

  return (
    <>
      <CategoryIcon cat={t.cat} />
      <div className="ldg-txn-mid">
        <div className="ldg-txn-title">
          {t.title}
          {t.memo?.trim() && (
            <span className="ldg-txn-memo-indicator" aria-label="메모 있음">
              ●
            </span>
          )}
        </div>
        <div className="ldg-txn-meta">{showCatLabel ? `${catLabel} · ${t.time}` : t.time}</div>
      </div>
      <div className="ldg-txn-amt">
        <div className={`ldg-txn-main ${isPos ? "pos" : "neg"}`}>{main}</div>
        <div className="ldg-txn-sub">{sub}</div>
      </div>
    </>
  );
}
