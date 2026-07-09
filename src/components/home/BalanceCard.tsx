import { useState } from "react";
import { fmtBtcValue, fmtSats, type BtcUnit } from "../../lib/format";
import { getHeldBtcMode, type HeldBtcMode } from "../../lib/walletConfig";

export type BalanceWalletRow = {
  id: string;
  label: string;
  totalSats: number;
  unconfirmedSats: number;
  status: string;
};

export type BalanceSyncMeta = {
  mode: HeldBtcMode;
  walletCount: number;
  lastSyncLabel: string;
  unconfirmedSats: number;
  warning?: string;
  wallets: BalanceWalletRow[];
};

export default function BalanceCard({
  heldBtc,
  unit,
  syncMeta,
}: {
  heldBtc: number;
  unit: BtcUnit;
  syncMeta?: BalanceSyncMeta | null;
}) {
  const otherUnit: BtcUnit = unit === "sats" ? "BTC" : "sats";
  const [open, setOpen] = useState(false);
  const mode = syncMeta?.mode ?? getHeldBtcMode();
  const showSync = mode === "wallet-sync" && syncMeta && syncMeta.walletCount > 0;

  return (
    <div
      className="ldg-card ldg-balance"
      onClick={() => {
        if (showSync) setOpen((v) => !v);
      }}
      style={showSync ? { cursor: "pointer" } : undefined}
    >
      <div className="ldg-label">보유 BTC</div>
      <div className="ldg-balance-main">{fmtBtcValue(heldBtc, unit)}</div>
      <div className="ldg-balance-sub">{fmtBtcValue(heldBtc, otherUnit)}</div>
      {showSync && (
        <div className="ldg-balance-sub" style={{ marginTop: 4 }}>
          지갑 {syncMeta.walletCount}개 · {syncMeta.lastSyncLabel}
          {syncMeta.unconfirmedSats > 0
            ? ` · 확정 대기 ⏳ ${syncMeta.unconfirmedSats.toLocaleString("en-US")} sats`
            : ""}
          {syncMeta.warning ? ` · ${syncMeta.warning}` : ""}
        </div>
      )}
      {showSync && open && (
        <div style={{ marginTop: 10, borderTop: "0.5px solid var(--ldg-border)", paddingTop: 8 }}>
          {syncMeta.wallets.map((w) => (
            <div
              key={w.id}
              style={{ display: "flex", justifyContent: "space-between", gap: 8, fontSize: 12, marginTop: 4 }}
            >
              <span style={{ color: "var(--ldg-fg-2)" }}>{w.label}</span>
              <span className="ldg-balance-sub" style={{ margin: 0 }}>
                {fmtSats(w.totalSats)}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
