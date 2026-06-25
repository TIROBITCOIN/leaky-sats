import type { Txn } from "../../types";
import { useLedger } from "../../state/LedgerContext";
import { fmtKRW } from "../../lib/format";
import { calculateCategorySpending } from "../../lib/ledgerCalc.js";

export default function CategoryDonut({ txns }: { txns: Txn[] }) {
  const { categoriesById } = useLedger();
  const { entries, total } = calculateCategorySpending(txns, { includeInvestments: false });

  const R = 46;
  const CIRC = 2 * Math.PI * R;
  let offset = 0;

  if (total === 0) {
    return <div className="ldg-page-sub">이번 기간의 생활비 지출 내역이 없습니다.</div>;
  }

  return (
    <div style={{ display: "flex", alignItems: "center", gap: 18 }}>
      <svg width="120" height="120" viewBox="0 0 120 120" style={{ flexShrink: 0 }}>
        <circle cx="60" cy="60" r={R} fill="none" stroke="rgba(17,17,20,0.07)" strokeWidth="14" />
        {entries.map((entry) => {
          const c = categoriesById[entry.cat] ?? categoriesById.etc;
          const frac = entry.amount / total;
          const len = frac * CIRC;
          const dash = `${len} ${CIRC - len}`;
          const el = (
            <circle
              key={entry.cat}
              cx="60"
              cy="60"
              r={R}
              fill="none"
              stroke={c.fg}
              strokeWidth="14"
              strokeDasharray={dash}
              strokeDashoffset={-offset}
              transform="rotate(-90 60 60)"
            />
          );
          offset += len;
          return el;
        })}
      </svg>
      <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: 8 }}>
        {entries.map((entry) => {
          const c = categoriesById[entry.cat] ?? categoriesById.etc;
          return (
            <div key={entry.cat} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", fontSize: 12 }}>
              <span style={{ display: "flex", alignItems: "center", gap: 6, color: "var(--ldg-fg-2)" }}>
                <span style={{ width: 8, height: 8, borderRadius: 99, background: c.fg, display: "inline-block" }} />
                {c.label}
              </span>
              <span className="mono" style={{ fontFamily: "var(--ldg-mono)", color: "var(--ldg-fg-3)" }}>
                {fmtKRW(entry.amount)} · {((entry.amount / total) * 100).toFixed(0)}%
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
