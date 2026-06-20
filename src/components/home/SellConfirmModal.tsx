import { useState } from "react";
import type { SellResult } from "../../lib/sellCalculator";
import type { BtcUnit } from "../../lib/format";
import { addBtcSellRecord } from "../../lib/btcSellRecords";
import { getHeldBtc, setHeldBtc } from "../../lib/heldBtc";
import { getCurrentMonthKey, getCurrentMonthLabel } from "../../lib/month";

interface Props {
  result: SellResult;
  btcKrw: number;
  unit: BtcUnit;
  onClose: () => void;
  onSaved: () => void;
}

export default function SellConfirmModal({ result, btcKrw, unit, onClose, onSaved }: Props) {
  const monthKey = getCurrentMonthKey();
  const monthLabel = getCurrentMonthLabel();

  const [btcKrwInput, setBtcKrwInput] = useState(String(btcKrw));
  const [sellInput, setSellInput] = useState(() => {
    if (unit === "sats") return String(result.sellSats);
    return result.sellBtc > 0 ? result.sellBtc.toFixed(8).replace(/\.?0+$/, "") : "";
  });
  const [krwInput, setKrwInput] = useState(String(result.deficitKrw));
  const [deduct, setDeduct] = useState(true);
  const [note, setNote] = useState("");
  const [error, setError] = useState("");

  const handleSave = () => {
    const parsedBtcKrw = parseFloat(btcKrwInput);
    if (!Number.isFinite(parsedBtcKrw) || parsedBtcKrw <= 0) {
      setError("BTC/KRW 시세가 올바르지 않습니다.");
      return;
    }

    const parsedKrw = parseFloat(krwInput);
    if (!Number.isFinite(parsedKrw) || parsedKrw <= 0) {
      setError("충당 원화가 올바르지 않습니다.");
      return;
    }

    let btcSold: number;
    if (unit === "sats") {
      const satsVal = parseInt(sellInput, 10);
      if (!Number.isFinite(satsVal) || satsVal <= 0) {
        setError("매도 sats가 올바르지 않습니다.");
        return;
      }
      btcSold = satsVal / 1e8;
    } else {
      btcSold = parseFloat(sellInput);
      if (!Number.isFinite(btcSold) || btcSold <= 0) {
        setError("매도 BTC가 올바르지 않습니다.");
        return;
      }
    }

    const satsSold = Math.round(btcSold * 1e8);
    const today = new Date();
    const dateStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-${String(today.getDate()).padStart(2, "0")}`;

    addBtcSellRecord({
      month: monthKey,
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

    onSaved();
    onClose();
  };

  return (
    <div className="ldg-modal-backdrop" onClick={onClose}>
      <div className="ldg-modal-content" onClick={(e) => e.stopPropagation()}>
        <div className="ldg-modal-title">BTC 매도 반영</div>

        <div className="ldg-modal-field">
          <label className="ldg-modal-label">기준 월</label>
          <div className="ldg-modal-readonly">{monthLabel}</div>
        </div>

        <div className="ldg-modal-field">
          <label className="ldg-modal-label">매도 시점 BTC/KRW</label>
          <input
            type="text"
            inputMode="numeric"
            className="ldg-input"
            value={btcKrwInput}
            onChange={(e) => { setBtcKrwInput(e.target.value); setError(""); }}
          />
        </div>

        <div className="ldg-modal-field">
          <label className="ldg-modal-label">
            매도 {unit === "sats" ? "sats" : "BTC"}
          </label>
          <input
            type="text"
            inputMode="decimal"
            className="ldg-input"
            value={sellInput}
            onChange={(e) => { setSellInput(e.target.value); setError(""); }}
            placeholder={unit === "sats" ? "0" : "0.00000000"}
          />
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
            저장
          </button>
        </div>
      </div>
    </div>
  );
}
