import type { Currency } from "../../types";
import { fmtBTC, fmtKRW } from "../../lib/format";

export default function InOutCards({
  incomeKrw,
  expenseKrw,
  netKrw,
  btcKRW,
  currency,
}: {
  incomeKrw: number;
  expenseKrw: number;
  netKrw: number;
  btcKRW: number;
  currency: Currency;
}) {
  const fmt = (value: number) =>
    currency === "KRW"
      ? (value >= 0 ? "+" : "") + fmtKRW(value)
      : `${value >= 0 ? "+" : "-"}₿${(Math.abs(value) / btcKRW).toFixed(5)}`;
  const sub = (value: number) => (currency === "KRW" ? fmtBTC(value, btcKRW) : fmtKRW(value));

  return (
    <div className="ldg-inout">
      <div className="ldg-card ldg-inout-card">
        <div className="ldg-label">수입</div>
        <div className="ldg-inout-main pos">{fmt(incomeKrw)}</div>
        <div className="ldg-inout-sub">{sub(incomeKrw)}</div>
      </div>
      <div className="ldg-card ldg-inout-card">
        <div className="ldg-label">지출</div>
        <div className="ldg-inout-main neg">{fmt(-expenseKrw)}</div>
        <div className="ldg-inout-sub">{sub(expenseKrw)}</div>
      </div>
      <div className="ldg-card ldg-net-card">
        <div>
          <div className="ldg-label">남는 금액</div>
        </div>
        <div className={`ldg-net-value ${netKrw >= 0 ? "pos" : "neg"}`}>
          {netKrw >= 0 ? "+" : "−"}
          {fmtKRW(Math.abs(netKrw))}
        </div>
      </div>
    </div>
  );
}
