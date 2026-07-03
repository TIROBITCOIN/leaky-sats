import { useState } from "react";
import "../../styles/layout.css";
import { useLedger } from "../../state/LedgerContext";
import { getSettlementMonthKeyForDate, loadSettlementDay } from "../../lib/settlement";
import { loadPeriodStartBalances } from "../../lib/periodStartBalance";

function parseKrwInput(value: string): number {
  const parsed = Number(value.replace(/[^0-9]/g, ""));
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 0;
}

export function getCurrentOnboardingMonth(): string {
  return getSettlementMonthKeyForDate(new Date().toISOString(), loadSettlementDay());
}

export function isOnboardingVisible(month = getCurrentOnboardingMonth()): boolean {
  return !loadPeriodStartBalances()[month];
}

export default function OnboardingPrompt({
  onDone,
  month = getCurrentOnboardingMonth(),
}: {
  onDone: () => void;
  month?: string;
}) {
  const { periodStartBalances, setPeriodStartBalance } = useLedger();
  const [balanceInput, setBalanceInput] = useState("");

  if (periodStartBalances[month]) return null;

  const save = (skipped: boolean) => {
    setPeriodStartBalance(month, skipped ? 0 : parseKrwInput(balanceInput), skipped);
    onDone();
  };

  return (
    <div className="ldg-modal-backdrop">
      <div className="ldg-modal-content ldg-start-balance-modal">
        <div className="ldg-modal-title">지금 통장에 얼마 있어?</div>
        <input
          type="text"
          inputMode="numeric"
          className="ldg-input"
          value={balanceInput}
          onChange={(event) => setBalanceInput(event.target.value.replace(/[^0-9]/g, ""))}
          placeholder="0"
          autoFocus
        />
        <div className="ldg-modal-actions">
          <button type="button" className="ldg-submit-btn secondary" onClick={() => save(true)}>
            건너뛰기
          </button>
          <button type="button" className="ldg-submit-btn" onClick={() => save(false)}>
            저장
          </button>
        </div>
      </div>
    </div>
  );
}
