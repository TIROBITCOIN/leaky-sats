import { useEffect, useMemo, useRef, useState } from "react";
import type { SellResult } from "../../lib/sellCalculator";
import { fmtBtcValue, type BtcUnit } from "../../lib/format";
import { addBtcSellRecord, updateBtcSellRecord, type BtcSellRecord } from "../../lib/btcSellRecords";
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

function parseKrwInput(value: string): number {
  const parsed = Number(value.replace(/[^0-9]/g, ""));
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 0;
}

function formatSats(value: number): string {
  return `${Math.round(value).toLocaleString("en-US")} sats`;
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
  // 기본값 = 이번 판매의 부족분(sellNeededKrw). 수정 모드에서는 저장된 판매 금액을 그대로 보여준다.
  const initialAmountKrw = editRecord ? editRecord.krwCovered : result.deficitKrw;
  const [amountInput, setAmountInput] = useState(
    initialAmountKrw > 0 ? String(Math.round(initialAmountKrw)) : ""
  );
  const [error, setError] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const savingRef = useRef(false);

  const currentBtcKrw = Number.isFinite(btcKrw) && btcKrw > 0 ? btcKrw : 0;
  const recalcBtcKrw = editRecord ? editRecord.btcKrwAtSell : currentBtcKrw;
  const amountKrw = parseKrwInput(amountInput);
  const sellBtc = recalcBtcKrw > 0 ? amountKrw / recalcBtcKrw : 0;
  const sats = Math.round(sellBtc * SATS_PER_BTC);

  const currentHeldBtc = getHeldBtc();
  const previouslyDeductedBtc = editRecord?.deductedFromHeldBtc
    ? editRecord.deductedBtcAmount ?? editRecord.btcSold
    : 0;
  const availableHeldBtc = currentHeldBtc + previouslyDeductedBtc;
  const overHeld = useMemo(() => Number.isFinite(sellBtc) && sellBtc > availableHeldBtc, [sellBtc, availableHeldBtc]);

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
      if (!Number.isFinite(recalcBtcKrw) || recalcBtcKrw <= 0) {
        setError("BTC 가격이 올바르지 않습니다.");
        return;
      }
      if (!Number.isFinite(sellBtc) || sellBtc <= 0 || sats <= 0) {
        setError("판매 금액을 입력하세요.");
        return;
      }
      if (sellBtc > MAX_BTC) {
        setError("값이 너무 큽니다.");
        return;
      }

      const heldBtcAtSave = getHeldBtc();
      const availableHeldBtcAtSave = heldBtcAtSave + previouslyDeductedBtc;
      if (sellBtc > availableHeldBtcAtSave) {
        setError("보유 BTC보다 많이 판매할 수 없습니다.");
        return;
      }

      if (editRecord) {
        const delta = sellBtc - previouslyDeductedBtc;

        updateBtcSellRecord(editRecord.id, {
          btcSold: sellBtc,
          satsSold: sats,
          krwCovered: amountKrw,
          deficitKrwAtConfirm: result.deficitKrw,
          deductedFromHeldBtc: true,
          deductedBtcAmount: sellBtc,
        });

        if (delta !== 0) {
          const current = getHeldBtc();
          setHeldBtc(Math.max(0, current - delta));
        }
      } else {
        const today = new Date();
        const dateStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-${String(today.getDate()).padStart(2, "0")}`;

        addBtcSellRecord({
          month: selectedMonth,
          date: dateStr,
          btcSold: sellBtc,
          satsSold: sats,
          btcKrwAtSell: currentBtcKrw,
          krwCovered: amountKrw,
          deficitKrwAtConfirm: result.deficitKrw,
          deductedFromHeldBtc: true,
          deductedBtcAmount: sellBtc,
        });

        const current = getHeldBtc();
        setHeldBtc(Math.max(0, current - sellBtc));
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
            판매할 금액
          </div>
          <button type="button" onClick={onClose} aria-label="닫기" className="ldg-sell-modal-close">
            ×
          </button>
        </div>

        <div className="ldg-modal-field">
          <div className="ldg-input-with-unit">
            <input
              id="sell-amount"
              type="text"
              inputMode="numeric"
              className="ldg-input"
              value={amountInput}
              onChange={(event) => setAmountInput(event.target.value.replace(/[^0-9]/g, ""))}
              placeholder="0"
              autoFocus
            />
            <span className="ldg-input-unit">원</span>
          </div>
          <div className="ldg-modal-sub">≈ {formatSats(sats)}</div>
        </div>

        {overHeld && <div className="ldg-modal-error">보유 BTC({fmtBtcValue(availableHeldBtc, unit)})보다 많습니다.</div>}

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
