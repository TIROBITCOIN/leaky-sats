import { useEffect, useMemo, useRef, useState } from "react";
import type { SellResult } from "../../lib/sellCalculator";
import {
  formatBtcInput,
  formatKrwInput,
  fmtBtcValue,
  fmtKRW,
  parseBtcInput,
  parseDigits,
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

  // v2 실측 입력: 받은 원화 + 지갑에서 나간 BTC (+ 선택 수수료)
  const initialKrw = editRecord
    ? editRecord.krwReceived ?? editRecord.krwCovered
    : result.deficitKrw;
  const [krwInput, setKrwInput] = useState(
    initialKrw > 0 ? formatKrwInput(Math.round(initialKrw)) : ""
  );
  const [btcInput, setBtcInput] = useState(() =>
    initialBtcSpent(editRecord, result.deficitKrw, currentBtcKrw)
  );
  const [feeSatsInput, setFeeSatsInput] = useState(() => {
    if (editRecord?.networkFeeSats && editRecord.networkFeeSats > 0) {
      return String(Math.round(editRecord.networkFeeSats));
    }
    return "";
  });
  const [error, setError] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const savingRef = useRef(false);

  const krwReceived = parseKrwInput(krwInput);
  const btcSpentFromWallet = parseBtcInput(btcInput);
  const networkFeeSats = Number(parseDigits(feeSatsInput)) || 0;
  const satsSold = Math.round(btcSpentFromWallet * SATS_PER_BTC);

  const effectivePrice = useMemo(
    () => calculateEffectiveSellPriceKrw(krwReceived, btcSpentFromWallet, networkFeeSats),
    [krwReceived, btcSpentFromWallet, networkFeeSats]
  );

  const marketDeltaPct = useMemo(() => {
    if (!effectivePrice || !(currentBtcKrw > 0)) return null;
    return ((effectivePrice - currentBtcKrw) / currentBtcKrw) * 100;
  }, [effectivePrice, currentBtcKrw]);

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
        setError("실제 받은 원화를 입력하세요.");
        return;
      }
      if (!Number.isFinite(btcSpentFromWallet) || btcSpentFromWallet <= 0) {
        setError("지갑에서 나간 BTC를 입력하세요.");
        return;
      }
      if (btcSpentFromWallet > MAX_BTC) {
        setError("값이 너무 큽니다.");
        return;
      }
      if (networkFeeSats < 0 || !Number.isFinite(networkFeeSats)) {
        setError("전송 수수료가 올바르지 않습니다.");
        return;
      }
      const feeBtc = networkFeeSats / SATS_PER_BTC;
      if (feeBtc >= btcSpentFromWallet) {
        setError("전송 수수료가 나간 BTC보다 크거나 같습니다.");
        return;
      }
      const effective = calculateEffectiveSellPriceKrw(krwReceived, btcSpentFromWallet, networkFeeSats);
      if (effective === null || !(effective > 0)) {
        setError("실효 매도가를 계산할 수 없습니다.");
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
        networkFeeSats: networkFeeSats > 0 ? networkFeeSats : undefined,
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
            {isEdit ? "판매 기록 수정" : "판매 확정 (실측)"}
          </div>
          <button type="button" onClick={onClose} aria-label="닫기" className="ldg-sell-modal-close">
            ×
          </button>
        </div>

        <p className="ldg-sell-cash-help" style={{ marginTop: 4, marginBottom: 10 }}>
          거래소에 실제로 들어온 원화와, 지갑에서 실제로 나간 BTC를 그대로 적으세요. 앱 시세로 역산하지 않습니다.
        </p>

        <div className="ldg-modal-field">
          <div className="ldg-label" style={{ marginBottom: 6 }}>
            실제 받은 원화
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
            지갑에서 나간 BTC
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

        <div className="ldg-modal-field" style={{ marginTop: 12 }}>
          <div className="ldg-label" style={{ marginBottom: 6 }}>
            전송 수수료 (선택)
          </div>
          <div className="ldg-input-with-unit">
            <input
              id="sell-network-fee"
              type="text"
              inputMode="numeric"
              autoComplete="off"
              className="ldg-input"
              value={feeSatsInput}
              onChange={(event) => setFeeSatsInput(event.target.value.replace(/[^0-9]/g, ""))}
              placeholder="0"
            />
            <span className="ldg-input-unit" style={{ width: 42 }}>
              sats
            </span>
          </div>
        </div>

        {effectivePrice !== null && (
          <div className="ldg-modal-rate-row" style={{ marginTop: 12 }}>
            <span>실효 매도가</span>
            <strong>{fmtKRW(Math.round(effectivePrice))}</strong>
          </div>
        )}
        {currentBtcKrw > 0 && (
          <div className="ldg-modal-rate-row">
            <span>앱 시세 (참고)</span>
            <strong>{fmtKRW(Math.round(currentBtcKrw))}</strong>
          </div>
        )}
        {marketDeltaPct !== null && Number.isFinite(marketDeltaPct) && (
          <div className="ldg-modal-rate-row">
            <span>시세 대비</span>
            <strong>
              {marketDeltaPct >= 0 ? "+" : ""}
              {marketDeltaPct.toFixed(2)}%
            </strong>
          </div>
        )}

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
