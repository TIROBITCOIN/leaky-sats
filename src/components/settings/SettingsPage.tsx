import { useState } from "react";
import "../../styles/ledger.css";
import "../../styles/forms.css";
import { useLedger } from "../../state/LedgerContext";
import { formatUpdatedAt, getPriceTone } from "../../lib/priceStatus";
import { loadWalletName, saveWalletName, DEFAULT_NAME, MAX_LENGTH } from "../../lib/walletName";
import { loadBtcUnit, saveBtcUnit, type BtcUnit } from "../../lib/format";
import { getHeldBtc, setHeldBtc, normalizeHeldBtcInput } from "../../lib/heldBtc";
import AppLockSettings from "../security/AppLockSettings";
import CategoryManager from "./CategoryManager";
import BackupRestoreCard from "./BackupRestoreCard";

const UNITS = ["BTC", "sats"] as const;
const SOURCES = ["Upbit", "Binance"] as const;
const INTERVALS: { label: string; ms: number }[] = [
  { label: "30초", ms: 30_000 },
  { label: "1분", ms: 60_000 },
  { label: "5분", ms: 300_000 },
];

export default function SettingsPage() {
  const {
    currency,
    setCurrency,
    refreshIntervalMs,
    setRefreshIntervalMs,
    priceStatus,
    priceError,
    priceUpdatedAt,
    isPriceFallback,
    refreshPrices,
  } = useLedger();
  const [unit, setUnit] = useState<BtcUnit>(loadBtcUnit);
  const [source, setSource] = useState<(typeof SOURCES)[number]>("Upbit");
  const [walletNameInput, setWalletNameInput] = useState(loadWalletName);
  const [walletNameSaved, setWalletNameSaved] = useState(false);
  const [heldBtcInput, setHeldBtcInput] = useState(() => {
    const v = getHeldBtc();
    return v === 0 ? "" : String(v);
  });
  const [heldBtcSaved, setHeldBtcSaved] = useState(false);

  const priceTone = getPriceTone(priceStatus, isPriceFallback);
  const updatedAtText = formatUpdatedAt(priceUpdatedAt);
  const statusText =
    priceTone === "loading"
      ? "시세를 불러오는 중..."
      : priceTone === "offline"
      ? "시세 연동 실패, 더미 시세 사용 중"
      : priceTone === "stale"
      ? `일부 시세 갱신 실패, ${updatedAtText} 값 유지 중`
      : `마지막 갱신 ${updatedAtText}`;

  return (
    <div className="ldg-screen">
      <div className="ldg-content">
        <div className="ldg-page-title">설정</div>
        <div className="ldg-page-sub">표시 방식, 시세, 카테고리, 백업, 로컬 잠금을 관리합니다.</div>

        <div className="ldg-card">
          <div className="ldg-setting-row">
            <div>
              <div className="ldg-setting-label">기본 통화</div>
              <div className="ldg-setting-desc">홈 화면 기본 표시 통화</div>
            </div>
            <div className="ldg-radio-group">
              <button type="button" className={currency === "KRW" ? "on" : ""} onClick={() => setCurrency("KRW")}>
                KRW
              </button>
              <button type="button" className={currency === "BTC" ? "on" : ""} onClick={() => setCurrency("BTC")}>
                Bitcoin
              </button>
            </div>
          </div>
          <div className="ldg-setting-row">
            <div>
              <div className="ldg-setting-label">표시 단위</div>
              <div className="ldg-setting-desc">금액 환산 시 BTC/sats 단위</div>
            </div>
            <div className="ldg-radio-group">
              {UNITS.map((u) => (
                <button type="button" key={u} className={unit === u ? "on" : ""} onClick={() => { setUnit(u); saveBtcUnit(u); }}>
                  {u}
                </button>
              ))}
            </div>
          </div>
        </div>

        <div className="ldg-card">
          <div className="ldg-setting-row">
            <div>
              <div className="ldg-setting-label">시세 소스</div>
              <div className="ldg-setting-desc">현재 시세 재평가 기준</div>
            </div>
            <div className="ldg-radio-group">
              {SOURCES.map((s) => (
                <button type="button" key={s} className={source === s ? "on" : ""} onClick={() => setSource(s)}>
                  {s}
                </button>
              ))}
            </div>
          </div>
          <div className="ldg-setting-row">
            <div>
              <div className="ldg-setting-label">새로고침 주기</div>
              <div className="ldg-setting-desc">시세 자동 갱신 간격</div>
            </div>
            <div className="ldg-radio-group">
              {INTERVALS.map((i) => (
                <button
                  type="button"
                  key={i.label}
                  className={refreshIntervalMs === i.ms ? "on" : ""}
                  onClick={() => setRefreshIntervalMs(i.ms)}
                >
                  {i.label}
                </button>
              ))}
            </div>
          </div>
          <div className="ldg-setting-row">
            <div>
              <div className="ldg-setting-label">시세 상태</div>
              <div className="ldg-setting-desc">
                {statusText}
                {priceError ? ` (${priceError})` : ""}
              </div>
            </div>
            <button type="button" className="ldg-link" onClick={refreshPrices}>
              지금 갱신
            </button>
          </div>
          <div className="ldg-setting-row">
            <div>
              <div className="ldg-setting-label">테마</div>
              <div className="ldg-setting-desc">다크 모드 고정</div>
            </div>
            <div className="ldg-radio-group">
              <button type="button" className="on">
                Dark
              </button>
            </div>
          </div>
        </div>

        <div className="ldg-card">
          <div className="ldg-setting-label">지갑 이름</div>
          <div className="ldg-setting-desc" style={{ marginBottom: 10 }}>홈 화면 제목에 표시됩니다.</div>
          <div className="ldg-wallet-name-form">
            <input
              type="text"
              className="ldg-input"
              value={walletNameInput}
              maxLength={MAX_LENGTH}
              onChange={(e) => {
                setWalletNameInput(e.target.value);
                setWalletNameSaved(false);
              }}
              placeholder={DEFAULT_NAME}
            />
            <div className="ldg-wallet-name-btns">
              <button
                type="button"
                className="ldg-submit-btn"
                onClick={() => {
                  const saved = saveWalletName(walletNameInput);
                  setWalletNameInput(saved);
                  document.title = saved;
                  setWalletNameSaved(true);
                  setTimeout(() => setWalletNameSaved(false), 2000);
                }}
              >
                저장
              </button>
              <button
                type="button"
                className="ldg-submit-btn secondary"
                onClick={() => {
                  const saved = saveWalletName(DEFAULT_NAME);
                  setWalletNameInput(saved);
                  document.title = saved;
                  setWalletNameSaved(true);
                  setTimeout(() => setWalletNameSaved(false), 2000);
                }}
              >
                초기화
              </button>
            </div>
          </div>
          {walletNameSaved && (
            <div className="ldg-backup-status ok" style={{ marginTop: 8 }}>저장되었습니다.</div>
          )}
        </div>

        <div className="ldg-card">
          <div className="ldg-setting-label">보유 BTC</div>
          <div className="ldg-setting-desc" style={{ marginBottom: 10 }}>
            BTC 보유량은 메인 화면과 팔아야 할 BTC 계산에 사용됩니다.
          </div>
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
              <button
                type="button"
                className="ldg-submit-btn"
                onClick={() => {
                  const val = normalizeHeldBtcInput(heldBtcInput);
                  const saved = setHeldBtc(val);
                  setHeldBtcInput(saved === 0 ? "" : String(saved));
                  setHeldBtcSaved(true);
                  setTimeout(() => setHeldBtcSaved(false), 2000);
                }}
              >
                저장
              </button>
              <button
                type="button"
                className="ldg-submit-btn secondary"
                onClick={() => {
                  setHeldBtc(0);
                  setHeldBtcInput("");
                  setHeldBtcSaved(true);
                  setTimeout(() => setHeldBtcSaved(false), 2000);
                }}
              >
                초기화
              </button>
            </div>
          </div>
          {heldBtcSaved && (
            <div className="ldg-backup-status ok" style={{ marginTop: 8 }}>저장되었습니다.</div>
          )}
        </div>

        <CategoryManager />
        <BackupRestoreCard />
        <AppLockSettings />
      </div>
    </div>
  );
}
