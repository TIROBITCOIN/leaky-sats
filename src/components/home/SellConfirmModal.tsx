import { useEffect, useMemo, useState } from "react";
import type { SellResult } from "../../lib/sellCalculator";
import { fmtBtcValue, fmtKRW, type BtcUnit } from "../../lib/format";
import { addBtcSellRecord, updateBtcSellRecord, type BtcSellRecord } from "../../lib/btcSellRecords";
import { getHeldBtc, setHeldBtc } from "../../lib/heldBtc";
import { DEFAULT_NETWORK_FEE_SATS, fetchRecommendedNetworkFeeSats } from "../../lib/networkFees";
import type { SettlementPeriod } from "../../lib/settlement";

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

function formatKrwWon(value: number): string {
  return `₩${Math.round(value).toLocaleString("ko-KR")}`;
}

function parseKrwInput(value: string): number {
  const parsed = Number(value.replace(/[^0-9]/g, ""));
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 0;
}

function parseSatsInput(value: string): number {
  const parsed = Number(value.replace(/[^0-9]/g, ""));
  return Number.isFinite(parsed) && parsed > 0 ? Math.round(parsed) : 0;
}

function parsePercentInput(value: string): number {
  const normalized = value.replace(/[^0-9.-]/g, "");
  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : 0;
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
  const [carryoverBalanceInput, setCarryoverBalanceInput] = useState("");
  const [premiumInput, setPremiumInput] = useState("0");
  const [networkFeeInput, setNetworkFeeInput] = useState(String(DEFAULT_NETWORK_FEE_SATS));
  const [note, setNote] = useState(editRecord?.note ?? "");
  const [error, setError] = useState("");

  useEffect(() => {
    let alive = true;
    fetchRecommendedNetworkFeeSats().then((feeSats) => {
      if (alive) setNetworkFeeInput(String(feeSats));
    });
    return () => {
      alive = false;
    };
  }, []);

  const currentBtcKrw = Number.isFinite(btcKrw) && btcKrw > 0 ? btcKrw : 0;
  const carryoverBalanceKrw = parseKrwInput(carryoverBalanceInput);
  const premiumPct = parsePercentInput(premiumInput);
  const networkFeeSats = parseSatsInput(networkFeeInput);
  const effectivePrice = currentBtcKrw > 0 ? currentBtcKrw * (1 + premiumPct / 100) : 0;
  const neededKrw = Math.max(0, result.deficitKrw - carryoverBalanceKrw);
  const tradeSats = effectivePrice > 0 ? Math.round((neededKrw / effectivePrice) * SATS_PER_BTC) : 0;
  const finalSats = tradeSats > 0 ? tradeSats + networkFeeSats : 0;
  const sellBtc = finalSats / SATS_PER_BTC;
  const coveredKrw = effectivePrice > 0 ? Math.round((tradeSats / SATS_PER_BTC) * effectivePrice) : 0;
  const feeKrw = currentBtcKrw > 0 ? Math.round((networkFeeSats / SATS_PER_BTC) * currentBtcKrw) : 0;
  const carryoverSats = currentBtcKrw > 0 ? Math.round((carryoverBalanceKrw / currentBtcKrw) * SATS_PER_BTC) : 0;
  const deficitSats = currentBtcKrw > 0 ? Math.round((result.deficitKrw / currentBtcKrw) * SATS_PER_BTC) : result.sellSats;
  const finalKrw = effectivePrice > 0 ? Math.round((finalSats / SATS_PER_BTC) * effectivePrice) : 0;
  const fullyCovered = result.deficitKrw <= 0 || finalSats <= 0;

  const currentHeldBtc = getHeldBtc();
  const previouslyDeductedBtc = editRecord?.deductedFromHeldBtc
    ? editRecord.deductedBtcAmount ?? editRecord.btcSold
    : 0;
  const availableHeldBtc = currentHeldBtc + previouslyDeductedBtc;
  const overHeld = useMemo(() => Number.isFinite(sellBtc) && sellBtc > availableHeldBtc, [sellBtc, availableHeldBtc]);

  const handleSave = () => {
    if (!Number.isFinite(currentBtcKrw) || currentBtcKrw <= 0 || !Number.isFinite(effectivePrice) || effectivePrice <= 0) {
      setError("BTC 가격이 올바르지 않습니다.");
      return;
    }
    if (fullyCovered) {
      onSaved();
      onClose();
      return;
    }
    if (!Number.isFinite(sellBtc) || sellBtc <= 0 || finalSats <= 0) {
      setError("계산된 판매 sats가 올바르지 않습니다.");
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
        satsSold: finalSats,
        btcKrwAtSell: effectivePrice,
        krwCovered: coveredKrw,
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
        satsSold: finalSats,
        btcKrwAtSell: effectivePrice,
        krwCovered: coveredKrw,
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
      <div className="ldg-modal-content" onClick={(event) => event.stopPropagation()}>
        <div className="ldg-sell-modal-head">
          <div className="ldg-modal-title" style={{ marginBottom: 0 }}>
            판매량 확정
          </div>
          <button type="button" onClick={onClose} aria-label="닫기" className="ldg-sell-modal-close">
            ×
          </button>
        </div>

        <div className="ldg-sell-highlight">
          <div className="ldg-sell-highlight-label">부족분</div>
          <div className="ldg-sell-sats-main">
            <span>{formatSats(deficitSats).replace(" sats", "")}</span>
            <span className="unit">sats</span>
          </div>
          <div className="ldg-sell-krw-main">≈ {fmtKRW(result.deficitKrw)}</div>
        </div>

        <div className="ldg-modal-divider" />

        <div className="ldg-modal-field">
          <label className="ldg-modal-label" htmlFor="carryover-balance">
            이월 잔고
          </label>
          <div className="ldg-prefixed-input">
            <span>₩</span>
            <input
              id="carryover-balance"
              type="text"
              inputMode="numeric"
              className="ldg-input"
              value={carryoverBalanceInput}
              onChange={(event) => setCarryoverBalanceInput(event.target.value.replace(/[^0-9]/g, ""))}
              placeholder="0"
            />
          </div>
          <div className="ldg-modal-sub">≈ {formatSats(carryoverSats)}</div>
        </div>

        <div className="ldg-modal-field">
          <label className="ldg-modal-label" htmlFor="p2p-premium">
            P2P 프리미엄
          </label>
          <div className="ldg-suffix-input">
            <input
              id="p2p-premium"
              type="text"
              inputMode="decimal"
              className="ldg-input"
              value={premiumInput}
              onChange={(event) => setPremiumInput(event.target.value)}
              placeholder="0"
            />
            <span>%</span>
          </div>
        </div>

        <div className="ldg-modal-rate-row">
          <span>실효가격</span>
          <strong>{formatKrwWon(effectivePrice || currentBtcKrw)}</strong>
        </div>

        <div className="ldg-modal-field">
          <label className="ldg-modal-label" htmlFor="network-fee">
            네트워크 수수료
          </label>
          <div className="ldg-suffix-input">
            <input
              id="network-fee"
              type="text"
              inputMode="numeric"
              className="ldg-input"
              value={networkFeeInput}
              onChange={(event) => setNetworkFeeInput(event.target.value.replace(/[^0-9]/g, ""))}
              placeholder={String(DEFAULT_NETWORK_FEE_SATS)}
            />
            <span>sats</span>
          </div>
          <div className="ldg-modal-sub">≈ {fmtKRW(feeKrw)}</div>
        </div>

        <div className="ldg-fee-warning">
          <span aria-hidden="true">⚠</span>
          <strong>UTXO 개수 늘면 수수료도 달라질 수 있음</strong>
        </div>

        <div className="ldg-modal-divider" />

        <div className="ldg-sell-highlight final">
          <div className="ldg-sell-highlight-label">실제 판매할 sats</div>
          <div className="ldg-sell-sats-main">
            <span>{finalSats.toLocaleString("en-US")}</span>
            <span className="unit">sats</span>
          </div>
          <div className="ldg-sell-krw-main">≈ {fmtKRW(finalKrw)}</div>
        </div>

        {overHeld && <div className="ldg-modal-error">보유 BTC({fmtBtcValue(availableHeldBtc, unit)})보다 많습니다.</div>}

        <div className="ldg-modal-field">
          <label className="ldg-modal-label">메모 (선택)</label>
          <input
            type="text"
            className="ldg-input"
            value={note}
            onChange={(event) => setNote(event.target.value)}
            placeholder="메모"
          />
        </div>

        {error && <div className="ldg-modal-error">{error}</div>}

        <div className="ldg-modal-actions">
          <button type="button" className="ldg-submit-btn secondary" onClick={onClose}>
            취소
          </button>
          <button type="button" className="ldg-submit-btn" onClick={handleSave} disabled={overHeld || fullyCovered}>
            {isEdit ? "수정 완료" : "판매 확정"}
          </button>
        </div>
        <div className="ldg-sell-modal-note">수수료·가격 변동 감안해 여유 있게 판매하는 걸 권장함</div>
      </div>
    </div>
  );
}
