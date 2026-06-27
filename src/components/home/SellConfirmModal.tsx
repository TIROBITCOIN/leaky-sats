import { useMemo, useState } from "react";
import { applyAccountBalance, type SellResult } from "../../lib/sellCalculator";
import { fmtBtcValue, fmtKRW, type BtcUnit } from "../../lib/format";
import { addBtcSellRecord, updateBtcSellRecord, type BtcSellRecord } from "../../lib/btcSellRecords";
import { getHeldBtc, setHeldBtc } from "../../lib/heldBtc";
import { setMonthlyCash } from "../../lib/monthlyCash";
import type { SettlementPeriod } from "../../lib/settlement";

const MAX_BTC = 21_000_000;

interface Props {
  result: SellResult;
  btcKrw: number;
  unit: BtcUnit;
  selectedMonth: string;
  period: SettlementPeriod;
  monthlyCash: number;
  onMonthlyCashChanged: () => void;
  editRecord?: BtcSellRecord;
  onClose: () => void;
  onSaved: () => void;
}

function formatKrwWon(value: number): string {
  return `${Math.round(value).toLocaleString("ko-KR")} 원`;
}

function formatBtcFixed(value: number): string {
  return Number.isFinite(value) ? value.toFixed(8) : "0.00000000";
}

function safeNonNegative(value: number): number {
  return Number.isFinite(value) && value >= 0 ? value : 0;
}

export default function SellConfirmModal({
  result,
  btcKrw,
  unit,
  selectedMonth,
  period,
  monthlyCash,
  onMonthlyCashChanged,
  editRecord,
  onClose,
  onSaved,
}: Props) {
  const isEdit = !!editRecord;
  const [cashInput, setCashInput] = useState(monthlyCash > 0 ? String(monthlyCash) : "");
  const [note, setNote] = useState(editRecord?.note ?? "");
  const [error, setError] = useState("");

  const currentBtcKrw = Number.isFinite(btcKrw) && btcKrw > 0 ? btcKrw : 0;
  const parsedCash = parseFloat(cashInput);
  const cashKrw = safeNonNegative(parsedCash);
  const sellRecordCoverageKrw = Math.max(0, result.confirmedCoverageKrw - monthlyCash);
  const requiredBeforeCashKrw = Math.max(0, result.totalDeficitKrw - sellRecordCoverageKrw);

  const balanceAdjustedSell = useMemo(
    () => applyAccountBalance(requiredBeforeCashKrw, cashKrw, currentBtcKrw),
    [cashKrw, currentBtcKrw, requiredBeforeCashKrw]
  );
  const sellKrw = balanceAdjustedSell.sellKrw;
  const sellSats = balanceAdjustedSell.sellSats;
  const sellBtc = sellSats / 100_000_000;
  const fullyCovered = balanceAdjustedSell.fullyCovered;
  const saleAmountKrw = sellKrw;

  const currentHeldBtc = getHeldBtc();
  const previouslyDeductedBtc = editRecord?.deductedFromHeldBtc
    ? editRecord.deductedBtcAmount ?? editRecord.btcSold
    : 0;
  const availableHeldBtc = currentHeldBtc + previouslyDeductedBtc;
  const overHeld = Number.isFinite(sellBtc) && sellBtc > availableHeldBtc;

  const saveMonthlyCash = () => {
    setMonthlyCash(selectedMonth, cashKrw);
    onMonthlyCashChanged();
  };

  const handleCashOnlySave = () => {
    saveMonthlyCash();
    onSaved();
    onClose();
  };

  const handleSave = () => {
    if (!Number.isFinite(currentBtcKrw) || currentBtcKrw <= 0) {
      setError("BTC 가격이 올바르지 않습니다.");
      return;
    }
    if (fullyCovered || sellKrw <= 0) {
      handleCashOnlySave();
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

    saveMonthlyCash();

    if (editRecord) {
      const oldDeducted = previouslyDeductedBtc;
      const newDeducted = sellBtc;
      const delta = newDeducted - oldDeducted;

      updateBtcSellRecord(editRecord.id, {
        btcSold: sellBtc,
        satsSold: sellSats,
        btcKrwAtSell: currentBtcKrw,
        krwCovered: sellKrw,
        deficitKrwAtConfirm: requiredBeforeCashKrw,
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
        deficitKrwAtConfirm: requiredBeforeCashKrw,
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
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <div className="ldg-modal-title" style={{ marginBottom: 0 }}>
            BTC 판매 확정
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="닫기"
            style={{ background: "none", border: 0, color: "var(--ldg-fg-3)", fontSize: 20, lineHeight: 1, cursor: "pointer", padding: 4 }}
          >
            ×
          </button>
        </div>

        <div className="ldg-modal-field">
          <label className="ldg-modal-label">정산기간</label>
          <div className="ldg-modal-readonly">
            {period.label}
            <div className="ldg-tiny" style={{ marginTop: 2 }}>
              {period.rangeLabel}
            </div>
          </div>
        </div>

        <div className="ldg-modal-field">
          <label className="ldg-modal-label">현재 BTC 가격</label>
          <div className="ldg-modal-readonly">{formatKrwWon(currentBtcKrw)}</div>
          <div className="ldg-tiny" style={{ marginTop: 2 }}>
            앱의 현재 시세를 사용하며 저장 시점 가격으로 기록됩니다.
          </div>
        </div>

        <div className="ldg-modal-field">
          <label className="ldg-modal-label">자동 판매량</label>
          <div className="ldg-inout-main neg" style={{ marginTop: 6 }}>
            {sellSats.toLocaleString("en-US")} sats
          </div>
          <div className="ldg-balance-sub">= {formatBtcFixed(sellBtc)} BTC</div>
          <div className="ldg-tiny" style={{ marginTop: 6 }}>
            실제 판매 ≈ {fmtKRW(saleAmountKrw)}
          </div>
        </div>

        <div className="ldg-modal-field">
          <label className="ldg-modal-label">통장 보유액 (선택)</label>
          <div className="ldg-tiny" style={{ marginBottom: 6 }}>
            이번 달 통장에 있는 금액. 부족분에서 차감됩니다.
          </div>
          <input
            type="text"
            inputMode="numeric"
            className="ldg-input"
            value={cashInput}
            onChange={(e) => {
              setCashInput(e.target.value.replace(/[^0-9.]/g, ""));
              setError("");
            }}
          />
          {fullyCovered ? (
            <div className="ldg-tiny" style={{ marginTop: 6 }}>
              통장 보유액으로 충분 — BTC 판매 불필요
            </div>
          ) : (
            <div className="ldg-tiny" style={{ marginTop: 6 }}>
              통장 보유액 반영 후 실제 판매 ≈ {fmtKRW(sellKrw)}
            </div>
          )}
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
          {fullyCovered && (
            <button type="button" className="ldg-submit-btn secondary" onClick={handleCashOnlySave}>
              통장 보유액만 저장
            </button>
          )}
          <button type="button" className="ldg-submit-btn" onClick={handleSave} disabled={overHeld || fullyCovered}>
            {isEdit ? "수정 완료" : "저장"}
          </button>
        </div>
      </div>
    </div>
  );
}
