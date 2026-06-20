import { useState } from "react";
import "../../styles/ledger.css";
import "../../styles/forms.css";
import { useLedger } from "../../state/LedgerContext";
import { formatUpdatedAt, getPriceTone } from "../../lib/priceStatus";
import AppLockSettings from "../security/AppLockSettings";
import CategoryManager from "./CategoryManager";

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
    data,
    refreshIntervalMs,
    setRefreshIntervalMs,
    priceStatus,
    priceError,
    priceUpdatedAt,
    isPriceFallback,
    refreshPrices,
  } = useLedger();
  const [unit, setUnit] = useState<(typeof UNITS)[number]>("BTC");
  const [source, setSource] = useState<(typeof SOURCES)[number]>("Upbit");

  const priceTone = getPriceTone(priceStatus, isPriceFallback);
  const updatedAtText = formatUpdatedAt(priceUpdatedAt);
  const statusText =
    priceTone === "loading"
      ? "시세를 불러오는 중..."
      : priceTone === "offline"
      ? "시세 연동 실패 후 이전 시세를 사용 중"
      : priceTone === "stale"
      ? `일부 시세 갱신 실패. ${updatedAtText} 값 사용 중`
      : `마지막 갱신 ${updatedAtText}`;

  const handleExport = () => {
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "my-ledger-backup.json";
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="ldg-screen">
      <div className="ldg-content">
        <div className="ldg-page-title">설정</div>
        <div className="ldg-page-sub">표시 방식, 시세, 카테고리, 로컬 잠금을 관리합니다.</div>

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
                <button key={u} type="button" className={unit === u ? "on" : ""} onClick={() => setUnit(u)}>
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
              <div className="ldg-setting-desc">현재 시세 평가 기준</div>
            </div>
            <div className="ldg-radio-group">
              {SOURCES.map((s) => (
                <button key={s} type="button" className={source === s ? "on" : ""} onClick={() => setSource(s)}>
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
                  key={i.label}
                  type="button"
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
            <button className="ldg-link" type="button" onClick={refreshPrices}>
              지금 갱신
            </button>
          </div>
          <div className="ldg-setting-row">
            <div>
              <div className="ldg-setting-label">테마</div>
              <div className="ldg-setting-desc">다크 모드 고정</div>
            </div>
            <div className="ldg-radio-group">
              <button className="on" type="button">
                Dark
              </button>
            </div>
          </div>
        </div>

        <CategoryManager />
        <AppLockSettings />

        <div className="ldg-card">
          <div className="ldg-label" style={{ marginBottom: 10 }}>
            데이터 내보내기
          </div>
          <div className="ldg-setting-desc" style={{ marginBottom: 12 }}>
            현재 브라우저의 가계부 데이터를 JSON 파일로 내려받습니다. PIN과 앱 잠금 설정은 포함하지
            않습니다.
          </div>
          <button className="ldg-submit-btn" type="button" onClick={handleExport}>
            JSON으로 내보내기
          </button>
        </div>
      </div>
    </div>
  );
}
