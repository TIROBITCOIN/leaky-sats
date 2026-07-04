import type { Txn } from "../../types";
import { fmtKRW, formatCategoryLabel, formatTxnDateLabel } from "../../lib/format";
import CategoryIcon from "./CategoryIcon";

function getTxnDisplayTime(txn: Txn): string {
  const parsed = new Date(txn.date);
  if (!Number.isNaN(parsed.getTime())) return formatTxnDateLabel(txn.date);
  return txn.time;
}

export default function TxnRow({ t }: { t: Txn }) {
  const isPos = t.amount >= 0;
  const main = (isPos ? "+" : "") + fmtKRW(t.amount);
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
              ·
            </span>
          )}
        </div>
        <div className="ldg-txn-meta">{showCatLabel ? `${catLabel} · ${getTxnDisplayTime(t)}` : getTxnDisplayTime(t)}</div>
      </div>
      <div className="ldg-txn-amt">
        <div className={`ldg-txn-main ${isPos ? "pos" : "neg"}`}>{main}</div>
      </div>
    </>
  );
}
