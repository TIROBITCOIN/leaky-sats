import { useCallback, useEffect, useState } from "react";
import {
  defaultWalletLabel,
  generateWalletId,
  getAggregatedTotalSats,
  getHeldBtcMode,
  isDuplicateDescriptor,
  loadLastBalances,
  loadWalletConfig,
  normalizeWalletLabel,
  saveLastBalances,
  saveWalletConfig,
  type WalletEntry,
  type WalletSyncConfig,
  WALLET_LABEL_MAX,
} from "../../lib/walletConfig";
import type { WalletDescriptor } from "../../lib/wallet/xpub";
import { previewXpubAddresses, syncAllWallets, testMempoolConnection, validateXpub } from "../../lib/walletSync";
import { fmtSats } from "../../lib/format";

function statusDotColor(status: string): string {
  if (status === "online") return "var(--ldg-pos)";
  if (status === "partial") return "var(--ldg-orange)";
  return "var(--ldg-fg-4)";
}

function formatSyncTime(iso: string | null): string {
  if (!iso) return "동기화 기록 없음";
  try {
    const d = new Date(iso);
    if (!Number.isFinite(d.getTime())) return "동기화 기록 없음";
    const diffMs = Date.now() - d.getTime();
    if (diffMs < 60_000) return "방금 전";
    if (diffMs < 3_600_000) return `${Math.floor(diffMs / 60_000)}분 전`;
    if (diffMs < 86_400_000) return `${Math.floor(diffMs / 3_600_000)}시간 전`;
    return d.toLocaleString("ko-KR");
  } catch {
    return "동기화 기록 없음";
  }
}

