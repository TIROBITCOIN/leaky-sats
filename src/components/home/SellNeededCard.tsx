import { useEffect, useState } from "react";
import type { SellResult } from "../../lib/sellCalculator";
import { fmtBtcValue, fmtKRW, type BtcUnit } from "../../lib/format";
import { getMonthLabel } from "../../lib/month";

interface Props {
  result: SellResult;
  unit: BtcUnit;
  selectedMonth: string;
  btcKrw: number;
  unsettledIncomeKrw: number;
  unsettledExpenseKrw: number;
  theoreticalBalanceKrw: number;
  balanceMissing: boolean;
  actualBalanceKrw?: number;
  onActualBalanceChange: (value: number | null) => void;
  onConfirmSell?: () => void;
}

function parseKrwInput(value: string): number | null {
  if (!value.trim()) return null;
  const parsed = Number(value.replace(/[^0-9]/g, ""));
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : null;
}

function formatInput(value?: number): string {
  return value !== undefined && value >= 0 ? String(Math.round(value)) : "";
}

function formatBalanceOffset(value: number): string {
  const rounded = Math.round(value);
  if (rounded < 0) return `+${fmtKRW(Math.abs(rounded))}`;
  return `-${fmtKRW(rounded)}`;
}

function CalcRow({ label, value, muted = false }: { label: string; value: string; muted?: boolean }) {
  return (
    <div className={`ldg-sell-calc-row${muted ? " muted" : ""}`}>
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}

export default function SellNeededCard({
  result,
  unit,
  selectedMonth,
  btcKrw,
  unsettledIncomeKrw,
  unsettledExpenseKrw,
  theoreticalBalanceKrw,
  balanceMissing,
  actualBalanceKrw,
  onActualBalanceChange,
  onConfirmSell,
}: Props) {
  const [expanded, setExpanded] = useState(false);
  const [actualInput, setActualInput] = useState(formatInput(actualBalanceKrw));
  const monthLabel = getMonthLabel(selectedMonth);
  const hasBtcRate = Number.isFinite(btcKrw) && btcKrw > 0;
  const satsText = hasBtcRate ? `${result.sellSats.toLocaleString("en-US")} sats` : "0 sats";
  const unknownDelta =
    actualBalanceKrw === undefined ? null : Math.round(actualBalanceKrw - theoreticalBalanceKrw);

  useEffect(() => {
    setActualInput(formatInput(actualBalanceKrw));
  }, [actualBalanceKrw]);

  return (
    <div className="ldg-card ldg-sell-simple-card">
      <div className="ldg-card-head">
        <div>
          <div className="ldg-label">팔아야 할 돈</div>
          <div className="ldg-tiny">{monthLabel} 미정산 기준</div>
        </div>
        {balanceMissing && <span className="ldg-badge muted">잔고 미입력</span>}
      </div>

      <div className="ldg-sell-primary">
        <strong>{fmtKRW(result.deficitKrw)}</strong>
        <span>≈ {satsText}</span>
        <span>{fmtBtcValue(result.sellBtc, unit)}</span>
      </div>

      <button
        type="button"
        className="ldg-sell-detail-toggle"
        aria-expanded={expanded}
        onClick={() => setExpanded((value) => !value)}
      >
        왜 이 금액이죠? <span>{expanded ? "접기" : "보기"}</span>
      </button>

      {expanded && (
        <div className="ldg-sell-calc-panel">
          <div className="ldg-sell-calc-list">
            <CalcRow label="아직 정산 안 된 지출" value={fmtKRW(unsettledExpenseKrw)} />
            {unsettledIncomeKrw > 0 && <CalcRow label="아직 정산 안 된 수입" value={`-${fmtKRW(unsettledIncomeKrw)}`} muted />}
            <CalcRow label="계산상 통장 잔고" value={formatBalanceOffset(theoreticalBalanceKrw)} muted />
          </div>
          <div className="ldg-sell-calc-divider" />
          <div className="ldg-modal-field ldg-actual-balance-field">
            <label className="ldg-modal-label" htmlFor="actual-balance-check">
              실제 통장 잔고 확인
            </label>
            <input
              id="actual-balance-check"
              type="text"
              inputMode="numeric"
              className="ldg-input"
              value={actualInput}
              onChange={(event) => {
                const next = event.target.value.replace(/[^0-9]/g, "");
                setActualInput(next);
                onActualBalanceChange(parseKrwInput(next));
              }}
              placeholder="선택 입력"
            />
            {unknownDelta !== null && unknownDelta !== 0 && (
              <div className="ldg-sell-delta">미상 차액 {unknownDelta > 0 ? "+" : ""}{fmtKRW(unknownDelta)}</div>
            )}
          </div>
        </div>
      )}

      {onConfirmSell && result.deficitKrw > 0 && (
        <button type="button" className="ldg-submit-btn" onClick={onConfirmSell}>
          BTC 판매 확정
        </button>
      )}
    </div>
  );
}
