import { useEffect, useMemo, useRef, useState } from "react";
import type { SellResult } from "../../lib/sellCalculator";
import {
  formatBtcInput,
  formatKrwInput,
  fmtBtcValue,
  parseBtcInput,
  parseKrwInput,
  type BtcUnit,
} from "../../lib/format";
import {
  addBtcSellRecord,
  calculateEffectiveSellPriceKrw,
  updateBtcSellRecord,
  type BtcSellRecord,
} from "../../lib/btcSellRecords";
import { getHeldBtc, setHeldBtc } from "../../lib/heldBtc";
import type { SettlementPeriod } from "../../lib/settlement";
import { setSellSaveInProgress } from "../../lib/sellSaveInProgress";

const MAX_BTC = 21_000_000;
const SATS_PER_BTC = 100_000_000;

interface Props {
  result: SellResult;
  btcKrw: number;
  unit: BtcUnit;
  selectedMonth: string;
  period: SettlementPeriod;
  editRecord?: BtcSellRecord;
  onClose: () => void;
  onSaved: () => void;
}

function formatSats(value: number): string {
  return `${Math.round(value).toLocaleString("en-US")} sats`;
}

function initialBtcSpent(editRecord: BtcSellRecord | undefined, deficitKrw: number, marketBtcKrw: number): string {
  if (editRecord) {
    const spent = editRecord.btcSpentFromWallet ?? editRecord.btcSold;
    return spent > 0 ? formatBtcInput(spent) : "";
  }
  if (marketBtcKrw > 0 && deficitKrw > 0) {
    return formatBtcInput(deficitKrw / marketBtcKrw);
  }
  return "";
}