export default function WalletSyncSettings() {
  const [config, setConfig] = useState<WalletSyncConfig>(() => loadWalletConfig());
  const [urlInput, setUrlInput] = useState(() => loadWalletConfig().mempoolApiUrl);
  const [connectMsg, setConnectMsg] = useState<string | null>(null);
  const [connectOk, setConnectOk] = useState(false);
  const [syncMsg, setSyncMsg] = useState<string | null>(null);
  const [syncing, setSyncing] = useState(false);
  const [testing, setTesting] = useState(false);

  const [adding, setAdding] = useState(false);
  const [addMode, setAddMode] = useState<"xpub" | "addresses">("xpub");
  const [addLabel, setAddLabel] = useState("");
  const [addXpub, setAddXpub] = useState("");
  const [addAddresses, setAddAddresses] = useState("");
  const [addPreview, setAddPreview] = useState<string[]>([]);
  const [addError, setAddError] = useState<string | null>(null);
  const [addBusy, setAddBusy] = useState(false);

  const [editId, setEditId] = useState<string | null>(null);
  const [editLabel, setEditLabel] = useState("");

  const [agg, setAgg] = useState(() => getAggregatedTotalSats());
  const balances = loadLastBalances();

  const refresh = useCallback(() => {
    setConfig(loadWalletConfig());
    setAgg(getAggregatedTotalSats());
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const persist = (next: WalletSyncConfig) => {
    saveWalletConfig(next);
    setConfig(next);
    setAgg(getAggregatedTotalSats());
  };

  const setMode = (enabled: boolean) => {
    persist({ ...config, enabled });
  };

  const saveUrl = () => {
    persist({ ...config, mempoolApiUrl: urlInput.trim() });
    setConnectMsg(null);
  };

  const handleTest = async () => {
    setTesting(true);
    setConnectMsg(null);
    const result = await testMempoolConnection(urlInput);
    setTesting(false);
    if (result.ok) {
      setConnectOk(true);
      setConnectMsg(`연결 성공 · 블록 높이 ${result.height?.toLocaleString("en-US")}`);
      persist({ ...config, mempoolApiUrl: urlInput.trim() });
    } else {
      setConnectOk(false);
      setConnectMsg(result.error ?? "연결 실패");
    }
  };

  const handleSyncAll = async () => {
    setSyncing(true);
    setSyncMsg(null);
    if (urlInput.trim() !== config.mempoolApiUrl) {
      persist({ ...config, mempoolApiUrl: urlInput.trim() });
    }
    const result = await syncAllWallets({ force: true });
    setSyncing(false);
    refresh();
    if (result.skipped) {
      setSyncMsg(result.reason === "throttled" ? "잠시 후 다시 시도하세요." : "동기화가 이미 진행 중입니다.");
      return;
    }
    if (result.reason === "disabled-or-empty") {
      setSyncMsg("지갑 동기화 모드를 켜고 지갑을 추가하세요.");
      return;
    }
    if (result.reason === "no-url") {
      setSyncMsg("mempool API URL을 먼저 저장하세요.");
      return;
    }
    const failed = result.walletResults.filter((w) => w.status !== "online").length;
    if (failed === 0) {
      setSyncMsg(`동기화 완료 · ${fmtSats(result.aggregatedSats)}`);
    } else {
      setSyncMsg(`일부 실패 (${failed}개) · 합산 ${fmtSats(result.aggregatedSats)} (마지막 성공값 혼합)`);
    }
  };

  const openAdd = () => {
    setAdding(true);
    setAddMode("xpub");
    setAddLabel(defaultWalletLabel(config.wallets.length));
    setAddXpub("");
    setAddAddresses("");
    setAddPreview([]);
    setAddError(null);
  };

  const closeAdd = () => {
    setAdding(false);
    setAddError(null);
    setAddPreview([]);
  };

  const handleXpubChange = async (value: string) => {
    setAddXpub(value);
    setAddError(null);
    setAddPreview([]);
    const trimmed = value.trim();
    if (trimmed.length < 10) return;
    const v = await validateXpub(trimmed);
    if (!v.ok) {
      setAddError(v.error ?? "유효하지 않은 xpub");
      return;
    }
    try {
      const preview = await previewXpubAddresses(trimmed);
      setAddPreview(preview);
    } catch (error) {
      setAddError(error instanceof Error ? error.message : String(error));
    }
  };

  const handleAddSave = async () => {
    setAddBusy(true);
    setAddError(null);
    try {
      let descriptor: WalletDescriptor;
      if (addMode === "xpub") {
        const v = await validateXpub(addXpub);
        if (!v.ok) {
          setAddError(v.error ?? "유효하지 않은 xpub");
          return;
        }
        descriptor = { kind: "xpub", xpub: addXpub.trim() };
      } else {
        const addresses = addAddresses
          .split(/[\n,]+/)
          .map((a) => a.trim())
          .filter(Boolean);
        if (addresses.length === 0) {
          setAddError("주소를 한 개 이상 입력하세요.");
          return;
        }
        descriptor = { kind: "addresses", addresses };
      }

      if (isDuplicateDescriptor(descriptor, config.wallets)) {
        setAddError("이미 등록된 지갑입니다.");
        return;
      }

      const label = normalizeWalletLabel(addLabel, defaultWalletLabel(config.wallets.length));
      const entry: WalletEntry = {
        id: generateWalletId(),
        label,
        descriptor,
        includeInTotal: true,
        createdAt: new Date().toISOString(),
      };
      const next = { ...config, wallets: [...config.wallets, entry], mempoolApiUrl: urlInput.trim() || config.mempoolApiUrl };
      persist(next);
      closeAdd();

      if (next.enabled && next.mempoolApiUrl) {
        setSyncing(true);
        await syncAllWallets({ force: true });
        setSyncing(false);
        refresh();
      }
    } finally {
      setAddBusy(false);
    }
  };

  const handleDelete = (wallet: WalletEntry) => {
    if (!window.confirm(`"${wallet.label}" 지갑을 삭제할까요?`)) return;
    const next = { ...config, wallets: config.wallets.filter((w) => w.id !== wallet.id) };
    persist(next);
    const nextBalances = loadLastBalances();
    delete nextBalances[wallet.id];
    saveLastBalances(nextBalances);
  };

  const startEdit = (wallet: WalletEntry) => {
    setEditId(wallet.id);
    setEditLabel(wallet.label);
  };

  const saveEdit = () => {
    if (!editId) return;
    const label = normalizeWalletLabel(editLabel, "지갑");
    persist({
      ...config,
      wallets: config.wallets.map((w) => (w.id === editId ? { ...w, label } : w)),
    });
    setEditId(null);
  };

  const toggleInclude = (wallet: WalletEntry) => {
    persist({
      ...config,
      wallets: config.wallets.map((w) =>
        w.id === wallet.id ? { ...w, includeInTotal: !w.includeInTotal } : w
      ),
    });
  };

  const mode = getHeldBtcMode();

  return (
    <div className="ldg-card">
      <div className="ldg-setting-label">지갑 동기화</div>
      <div className="ldg-setting-desc" style={{ marginBottom: 10 }}>
        와치온리 xpub 또는 주소로 온체인 잔고를 읽어 보유 BTC를 맞춥니다. 개인키는 저장하지 않습니다.
        xpub 유출 시 자금 탈취는 불가하지만 거래 내역 프라이버시는 깨질 수 있습니다.
      </div>

      <div className="ldg-setting-row">
        <div>
          <div className="ldg-setting-label">모드</div>
          <div className="ldg-setting-desc">수동 입력 또는 지갑 동기화</div>
        </div>
        <div className="ldg-radio-group">
          <button type="button" className={!config.enabled ? "on" : ""} onClick={() => setMode(false)}>
            수동
          </button>
          <button type="button" className={config.enabled ? "on" : ""} onClick={() => setMode(true)}>
            지갑 동기화
          </button>
        </div>
      </div>

      <div style={{ marginTop: 12 }}>
        <div className="ldg-setting-desc" style={{ marginBottom: 6 }}>
          mempool API URL (자가호스팅 · HTTPS 권장, 예: https://umbrel-xxxx.ts.net/mempool/api)
          <br />
          PWA(HTTPS)에서 http:// 는 mixed content로 차단될 수 있습니다. localhost 예외.
        </div>
        <div className="ldg-wallet-name-form">
          <input
            className="ldg-input"
            type="url"
            value={urlInput}
            onChange={(e) => setUrlInput(e.target.value)}
            placeholder="https://…/api"
            autoComplete="off"
          />
          <div className="ldg-wallet-name-btns">
            <button type="button" className="ldg-submit-btn" onClick={saveUrl}>
              URL 저장
            </button>
            <button type="button" className="ldg-submit-btn secondary" onClick={handleTest} disabled={testing}>
              {testing ? "확인 중…" : "연결 테스트"}
            </button>
          </div>
        </div>
        {connectMsg && (
          <div className={`ldg-backup-status${connectOk ? " ok" : ""}`} style={{ marginTop: 8 }}>
            {connectMsg}
          </div>
        )}
      </div>

      <div style={{ marginTop: 14 }}>
        <div className="ldg-setting-label" style={{ marginBottom: 8 }}>
          등록된 지갑
        </div>
        {config.wallets.length === 0 && (
          <div className="ldg-setting-desc">아직 등록된 지갑이 없습니다.</div>
        )}
        {config.wallets.map((wallet) => {
          const bal = balances[wallet.id];
          if (editId === wallet.id) {
            return (
              <div key={wallet.id} className="ldg-cat-form" style={{ marginBottom: 8 }}>
                <input
                  className="ldg-input"
                  value={editLabel}
                  maxLength={WALLET_LABEL_MAX}
                  onChange={(e) => setEditLabel(e.target.value)}
                />
                <div className="ldg-cat-form-actions">
                  <button type="button" className="ldg-link" onClick={() => setEditId(null)}>
                    취소
                  </button>
                  <button type="button" className="ldg-submit-btn" onClick={saveEdit}>
                    저장
                  </button>
                </div>
              </div>
            );
          }
          return (
            <div key={wallet.id} className="ldg-cat-row">
              <span
                aria-hidden
                style={{
                  width: 10,
                  height: 10,
                  borderRadius: 99,
                  background: statusDotColor(bal?.status ?? "offline"),
                  flexShrink: 0,
                }}
              />
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 13 }}>{wallet.label}</div>
                <div className="ldg-balance-sub">
                  {bal ? fmtSats(config.includeUnconfirmed ? bal.totalSats : bal.confirmedSats) : "—"}
                  {" · "}
                  {formatSyncTime(bal?.fetchedAt ?? null)}
                  {bal && bal.unconfirmedSats > 0 ? ` · ⏳ +${bal.unconfirmedSats.toLocaleString("en-US")}` : ""}
                  {!wallet.includeInTotal ? " · 합산 제외" : ""}
                </div>
              </div>
              <div className="ldg-cat-manage-actions">
                <button
                  type="button"
                  className={`ldg-chip${wallet.includeInTotal ? " active" : ""}`}
                  style={{ padding: "4px 8px", fontSize: 11 }}
                  onClick={() => toggleInclude(wallet)}
                >
                  합산
                </button>
                <button type="button" className="ldg-icon-action" onClick={() => startEdit(wallet)} aria-label="이름 변경">
                  <svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M12 20h9 M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4z" />
                  </svg>
                </button>
                <button type="button" className="ldg-icon-action danger" onClick={() => handleDelete(wallet)} aria-label="삭제">
                  <svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M4 7h16 M9 7V5a2 2 0 0 1 2-2h2a2 2 0 0 1 2 2v2 M6 7l1 13a2 2 0 0 0 2 2h6a2 2 0 0 0 2-2l1-13" />
                  </svg>
                </button>
              </div>
            </div>
          );
        })}
      </div>

      {!adding ? (
        <button type="button" className="ldg-secondary-btn" style={{ marginTop: 12 }} onClick={openAdd}>
          + 지갑 추가
        </button>
      ) : (
        <div className="ldg-cat-form" style={{ marginTop: 12 }}>
          <div className="ldg-field">
            <div className="ldg-label">라벨</div>
            <input className="ldg-input" value={addLabel} maxLength={WALLET_LABEL_MAX} onChange={(e) => setAddLabel(e.target.value)} />
          </div>
          <div className="ldg-chip-group" style={{ marginTop: 10 }}>
            <button type="button" className={`ldg-chip${addMode === "xpub" ? " active" : ""}`} onClick={() => setAddMode("xpub")}>
              xpub
            </button>
            <button
              type="button"
              className={`ldg-chip${addMode === "addresses" ? " active" : ""}`}
              onClick={() => setAddMode("addresses")}
            >
              주소 직접 입력
            </button>
          </div>
          {addMode === "xpub" ? (
            <div className="ldg-field" style={{ marginTop: 10 }}>
              <div className="ldg-label">xpub / ypub / zpub</div>
              <textarea
                className="ldg-textarea"
                value={addXpub}
                onChange={(e) => void handleXpubChange(e.target.value)}
                placeholder="zpub6…"
                rows={3}
              />
              {addPreview.length > 0 && (
                <div className="ldg-setting-desc" style={{ marginTop: 6 }}>
                  미리보기 (receive 0–2): 지갑 앱 주소와 대조하세요.
                  <br />
                  {addPreview.map((a) => (
                    <div key={a} style={{ fontFamily: "var(--ldg-mono)", fontSize: 11 }}>
                      {a}
                    </div>
                  ))}
                </div>
              )}
            </div>
          ) : (
            <div className="ldg-field" style={{ marginTop: 10 }}>
              <div className="ldg-label">주소 목록</div>
              <textarea
                className="ldg-textarea"
                value={addAddresses}
                onChange={(e) => setAddAddresses(e.target.value)}
                placeholder={"bc1q…\nbc1q…"}
                rows={3}
              />
            </div>
          )}
          {addError && <div className="ldg-modal-error" style={{ marginTop: 8 }}>{addError}</div>}
          <div className="ldg-cat-form-actions">
            <button type="button" className="ldg-link" onClick={closeAdd}>
              취소
            </button>
            <button type="button" className="ldg-submit-btn" onClick={() => void handleAddSave()} disabled={addBusy}>
              {addBusy ? "저장 중…" : "저장"}
            </button>
          </div>
        </div>
      )}

      <div className="ldg-setting-row" style={{ marginTop: 12 }}>
        <div>
          <div className="ldg-setting-label">gap limit</div>
          <div className="ldg-setting-desc">연속 미사용 주소 한도 (1–200)</div>
        </div>
        <select
          className="ldg-select"
          style={{ width: 88 }}
          value={config.gapLimit}
          onChange={(e) => persist({ ...config, gapLimit: Number(e.target.value) })}
        >
          {[10, 20, 40, 80, 100, 200].map((n) => (
            <option key={n} value={n}>
              {n}
            </option>
          ))}
        </select>
      </div>

      <div className="ldg-setting-row">
        <div>
          <div className="ldg-setting-label">미확정 잔고 포함</div>
          <div className="ldg-setting-desc">mempool 미확정 UTXO를 합산에 포함</div>
        </div>
        <div className="ldg-radio-group">
          <button
            type="button"
            className={config.includeUnconfirmed ? "on" : ""}
            onClick={() => persist({ ...config, includeUnconfirmed: true })}
          >
            포함
          </button>
          <button
            type="button"
            className={!config.includeUnconfirmed ? "on" : ""}
            onClick={() => persist({ ...config, includeUnconfirmed: false })}
          >
            확정만
          </button>
        </div>
      </div>

      <button
        type="button"
        className="ldg-submit-btn secondary"
        style={{ marginTop: 12 }}
        onClick={() => void handleSyncAll()}
        disabled={syncing || !config.enabled}
      >
        {syncing ? "동기화 중…" : "전체 동기화"}
      </button>
      <div className="ldg-balance-sub" style={{ marginTop: 8 }}>
        {mode === "wallet-sync"
          ? `합산 ${fmtSats(agg.totalSats)} · 지갑 ${agg.walletCount}개 · ${formatSyncTime(agg.lastFetchedAt)}`
          : "수동 모드 — 위 보유 BTC 입력을 사용합니다."}
      </div>
      {syncMsg && (
        <div className="ldg-backup-status ok" style={{ marginTop: 8 }}>
          {syncMsg}
        </div>
      )}
    </div>
  );
}
