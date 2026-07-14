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
  stale?: boolean;
  wallets: BalanceWalletRow[];
};

/** Phase 4: compact unconfirmed badge — reuses kimchi/pending chip language */
function UnconfirmedBadge({ sats }: { sats: number }) {
  if (!(sats > 0)) return null;
  return (
    <span
      className="ldg-kimchi pending"
      style={{ marginLeft: 6, verticalAlign: "middle", fontSize: 10, padding: "2px 7px" }}
      title="아직 블록에 포함되지 않은 잔고"
    >
      확정 대기 +{sats.toLocaleString("en-US")} sats
    </span>
  );
}

function SyncDelayBadge({ stale = false }: { stale?: boolean }) {
  return (
    <span
      className="ldg-kimchi pending"
      style={{ marginLeft: 6, verticalAlign: "middle", fontSize: 10, padding: "2px 7px" }}
      title={
        stale
          ? "완전한 동기화 전 임시 잔고를 표시하고 있습니다"
          : "일부 API 조회 지연 — 마지막 성공 잔고 표시 중"
      }
    >
      동기화 지연
    </span>
  );
}

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
      onKeyDown={(event) => {
        if (showSync && (event.key === "Enter" || event.key === " ")) {
          event.preventDefault();
          setOpen((value) => !value);
        }
      }}
      role={showSync ? "button" : undefined}
      tabIndex={showSync ? 0 : undefined}
      aria-expanded={showSync ? open : undefined}
      style={{ position: "relative", cursor: showSync ? "pointer" : undefined }}
    >
      <div className="ldg-label">
        보유 BTC
        {showSync && syncMeta.unconfirmedSats > 0 && <UnconfirmedBadge sats={syncMeta.unconfirmedSats} />}
      </div>
      <div className="ldg-balance-main">{fmtBtcValue(heldBtc, unit)}</div>
      <div className="ldg-balance-sub">{fmtBtcValue(heldBtc, otherUnit)}</div>
      {showSync && (
        <div className="ldg-balance-sub" style={{ marginTop: 4, paddingRight: 92 }}>
          {syncMeta.lastSyncLabel}
          {syncMeta.warning && <SyncDelayBadge stale={syncMeta.stale} />}
        </div>
      )}
      {showSync && (
        <span
          style={{
            position: "absolute",
            right: 16,
            bottom: 14,
            fontSize: 11,
            color: "var(--ldg-fg-4)",
          }}
        >
          탭하여 상세
        </span>
      )}
      {showSync && open && (
        <div style={{ marginTop: 10, borderTop: "0.5px solid var(--ldg-border)", paddingTop: 8 }}>
          {syncMeta.wallets.map((w) => (
            <div
              key={w.id}
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "flex-start",
                gap: 8,
                fontSize: 12,
                marginTop: 6,
              }}
            >
              <span style={{ color: "var(--ldg-fg-2)" }}>
                {w.label}
                {w.unconfirmedSats > 0 && (
                  <span className="ldg-balance-sub" style={{ display: "block", margin: 0 }}>
                    확정 대기 +{w.unconfirmedSats.toLocaleString("en-US")} sats
                  </span>
                )}
              </span>
              <span className="ldg-balance-sub" style={{ margin: 0, textAlign: "right" }}>
                {fmtSats(w.totalSats)}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
