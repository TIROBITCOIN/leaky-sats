import { useState, useMemo } from "react";
import { Link } from "react-router-dom";
import "../../styles/ledger.css";
import "../../styles/forms.css";
import { useLedger } from "../../state/LedgerContext";
import {
  formatPriceSourceDelayDetail,
  formatStalePriceStatus,
  formatUpdatedAt,
  getPriceTone,
} from "../../lib/priceStatus";
import { loadWalletName, saveWalletName, DEFAULT_NAME, MAX_LENGTH } from "../../lib/walletName";
import { loadBtcUnit, saveBtcUnit, type BtcUnit } from "../../lib/format";
import { loadSettlementDay, saveSettlementDay, getSettlementPeriod } from "../../lib/settlement";
import { getCurrentMonthKey } from "../../lib/month";
import { isCanonicalCategory } from "../../lib/categories";
import AppLockSettings from "../security/AppLockSettings";
import CategoryManager from "./CategoryManager";
import BackupRestoreCard from "./BackupRestoreCard";
import RecurringRulesSettings from "./RecurringRulesSettings";
import WalletSyncSettings from "./WalletSyncSettings";
import { APP_META } from "../../constants/appMeta";

const UNITS = ["BTC", "sats"] as const;
const SETTLEMENT_DAYS = Array.from({ length: 31 }, (_, i) => i + 1);

export default function SettingsPage() {
  const {
    currency,
    setCurrency,
    priceStatus,
    priceError,
    priceUpdatedAt,
    isPriceFallback,
    isPriceStale,
    priceStaleSources,
    priceSourceUpdatedAt,
    priceSourceMeta,
    refreshPrices,
    categories,
    migrateLegacyCategories,
  } = useLedger();
  const [unit, setUnit] = useState<BtcUnit>(loadBtcUnit);
  const [walletNameInput, setWalletNameInput] = useState(loadWalletName);
  const [walletNameSaved, setWalletNameSaved] = useState(false);
  const [settlementDay, setSettlementDay] = useState(loadSettlementDay);
  const [migrateDone, setMigrateDone] = useState(false);

  const legacyCount = useMemo(
    () => categories.filter((c) => !isCanonicalCategory(c.id) && !c.protected).length,
    [categories],
  );

  const currentMonthKey = getCurrentMonthKey();
  const currentPeriod = getSettlementPeriod(currentMonthKey, settlementDay);

  const priceTone = getPriceTone(priceStatus, isPriceFallback, isPriceStale);
  const updatedAtText = formatUpdatedAt(priceUpdatedAt);
  const staleStatusText = formatStalePriceStatus(priceStaleSources, priceSourceUpdatedAt);
  const delayDetailText = formatPriceSourceDelayDetail(priceStaleSources, priceSourceUpdatedAt);
  const statusText =
    priceTone === "loading"
      ? "시세를 불러오는 중..."
      : priceTone === "offline"
      ? "시세 연동 실패, 더미 시세 사용 중"
      : priceTone === "stale"
      ? staleStatusText
      : `마지막 갱신 ${updatedAtText}`;

  return (
    <div className="ldg-screen">
      <div className="ldg-content">
        <div className="ldg-page-title">설정</div>

        <div className="ldg-card">
          <div className="ldg-setting-row">
            <div>
              <div className="ldg-setting-label">도움말 / 사용법</div>
              <div className="ldg-setting-desc">앱 사용법을 간단히 정리했습니다.</div>
            </div>
            <Link className="ldg-link" to="/help">
              열기
            </Link>
          </div>
        </div>

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
              <div className="ldg-setting-label">시세 상태</div>
              <div className="ldg-setting-desc">
                {statusText}
                {priceError && priceTone !== "stale" ? ` (${priceError})` : ""}
                {priceSourceMeta.usdKrw === "Frankfurter" && priceSourceMeta.fxReferenceDate
                  ? ` · 환율 기준일 ${priceSourceMeta.fxReferenceDate}`
                  : priceSourceMeta.usdKrw
                  ? ` · 환율 ${priceSourceMeta.usdKrw}`
                  : ""}
                {delayDetailText ? (
                  <>
                    <br />
                    {delayDetailText}
                  </>
                ) : null}
              </div>
            </div>
            <button type="button" className="ldg-link" onClick={refreshPrices}>
              지금 갱신
            </button>
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

        <WalletSyncSettings />

        <div className="ldg-card">
          <div className="ldg-setting-label">정산 기준일</div>
          <div className="ldg-setting-desc" style={{ marginBottom: 10 }}>
            매월 선택한 날짜부터 다음 달 전날까지를 한 정산기간으로 계산합니다.
          </div>
          <select
            className="ldg-select"
            value={settlementDay}
            onChange={(e) => {
              const day = saveSettlementDay(Number(e.target.value));
              setSettlementDay(day);
            }}
          >
            {SETTLEMENT_DAYS.map((d) => (
              <option key={d} value={d}>
                {d}일
              </option>
            ))}
          </select>
          <div className="ldg-balance-sub" style={{ marginTop: 8 }}>
            현재 정산기간: {currentPeriod.rangeLabel}
          </div>
        </div>

        {legacyCount > 0 && (
          <div className="ldg-card">
            <div className="ldg-setting-label">세분화 카테고리 정리</div>
            <div className="ldg-setting-desc" style={{ marginBottom: 10 }}>
              현재 큰 카테고리에 포함되지 않는 세분화/레거시 카테고리가 {legacyCount}개 있습니다.
              해당 카테고리에 묶인 거래를 그룹의 "기타" 카테고리로 재배정하고, 사용되지 않는 레거시
              카테고리를 제거합니다. 거래 금액은 변하지 않습니다.
            </div>
            <button
              type="button"
              className="ldg-submit-btn"
              onClick={() => {
                if (window.confirm(`세분화 카테고리 ${legacyCount}개를 정리하시겠습니까? 해당 거래는 기타 카테고리로 재배정됩니다.`)) {
                  migrateLegacyCategories();
                  setMigrateDone(true);
                  setTimeout(() => setMigrateDone(false), 3000);
                }
              }}
            >
              정리하기
            </button>
            {migrateDone && (
              <div className="ldg-backup-status ok" style={{ marginTop: 8 }}>정리 완료</div>
            )}
          </div>
        )}

        <RecurringRulesSettings />
        <CategoryManager />
        <BackupRestoreCard />
        <AppLockSettings />

        <div className="ldg-card">
          <div className="ldg-setting-label">앱 정보</div>
          <div className="ldg-setting-desc" style={{ marginTop: 6, lineHeight: 1.7 }}>
            {APP_META.name}<br />
            제작자: {APP_META.ownerName}<br />
            원본 저장소:{" "}
            <a href={APP_META.repositoryUrl} target="_blank" rel="noopener noreferrer" className="ldg-link">
              {APP_META.repositoryUrl}
            </a><br />
            공식 배포:{" "}
            <a href={APP_META.productionUrl} target="_blank" rel="noopener noreferrer" className="ldg-link">
              {APP_META.productionUrl}
            </a><br />
            {APP_META.copyright}
          </div>
        </div>
      </div>
    </div>
  );
}
