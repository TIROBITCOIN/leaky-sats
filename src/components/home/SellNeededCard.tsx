import { useEffect, useState } from "react";
import type { SellResult } from "../../lib/sellCalculator";
import { fmtBtcValue, fmtKRW, type BtcUnit } from "../../lib/format";
import { getMonthLabel } from "../../lib/month";

interface Props {
  result: SellResult;
  unit: BtcUnit;
  selectedMonth: string;
  monthlyCash: number;
  btcKrw: number;
  onMonthlyCashChange: (value: number) => void;
  onConfirmSell?: () => void;
}

function parseCashInput(value: string): number {
  const parsed = Number(value.replace(/[^0-9]/g, ""));
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 0;
}

function formatCashInput(value: number): string {
  return value > 0 ? String(Math.round(value)) : "";
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
  monthlyCash,
  btcKrw,
  onMonthlyCashChange,
  onConfirmSell,
}: Props) {
  const [cashInput, setCashInput] = useState(formatCashInput(monthlyCash));
  const monthLabel = getMonthLabel(selectedMonth);
  const unsettledExpenseKrw = result.expenseKrw;
  const unsettledIncomeKrw = result.incomeKrw;
  const sellKrw = result.deficitKrw;
  const hasUnsettledIncome = unsettledIncomeKrw > 0;
  const hasBtcRate = Number.isFinite(btcKrw) && btcKrw > 0;
  const sellBtcText = hasBtcRate ? `${result.sellSats.toLocaleString("en-US")} sats / ${result.sellBtc.toFixed(8)} BTC` : "0 sats / 0 BTC";

  useEffect(() => {
    setCashInput(formatCashInput(monthlyCash));
  }, [monthlyCash]);

  return (
    <div className="ldg-card ldg-sell-calc-card">
      <div className="ldg-card-head">
        <div>
          <div className="ldg-label">판매해야 하는 비트코인</div>
          <div className="ldg-tiny">{monthLabel} 미정산 기준</div>
        </div>
      </div>

      <div className="ldg-modal-field ldg-home-cash-field">
        <label className="ldg-modal-label" htmlFor="monthly-cash-input">
          통장 잔고
        </label>
        <input
          id="monthly-cash-input"
          type="text"
          inputMode="numeric"
          className="ldg-input"
          value={cashInput}
          onChange={(event) => {
            const next = event.target.value.replace(/[^0-9]/g, "");
            setCashInput(next);
            onMonthlyCashChange(parseCashInput(next));
          }}
          placeholder="0"
        />
      </div>

      <div className="ldg-sell-calc-list">
        <CalcRow label="아직 정산 안 된 지출" value={fmtKRW(unsettledExpenseKrw)} />
        {hasUnsettledIncome && <CalcRow label="아직 정산 안 된 수입" value={`-${fmtKRW(unsettledIncomeKrw)}`} muted />}
        <CalcRow label="통장 잔고" value={`-${fmtKRW(monthlyCash)}`} muted />
      </div>

      <div className="ldg-sell-calc-divider" />

      <div className="ldg-sell-result-row">
        <div>
          <div className="ldg-label">팔아야 할 돈</div>
          <div className="ldg-sell-result-sub">{sellBtcText}</div>
        </div>
        <div className="ldg-sell-result-value">
          <strong>{fmtKRW(sellKrw)}</strong>
          <span>{fmtBtcValue(result.sellBtc, unit)}</span>
        </div>
      </div>

      {onConfirmSell && sellKrw > 0 && (
        <button type="button" className="ldg-submit-btn" style={{ marginTop: 12 }} onClick={onConfirmSell}>
          BTC 판매 확정
        </button>
      )}
    </div>
  );
}