export default function SellConfirmModal({
  result,
  btcKrw,
  unit,
  selectedMonth,
  editRecord,
  onClose,
  onSaved,
}: Props) {
  const isEdit = !!editRecord;
  const currentBtcKrw = Number.isFinite(btcKrw) && btcKrw > 0 ? btcKrw : 0;

  // v2 실측 입력: 받은 원화 + 보낸 비트코인 (수수료 UI는 Phase 1.5에서 제거, 스키마 필드는 유지)
  const initialKrw = editRecord
    ? editRecord.krwReceived ?? editRecord.krwCovered
    : result.deficitKrw;
  const [krwInput, setKrwInput] = useState(
    initialKrw > 0 ? formatKrwInput(Math.round(initialKrw)) : ""
  );
  const [btcInput, setBtcInput] = useState(() =>
    initialBtcSpent(editRecord, result.deficitKrw, currentBtcKrw)
  );
  const [error, setError] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const savingRef = useRef(false);

  const krwReceived = parseKrwInput(krwInput);
  const btcSpentFromWallet = parseBtcInput(btcInput);
  // networkFeeSats 입력 UI 제거 — 저장 시 undefined (스키마 필드는 향후용으로 유지)
  const networkFeeSats = 0;
  const satsSold = Math.round(btcSpentFromWallet * SATS_PER_BTC);

  const previouslyDeductedBtc = editRecord?.deductedFromHeldBtc
    ? editRecord.deductedBtcAmount ?? editRecord.btcSold
    : 0;
  const currentHeldBtc = getHeldBtc();
  const availableHeldBtc = currentHeldBtc + previouslyDeductedBtc;
  const overHeld = useMemo(
    () => Number.isFinite(btcSpentFromWallet) && btcSpentFromWallet > availableHeldBtc,
    [btcSpentFromWallet, availableHeldBtc]
  );

  useEffect(() => {
    return () => {
      if (savingRef.current) {
        savingRef.current = false;
        setSellSaveInProgress(false);
      }
    };
  }, []);

  const releaseSaving = () => {
    savingRef.current = false;
    setIsSaving(false);
    setSellSaveInProgress(false);
  };

  const handleSave = () => {
    if (savingRef.current) return;

    savingRef.current = true;
    setIsSaving(true);
    setSellSaveInProgress(true);
    setError("");

    try {
      if (!Number.isFinite(krwReceived) || krwReceived <= 0) {
        setError("받은 원화를 입력하세요.");
        return;
      }
      if (!Number.isFinite(btcSpentFromWallet) || btcSpentFromWallet <= 0) {
        setError("보낸 비트코인을 입력하세요.");
        return;
      }
      if (btcSpentFromWallet > MAX_BTC) {
        setError("값이 너무 큽니다.");
        return;
      }
      if (networkFeeSats < 0 || !Number.isFinite(networkFeeSats)) {
        setError("수수료 값이 올바르지 않습니다.");
        return;
      }
      const feeBtc = networkFeeSats / SATS_PER_BTC;
      if (feeBtc >= btcSpentFromWallet) {
        setError("수수료가 보낸 비트코인보다 크거나 같습니다.");
        return;
      }
      const effective = calculateEffectiveSellPriceKrw(krwReceived, btcSpentFromWallet, networkFeeSats);
      if (effective === null || !(effective > 0)) {
        setError("매도 단가를 계산할 수 없습니다.");
        return;
      }

      const heldBtcAtSave = getHeldBtc();
      const availableHeldBtcAtSave = heldBtcAtSave + previouslyDeductedBtc;
      if (btcSpentFromWallet > availableHeldBtcAtSave) {
        setError("보유 BTC보다 많이 판매할 수 없습니다.");
        return;
      }

      const sellPayload = {
        btcSold: btcSpentFromWallet,
        satsSold,
        btcKrwAtSell: effective,
        krwCovered: krwReceived,
        deficitKrwAtConfirm: result.deficitKrw,
        deductedFromHeldBtc: true,
        deductedBtcAmount: btcSpentFromWallet,
        schemaVersion: 2 as const,
        btcSpentFromWallet,
        krwReceived,
        marketBtcKrwAtSell: currentBtcKrw > 0 ? currentBtcKrw : undefined,
        networkFeeSats: undefined,
      };

      if (editRecord) {
        const delta = btcSpentFromWallet - previouslyDeductedBtc;
        const savedRecord = updateBtcSellRecord(editRecord.id, sellPayload);
        if (!savedRecord) {
          setError("판매 기록을 저장하지 못했습니다. 다시 시도하세요.");
          return;
        }
        if (delta !== 0) {
          const current = getHeldBtc();
          setHeldBtc(Math.max(0, current - delta));
        }
      } else {
        const today = new Date();
        const dateStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-${String(today.getDate()).padStart(2, "0")}`;

        const savedRecord = addBtcSellRecord({
          month: selectedMonth,
          date: dateStr,
          ...sellPayload,
        });
        if (!savedRecord) {
          setError("판매 기록을 저장하지 못했습니다. 다시 시도하세요.");
          return;
        }

        const current = getHeldBtc();
        setHeldBtc(Math.max(0, current - btcSpentFromWallet));
      }

      onSaved();
      onClose();
    } finally {
      releaseSaving();
    }
  };

  return (
    <div className="ldg-modal-backdrop">
      <div className="ldg-modal-content" onClick={(event) => event.stopPropagation()}>
        <div className="ldg-sell-modal-head">
          <div className="ldg-modal-title" style={{ marginBottom: 0 }}>
            {isEdit ? "판매 기록 수정" : "판매 확정"}
          </div>
          <button type="button" onClick={onClose} aria-label="닫기" className="ldg-sell-modal-close">
            ×
          </button>
        </div>

        <div className="ldg-modal-field">
          <div className="ldg-label" style={{ marginBottom: 6 }}>
            받은 원화
          </div>
          <div className="ldg-input-with-unit">
            <input
              id="sell-krw-received"
              type="text"
              inputMode="numeric"
              pattern="[0-9,]*"
              autoComplete="off"
              className="ldg-input"
              value={krwInput}
              onChange={(event) => setKrwInput(formatKrwInput(event.target.value))}
              placeholder={result.deficitKrw > 0 ? formatKrwInput(Math.round(result.deficitKrw)) : "0"}
              autoFocus
            />
            <span className="ldg-input-unit">원</span>
          </div>
        </div>

        <div className="ldg-modal-field" style={{ marginTop: 12 }}>
          <div className="ldg-label" style={{ marginBottom: 6 }}>
            보낸 비트코인
          </div>
          <div className="ldg-input-with-unit">
            <input
              id="sell-btc-spent"
              type="text"
              inputMode="decimal"
              autoComplete="off"
              className="ldg-input"
              value={btcInput}
              onChange={(event) => setBtcInput(formatBtcInput(event.target.value))}
              placeholder="0.00"
            />
            <span className="ldg-input-unit">BTC</span>
          </div>
          {satsSold > 0 && <div className="ldg-modal-sub">{formatSats(satsSold)}</div>}
        </div>

        {overHeld && (
          <div className="ldg-modal-error">보유 BTC({fmtBtcValue(availableHeldBtc, unit)})보다 많습니다.</div>
        )}

        {error && <div className="ldg-modal-error">{error}</div>}

        <div className="ldg-modal-actions">
          <button type="button" className="ldg-submit-btn secondary" onClick={onClose}>
            취소
          </button>
          <button type="button" className="ldg-submit-btn" onClick={handleSave} disabled={overHeld || isSaving}>
            {isSaving ? "저장 중..." : isEdit ? "수정 완료" : "판매 확정"}
          </button>
        </div>
      </div>
    </div>
  );
}
