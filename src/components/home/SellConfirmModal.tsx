import { useMemo, useState } from "react";
import type { SellResult } from "../../lib/sellCalculator";
import { fmtKRW, fmtBtcValue, type BtcUnit } from "../../lib/format";
import { addBtcSellRecord, updateBtcSellRecord, type BtcSellRecord } from "../../lib/btcSellRecords";
import { getHeldBtc, setHeldBtc } from "../../lib/heldBtc";
import type { SettlementPeriod } from "../../lib/settlement";

const MAX_BTC = 21_000_000; // 발행 한도 — 입력 실수로 비정상적으로 큰 값이 들어가는 것을 막는다

interface Props {
  result: SellResult;
  btcKrw: number;
  unit: BtcUnit;
  selectedMonth: string;
  period: SettlementPeriod;
  /** 있으면 새 기록 추가가 아니라 기존 판매 기록을 수정하는 모드로 동작한다. */
  editRecord?: BtcSellRecord;
  onClose: () => void;
  onSaved: () => void;
}

export default function SellConfirmModal({ result, btcKrw, unit, selectedMonth, period, editRecord, onClose, onSaved }: Props) {
  const isEdit = !!editRecord;

  const [btcKrwInput, setBtcKrwInput] = useState(String(editRecord?.btcKrwAtSell ?? btcKrw));
  const [sellUnit, setSellUnit] = useState<BtcUnit>(unit);
  const [sellInput, setSellInput] = useState(() => {
    const initialBtc = editRecord?.btcSold ?? result.sellBtc;
    const initialSats = editRecord?.satsSold ?? result.sellSats;
    if (unit === "sats") return initialSats > 0 ? String(initialSats) : "";
    return initialBtc > 0 ? initialBtc.toFixed(8).replace(/\.?0+$/, "") : "";
  });
  const [krwInput, setKrwInput] = useState(String(editRecord?.krwCovered ?? result.deficitKrw));
  const [deduct, setDeduct] = useState(editRecord?.deductedFromHeldBtc ?? true);
  const [note, setNote] = useState(editRecord?.note ?? "");
  const [error, setError] = useState("");

  const parsedBtcSold = useMemo(() => {
    if (sellUnit === "sats") {
      const sats = parseInt(sellInput.replace(/[^0-9]/g, ""), 10);
      return Number.isFinite(sats) ? sats / 1e8 : NaN;
    }
    const btc = parseFloat(sellInput);
    return Number.isFinite(btc) ? btc : NaN;
  }, [sellInput, sellUnit]);

  const parsedBtcKrwPreview = parseFloat(btcKrwInput);
  const saleAmountKrw =
    Number.isFinite(parsedBtcKrwPreview) && Number.isFinite(parsedBtcSold) ? parsedBtcKrwPreview * parsedBtcSold : 0;

  const currentHeldBtc = getHeldBtc();
  const overHeld = deduct && Number.isFinite(parsedBtcSold) && parsedBtcSold > currentHeldBtc;

  const handleUnitToggle = (nextUnit: BtcUnit) => {
    if (nextUnit === sellUnit) return;
    if (Number.isFinite(parsedBtcSold) && parsedBtcSold > 0) {
      setSellInput(nextUnit === "sats" ? String(Math.round(parsedBtcSold * 1e8)) : parsedBtcSold.toFixed(8).replace(/\.?0+$/, ""));
    } else {
      setSellInput("");
    }
    setSellUnit(nextUnit);
    setError("");
  };

  const handleSave = () => {
    const parsedBtcKrw = parseFloat(btcKrwInput);
    if (!Number.isFinite(parsedBtcKrw) || parsedBtcKrw <= 0) {
      setError("BTC 가격이 올바르지 않습니다.");
      return;
    }

    const parsedKrw = parseFloat(krwInput);
    if (!Number.isFinite(parsedKrw) || parsedKrw <= 0) {
      setError("충당 원화가 올바르지 않습니다.");
      return;
    }

    let btcSold: number;
    if (sellUnit === "sats") {
      const satsVal = parseInt(sellInput.replace(/[^0-9]/g, ""), 10);
      if (!Number.isFinite(satsVal) || satsVal <= 0) {
        setError("판매할 sats가 올바르지 않습니다.");
        return;
      }
      btcSold = satsVal / 1e8;
    } else {
      btcSold = parseFloat(sellInput);
      if (!Number.isFinite(btcSold) || btcSold <= 0) {
        setError("판매할 BTC가 올바르지 않습니다.");
        return;
      }
    }
    if (btcSold > MAX_BTC) {
      setError("값이 너무 큽니다.");
      return;
    }

    const satsSold = Math.round(btcSold * 1e8);

    if (editRecord) {
      const oldDeducted = editRecord.deductedFromHeldBtc ? editRecord.deductedBtcAmount ?? editRecord.btcSold : 0;
      const newDeducted = deduct ? btcSold : 0;
      const delta = newDeducted - oldDeducted;

      updateBtcSellRecord(editRecord.id, {
        btcSold,
        satsSold,
        btcKrwAtSell: parsedBtcKrw,
        krwCovered: parsedKrw,
        deductedFromHeldBtc: deduct,
        deductedBtcAmount: deduct ? btcSold : undefined,
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
        btcSold,
        satsSold,
        btcKrwAtSell: parsedBtcKrw,
        krwCovered: parsedKrw,
        deficitKrwAtConfirm: result.deficitKrw,
        deductedFromHeldBtc: deduct,
        note: note.trim() || undefined,
      });

      if (deduct) {
        const current = getHeldBtc();
        setHeldBtc(Math.max(0, current - btcSold));
      }
    }

    onSaved();
    onClose();
  };

  return (
    // 입력 중 실수로 바깥을 눌러도 모달이 닫히지 않도록 backdrop에는 onClick을 달지 않는다 —
    // 닫기는 우측 상단 X, 취소, 저장 버튼으로만 가능하다.
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
          <label className="ldg-modal-label">판매 당시 BTC 가격</label>
          <input
            type="text"
            inputMode="numeric"
            className="ldg-input"
            value={btcKrwInput}
            onChange={(e) => { setBtcKrwInput(e.target.value); setError(""); }}
          />
          <div className="ldg-tiny" style={{ marginTop: 2 }}>이 가격으로 판매 금액을 BTC/sats로 환산합니다.</div>
        </div>

        <div className="ldg-modal-field">
          <label className="ldg-modal-label" style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
            <span>판매할 비트코인</span>
            <div className="ldg-radio-group">
              <button type="button" className={sellUnit === "BTC" ? "on" : ""} onClick={() => handleUnitToggle("BTC")}>
                BTC
              </button>
              <button type="button" className={sellUnit === "sats" ? "on" : ""} onClick={() => handleUnitToggle("sats")}>
                sats
              </button>
            </div>
          </label>
          <input
            type="text"
            inputMode={sellUnit === "sats" ? "numeric" : "decimal"}
            className="ldg-input"
            value={sellInput}
            onChange={(e) => {
              const v = sellUnit === "sats" ? e.target.value.replace(/[^0-9]/g, "") : e.target.value;
              setSellInput(v);
              setError("");
            }}
            placeholder={sellUnit === "sats" ? "0" : "0.00000000"}
          />
          {Number.isFinite(parsedBtcSold) && parsedBtcSold > 0 && (
            <div className="ldg-tiny" style={{ marginTop: 2 }}>
              = {sellUnit === "sats"
                ? `${parsedBtcSold.toFixed(8).replace(/\.?0+$/, "")} BTC`
                : `${Math.round(parsedBtcSold * 1e8).toLocaleString("en-US")} sats`}
            </div>
          )}
        </div>

        <div className="ldg-modal-field">
          <label className="ldg-modal-label">판매 금액</label>
          <div className="ldg-modal-readonly">{fmtKRW(Math.round(saleAmountKrw))}</div>
        </div>

        <div className="ldg-modal-field">
          <label className="ldg-modal-label">충당 원화</label>
          <input
            type="text"
            inputMode="numeric"
            className="ldg-input"
            value={krwInput}
            onChange={(e) => { setKrwInput(e.target.value); setError(""); }}
          />
        </div>

        <label className="ldg-modal-checkbox">
          <input
            type="checkbox"
            checked={deduct}
            onChange={(e) => setDeduct(e.target.checked)}
          />
          <span>보유 BTC에서 차감</span>
        </label>
        {overHeld && (
          <div className="ldg-modal-error">보유 BTC({fmtBtcValue(currentHeldBtc, unit)})보다 많습니다.</div>
        )}

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
          <button type="button" className="ldg-submit-btn" onClick={handleSave}>
            {isEdit ? "수정 완료" : "저장"}
          </button>
        </div>
      </div>
    </div>
  );
}
