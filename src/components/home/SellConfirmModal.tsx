import { useState } from "react";
import type { SellResult } from "../../lib/sellCalculator";
import { fmtBtcValue, fmtKRW, type BtcUnit } from "../../lib/format";
import { addBtcSellRecord, updateBtcSellRecord, type BtcSellRecord } from "../../lib/btcSellRecords";
import { getHeldBtc, setHeldBtc } from "../../lib/heldBtc";
import type { SettlementPeriod } from "../../lib/settlement";

const MAX_BTC = 21_000_000;

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

function formatKrwWon(value: number): string {
  return `${Math.round(value).toLocaleString("ko-KR")} 원`;
}

function safeNonNegative(value: number): number {
  return Number.isFinite(value) && value >= 0 ? value : 0;
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
  const [note, setNote] = useState(editRecord?.note ?? "");
  const [error, setError] = useState("");

  const currentBtcKrw = Number.isFinite(btcKrw) && btcKrw > 0 ? btcKrw : 0;
  const sellKrw = safeNonNegative(result.deficitKrw);
  const sellSats = result.sellSats;
  const sellBtc = sellSats / 100_000_000;
  const fullyCovered = sellKrw <= 0;

  const currentHeldBtc = getHeldBtc();
  const previouslyDeductedBtc = editRecord?.deductedFromHeldBtc
    ? editRecord.deductedBtcAmount ?? editRecord.btcSold
    : 0;
  const availableHeldBtc = currentHeldBtc + previouslyDeductedBtc;
  const overHeld = Number.isFinite(sellBtc) && sellBtc > availableHeldBtc;

  const handleSave = () => {
    if (!Number.isFinite(currentBtcKrw) || currentBtcKrw <= 0) {
      setError("BTC 가격이 올바르지 않습니다.");
      return;
    }
    if (fullyCovered || sellKrw <= 0) {
      onSaved();
      onClose();
      return;
    }
    if (!Number.isFinite(sellBtc) || sellBtc <= 0 || sellSats <= 0) {
      setError("자동 계산된 판매량이 올바르지 않습니다.");
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
      const oldDeducted = previouslyDeductedBtc;
      const newDeducted = sellBtc;
      const delta = newDeducted - oldDeducted;

      updateBtcSellRecord(editRecord.id, {
        btcSold: sellBtc,
        satsSold: sellSats,
        btcKrwAtSell: currentBtcKrw,
        krwCovered: sellKrw,
        deficitKrwAtConfirm: result.deficitKrw,
        deductedFromHeldBtc: true,
        deductedBtcAmount: sellBtc,
        note: note.trim() || undefined,
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
        satsSold: sellSats,
        btcKrwAtSell: currentBtcKrw,
        krwCovered: sellKrw,
        deficitKrwAtConfirm: result.deficitKrw,
        deductedFromHeldBtc: true,
        deductedBtcAmount: sellBtc,
        note: note.trim() || undefined,
      });

      const current = getHeldBtc();
      setHeldBtc(Math.max(0, current - sellBtc));
    }

    onSaved();
    onClose();
  };

  return (
    <div className="ldg-modal-backdrop">
      <div className="ldg-modal-content" onClick={(e) => e.stopPropagation()}>
        <div className="ldg-sell-modal-head">
          <div className="ldg-modal-title" style={{ marginBottom: 0 }}>
            판매량 확정
          </div>
          <button type="button" onClick={onClose} aria-label="닫기" className="ldg-sell-modal-close">
            ×
          </button>
        </div>

        <div className="ldg-sell-highlight">
          <div className="ldg-sell-highlight-label">실제 판매량</div>
          {fullyCovered ? (
            <div className="ldg-sell-covered">판매 불필요</div>
          ) : (
            <>
              <div className="ldg-sell-sats-main">
                <span>{sellSats.toLocaleString("en-US")}</span>
                <span className="unit">sats</span>
              </div>
              <div className="ldg-sell-krw-main">{fmtKRW(sellKrw)}</div>
            </>
          )}
        </div>

        <div className="ldg-modal-rate-row">
          <span>현재 시세</span>
          <strong>{formatKrwWon(currentBtcKrw)}</strong>
        </div>

        {overHeld && <div className="ldg-modal-error">보유 BTC({fmtBtcValue(availableHeldBtc, unit)})보다 많습니다.</div>}

        <div className="ldg-modal-field">
          <label className="ldg-modal-label">메모 (선택)</label>
          <input
            type="text"
            className="ldg-input"
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="메모"
          />
        </div>

        {error && <div className="ldg-modal-error">{error}</div>}

        <div className="ldg-modal-actions">
          <button type="button" className="ldg-submit-btn secondary" onClick={onClose}>
            취소
          </button>
          <button type="button" className="ldg-submit-btn" onClick={handleSave} disabled={overHeld || fullyCovered}>
            {isEdit ? "수정 완료" : "저장"}
          </button>
        </div>
      </div>
    </div>
  );
}
