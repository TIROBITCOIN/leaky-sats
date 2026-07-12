import { useCallback, useEffect, useRef, useState, type CSSProperties } from "react";
import {
  defaultWalletLabel,
  generateWalletId,
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
import type { ScriptType, WalletDescriptor } from "../../lib/wallet/xpub";
import type { QrWatchPayload } from "../../lib/wallet/qrParse";
import { parseExtendedPublicKeyText } from "../../lib/wallet/qrParse";
import { previewXpubAddresses, syncAllWallets, testMempoolConnection, validateXpub } from "../../lib/walletSync";
import { getHeldBtc, normalizeHeldBtcInput, setHeldBtc } from "../../lib/heldBtc";
import { fmtSats } from "../../lib/format";
import QrScannerModal from "./QrScannerModal";

type SyncOutcomeLike = Awaited<ReturnType<typeof syncAllWallets>>;

function scriptTypeOriginPrefix(scriptType: ScriptType | undefined): string {
  if (scriptType === "native-segwit") return "[84'/0'/0']";
  if (scriptType === "nested-segwit") return "[49'/0'/0']";
  if (scriptType === "legacy") return "[44'/0'/0']";
  return "";
}

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

function formatSyncOutcome(outcome: SyncOutcomeLike): string {
  if (outcome.ok) {
    return `동기화 완료 · ${outcome.aggregatedSats.toLocaleString("en-US")} sats`;
  }
  if (outcome.skipped && outcome.reason === "already-running") return "이미 동기화 중입니다.";
  if (outcome.skipped && outcome.reason === "throttled") return "방금 동기화했습니다.";
  if (outcome.reason === "disabled-or-empty") return "동기화할 지갑이 없습니다.";
  const failed = outcome.walletResults.find((r) => r.error);
  return failed?.error ?? "동기화 실패";
}

const compactBtnStyle: CSSProperties = {
  padding: "10px 12px",
  fontSize: 13,
  minHeight: 42,
};

export default function WalletSyncSettings() {
  const [config, setConfig] = useState<WalletSyncConfig>(() => loadWalletConfig());
  const [urlInput, setUrlInput] = useState(() => loadWalletConfig().mempoolApiUrl);
  const [connectMsg, setConnectMsg] = useState<string | null>(null);
  const [connectOk, setConnectOk] = useState(false);
  const [syncMsg, setSyncMsg] = useState<string | null>(null);
  const [syncing, setSyncing] = useState(false);
  const [testing, setTesting] = useState(false);
  const autoCheckedUrlRef = useRef<string | null>(null);

  const [heldBtcInput, setHeldBtcInput] = useState(() => {
    const v = getHeldBtc();
    return v === 0 ? "" : String(v);
  });
  const [heldBtcSaved, setHeldBtcSaved] = useState(false);

  const [adding, setAdding] = useState(false);
  /** addresses only when QR returns address list (no mode toggle in UI) */
  const [addMode, setAddMode] = useState<"xpub" | "addresses">("xpub");
  const [addLabel, setAddLabel] = useState("");
  const [addXpub, setAddXpub] = useState("");
  const [addScriptType, setAddScriptType] = useState<ScriptType | undefined>(undefined);
  const [addAddresses, setAddAddresses] = useState("");
  const [addPreview, setAddPreview] = useState<string[]>([]);
  const [addError, setAddError] = useState<string | null>(null);
  const [addBusy, setAddBusy] = useState(false);

  const [editId, setEditId] = useState<string | null>(null);
  const [editLabel, setEditLabel] = useState("");
  const [qrOpen, setQrOpen] = useState(false);

  const balances = loadLastBalances();

  const refresh = useCallback(() => {
    setConfig(loadWalletConfig());
    if (getHeldBtcMode() === "wallet-sync") {
      const v = getHeldBtc();
      setHeldBtcInput(v === 0 ? "" : String(v));
    }
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const persist = (next: WalletSyncConfig) => {
    saveWalletConfig(next);
    setConfig(next);
  };

  const runSyncNow = useCallback(async () => {
    setSyncing(true);
    try {
      const outcome = await syncAllWallets({ force: true });
      setSyncMsg(formatSyncOutcome(outcome));
    } finally {
      setSyncing(false);
      refresh();
    }
  }, [refresh]);

  useEffect(() => {
    const url = config.mempoolApiUrl.trim();
    if (!config.enabled || autoCheckedUrlRef.current === url) return;
    let cancelled = false;
    autoCheckedUrlRef.current = url;

    setConnectOk(false);
    setConnectMsg("연결 확인 중…");
    void (async () => {
      const result = await testMempoolConnection(url);
      if (cancelled) return;
      if (result.ok) {
        setConnectOk(true);
        setConnectMsg(`연결 성공 · ${result.apiName} · 블록 높이 ${result.height?.toLocaleString("en-US")}`);
        if (config.wallets.length > 0) {
          await runSyncNow();
        }
      } else {
        setConnectOk(false);
        setConnectMsg(result.error ?? "연결 실패");
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [config.enabled, config.mempoolApiUrl, config.wallets.length, runSyncNow]);

  const setMode = (enabled: boolean) => {
    const next = {
      ...config,
      enabled,
      mempoolApiUrl: urlInput.trim() || config.mempoolApiUrl,
    };
    persist(next);
    setSyncMsg(null);
    const v = getHeldBtc();
    setHeldBtcInput(v === 0 ? "" : String(v));
    if (enabled && next.wallets.length > 0) {
      void runSyncNow();
    }
  };

  const saveUrl = async () => {
    const next = {
      ...config,
      enabled: config.enabled || config.wallets.length > 0,
      mempoolApiUrl: urlInput.trim(),
    };
    persist(next);
    setConnectMsg(null);
    if (next.enabled && next.wallets.length > 0) {
      await runSyncNow();
    }
  };

  const handleTest = async () => {
    setTesting(true);
    setConnectMsg(null);
    const result = await testMempoolConnection(urlInput);
    setTesting(false);
    if (result.ok) {
      setConnectOk(true);
      setConnectMsg(`연결 성공 · ${result.apiName} · 블록 높이 ${result.height?.toLocaleString("en-US")}`);
      const next = {
        ...config,
        enabled: config.enabled || config.wallets.length > 0,
        mempoolApiUrl: urlInput.trim(),
      };
      autoCheckedUrlRef.current = next.mempoolApiUrl;
      persist(next);
      if (next.enabled && next.wallets.length > 0) {
        await runSyncNow();
      }
    } else {
      setConnectOk(false);
      setConnectMsg(result.error ?? "연결 실패");
    }
  };

  const openAdd = () => {
    setAdding(true);
    setAddMode("xpub");
    setAddLabel(defaultWalletLabel(config.wallets.length));
    setAddXpub("");
    setAddScriptType(undefined);
    setAddAddresses("");
    setAddPreview([]);
    setAddError(null);
  };

  const closeAdd = () => {
    setAdding(false);
    setAddError(null);
    setAddPreview([]);
    setAddAddresses("");
    setAddScriptType(undefined);
    setAddMode("xpub");
    setQrOpen(false);
  };

  const handleXpubChange = async (value: string) => {
    setAddMode("xpub");
    setAddAddresses("");
    setAddXpub(value);
    setAddScriptType(undefined);
    setAddError(null);
    setAddPreview([]);
    const trimmed = value.trim();
    if (trimmed.length < 10) return;
    const parsed = parseExtendedPublicKeyText(trimmed);
    const xpub = parsed?.xpub ?? trimmed;
    setAddScriptType(parsed?.scriptType);
    const v = await validateXpub(xpub, parsed?.scriptType);
    if (!v.ok) {
      setAddError(v.error ?? "유효하지 않은 xpub");
      return;
    }
    try {
      const preview = await previewXpubAddresses(xpub, parsed?.scriptType);
      setAddPreview(preview);
    } catch (error) {
      setAddError(error instanceof Error ? error.message : String(error));
    }
  };

  const handleQrScan = (payload: QrWatchPayload) => {
    setAddError(null);
    if (payload.kind === "xpub") {
      setAddScriptType(payload.scriptType);
      void handleXpubChange(`${scriptTypeOriginPrefix(payload.scriptType)}${payload.xpub}`);
      return;
    }
    setAddMode("addresses");
    setAddXpub("");
    setAddScriptType(undefined);
    setAddPreview([]);
    setAddAddresses(payload.addresses.join("\n"));
  };

  const handleAddSave = async () => {
    setAddBusy(true);
    setAddError(null);
    try {
      let descriptor: WalletDescriptor;
      if (addMode === "xpub") {
        const parsed = parseExtendedPublicKeyText(addXpub);
        const xpub = parsed?.xpub ?? addXpub.trim();
        const scriptType = parsed?.scriptType ?? addScriptType;
        const v = await validateXpub(xpub, scriptType);
        if (!v.ok) {
          setAddError(v.error ?? "유효하지 않은 xpub");
          return;
        }
        descriptor = { kind: "xpub", xpub, ...(scriptType ? { scriptType } : {}) };
      } else {
        const addresses = addAddresses
          .split(/[\n,]+/)
          .map((a) => a.trim())
          .filter(Boolean);
        if (addresses.length === 0) {
          setAddError("공개키를 입력하거나 QR로 불러오세요.");
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
      const next = {
        ...config,
        enabled: config.enabled || Boolean(urlInput.trim() || config.mempoolApiUrl),
        wallets: [...config.wallets, entry],
        mempoolApiUrl: urlInput.trim() || config.mempoolApiUrl,
      };
      persist(next);
      closeAdd();

      if (next.enabled) {
        await runSyncNow();
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

  const saveHeldBtc = () => {
    const val = normalizeHeldBtcInput(heldBtcInput);
    const saved = setHeldBtc(val);
    setHeldBtcInput(saved === 0 ? "" : String(saved));
    setHeldBtcSaved(true);
    setTimeout(() => setHeldBtcSaved(false), 2000);
  };

  const resetHeldBtc = () => {
    setHeldBtc(0);
    setHeldBtcInput("");
    setHeldBtcSaved(true);
    setTimeout(() => setHeldBtcSaved(false), 2000);
  };

  const syncMode = config.enabled;

  return (
    <div className="ldg-card">
      <div className="ldg-setting-label">지갑 동기화</div>

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

      {!syncMode ? (
        <>
          <div className="ldg-field" style={{ marginTop: 12 }}>
            <div className="ldg-label">보유 BTC</div>
            <div className="ldg-wallet-name-form">
              <input
                type="text"
                inputMode="decimal"
                className="ldg-input"
                value={heldBtcInput}
                onChange={(e) => {
                  const v = e.target.value;
                  if (v === "" || /^\d*\.?\d{0,8}$/.test(v)) {
                    setHeldBtcInput(v);
                    setHeldBtcSaved(false);
                  }
                }}
                placeholder="0.00000000"
              />
              <div className="ldg-wallet-name-btns">
                <button type="button" className="ldg-submit-btn" style={compactBtnStyle} onClick={saveHeldBtc}>
                  저장
                </button>
                <button type="button" className="ldg-submit-btn secondary" style={compactBtnStyle} onClick={resetHeldBtc}>
                  초기화
                </button>
              </div>
            </div>
          </div>
          {heldBtcSaved && (
            <div className="ldg-backup-status ok" style={{ marginTop: 8 }}>
              저장되었습니다.
            </div>
          )}
        </>
      ) : (
        <>
          <div style={{ marginTop: 12 }}>
            <div className="ldg-label" style={{ marginBottom: 6 }}>
              고급: self-hosted mempool API URL (선택)
            </div>
            <div className="ldg-wallet-name-form">
              <input
                className="ldg-input"
                type="url"
                value={urlInput}
                onChange={(e) => setUrlInput(e.target.value)}
                placeholder="비워두면 공개 API 자동 사용 (mempool.space → blockstream)"
                autoComplete="off"
              />
              <div className="ldg-wallet-name-btns">
                <button type="button" className="ldg-submit-btn" style={compactBtnStyle} onClick={() => void saveUrl()}>
                  URL 저장
                </button>
                <button
                  type="button"
                  className="ldg-submit-btn secondary"
                  style={compactBtnStyle}
                  onClick={() => void handleTest()}
                  disabled={testing}
                >
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
                    <div className="ldg-wallet-name-btns" style={{ marginTop: 10 }}>
                      <button
                        type="button"
                        className="ldg-submit-btn secondary"
                        style={compactBtnStyle}
                        onClick={() => setEditId(null)}
                      >
                        취소
                      </button>
                      <button type="button" className="ldg-submit-btn" style={compactBtnStyle} onClick={saveEdit}>
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
                      {bal ? fmtSats(bal.totalSats) : "—"}
                      {" · "}
                      {formatSyncTime(bal?.fetchedAt ?? null)}
                    </div>
                  </div>
                  <div className="ldg-cat-manage-actions">
                    <div className="ldg-radio-group" style={{ flexShrink: 0 }}>
                      <button
                        type="button"
                        className={wallet.includeInTotal ? "on" : ""}
                        onClick={() => {
                          if (!wallet.includeInTotal) toggleInclude(wallet);
                        }}
                        style={{ padding: "4px 8px", fontSize: 11 }}
                      >
                        켜기
                      </button>
                      <button
                        type="button"
                        className={!wallet.includeInTotal ? "on" : ""}
                        onClick={() => {
                          if (wallet.includeInTotal) toggleInclude(wallet);
                        }}
                        style={{ padding: "4px 8px", fontSize: 11 }}
                      >
                        끄기
                      </button>
                    </div>
                    <button
                      type="button"
                      className="ldg-icon-action"
                      onClick={() => startEdit(wallet)}
                      aria-label="이름 변경"
                    >
                      <svg
                        viewBox="0 0 24 24"
                        width="15"
                        height="15"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="1.8"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      >
                        <path d="M12 20h9 M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4z" />
                      </svg>
                    </button>
                    <button
                      type="button"
                      className="ldg-icon-action danger"
                      onClick={() => handleDelete(wallet)}
                      aria-label="삭제"
                    >
                      <svg
                        viewBox="0 0 24 24"
                        width="15"
                        height="15"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="1.8"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      >
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
                <input
                  className="ldg-input"
                  value={addLabel}
                  maxLength={WALLET_LABEL_MAX}
                  onChange={(e) => setAddLabel(e.target.value)}
                />
              </div>
              <div className="ldg-field" style={{ marginTop: 10 }}>
                <div className="ldg-label">
                  {addMode === "addresses" ? "주소 (QR로 불러옴)" : "공개키 (xpub / ypub / zpub)"}
                </div>
                {addMode === "xpub" ? (
                  <textarea
                    className="ldg-textarea"
                    value={addXpub}
                    onChange={(e) => void handleXpubChange(e.target.value)}
                    placeholder="붙여넣기 또는 아래 QR 스캔"
                    rows={3}
                  />
                ) : (
                  <textarea
                    className="ldg-textarea"
                    value={addAddresses}
                    onChange={(e) => setAddAddresses(e.target.value)}
                    placeholder={"bc1q…"}
                    rows={3}
                  />
                )}
                <button
                  type="button"
                  className="ldg-submit-btn secondary ldg-qr-scan-btn"
                  style={compactBtnStyle}
                  onClick={() => setQrOpen(true)}
                >
                  카메라로 QR 스캔
                </button>
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
              {addError && (
                <div className="ldg-modal-error" style={{ marginTop: 8 }}>
                  {addError}
                </div>
              )}
              <div className="ldg-wallet-name-btns" style={{ marginTop: 12 }}>
                <button type="button" className="ldg-submit-btn secondary" style={compactBtnStyle} onClick={closeAdd}>
                  취소
                </button>
                <button
                  type="button"
                  className="ldg-submit-btn"
                  style={compactBtnStyle}
                  onClick={() => void handleAddSave()}
                  disabled={addBusy}
                >
                  {addBusy ? "저장 중…" : "저장"}
                </button>
              </div>
            </div>
          )}

          {syncing && (
            <div className="ldg-balance-sub" style={{ marginTop: 10 }}>
              동기화 중…
            </div>
          )}
          {syncMsg && (
            <div className="ldg-backup-status ok" style={{ marginTop: 8 }}>
              {syncMsg}
            </div>
          )}
        </>
      )}

      <QrScannerModal open={qrOpen} onClose={() => setQrOpen(false)} onScan={handleQrScan} />
    </div>
  );
}
