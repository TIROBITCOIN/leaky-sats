import { useEffect, useMemo, useState } from "react";
import type { NewTxnInput } from "../../types";
import type { SettlementPeriod } from "../../lib/settlement";
import {
  isRecurringMaterialized,
  listRecurringRules,
  mapRecurringRuleDate,
  markRecurringMaterialized,
  type RecurringRule,
  updateRecurringRule,
} from "../../lib/recurringRules";
import { fmtKRW } from "../../lib/format";
import { useLedger } from "../../state/LedgerContext";

interface Props {
  selectedMonth: string;
  period: SettlementPeriod;
  addTxn: (input: NewTxnInput) => void;
}

export default function RecurringPendingCard({ selectedMonth, period, addTxn }: Props) {
  const { categoriesById } = useLedger();
  const [revision, setRevision] = useState(0);
  const rules = useMemo(() => listRecurringRules(), [selectedMonth, revision]);
  const pending = rules.filter((rule) => !isRecurringMaterialized(rule.id, selectedMonth));
  const [amounts, setAmounts] = useState<Record<string, string>>({});

  useEffect(() => {
    setAmounts(
      Object.fromEntries(
        rules.map((rule) => [rule.id, rule.lastAmount ? String(rule.lastAmount) : ""])
      )
    );
  }, [selectedMonth, revision]);

  if (pending.length === 0) return null;

  const refreshPending = () => {
    setRevision((value) => value + 1);
  };

  const handleConfirm = (rule: RecurringRule, amount: number) => {
    if (amount <= 0) return;
    if (!markRecurringMaterialized(rule.id, selectedMonth)) {
      refreshPending();
      return;
    }

    const dateKey = mapRecurringRuleDate(period, rule.dayOfMonth);
    addTxn({
      title: rule.title,
      cat: rule.cat,
      amount,
      isIncome: rule.isIncome,
      date: `${dateKey}T00:00`,
      memo: "반복 항목에서 추가",
    });
    updateRecurringRule(rule.id, { lastAmount: amount });
    refreshPending();
  };

  const handleSkip = (ruleId: string) => {
    if (markRecurringMaterialized(ruleId, selectedMonth)) refreshPending();
  };

  return (
    <div className="ldg-card ldg-recurring-card">
      <div className="ldg-card-head">
        <div>
          <div className="ldg-label">매월 반복 예정 항목</div>
          <div className="ldg-tiny">
            이번 정산기간에 확인할 항목입니다. 지난 금액을 참고해 이번 달 금액을 입력하세요.
          </div>
        </div>
      </div>
      <div className="ldg-recurring-list">
        {pending.map((rule) => {
          const amount = Number((amounts[rule.id] ?? "").replace(/[^0-9]/g, "")) || 0;
          const categoryLabel = categoriesById[rule.cat]?.label ?? rule.cat;
          return (
            <div className="ldg-recurring-item" key={rule.id}>
              <div className="ldg-recurring-item-head">
                <div>
                  <div className="ldg-setting-label">{rule.title}</div>
                  <div className="ldg-setting-desc">
                    매월 {rule.dayOfMonth}일 · {rule.isIncome ? "수입" : "지출"} · {categoryLabel}
                    {rule.dayOfMonth >= 29 ? " · 없는 달은 말일" : ""}
                  </div>
                </div>
                {amount > 0 && <div className="ldg-recurring-preview">{fmtKRW(amount)}</div>}
              </div>
              <div className="ldg-recurring-amount-label">
                <span>이번 달 금액</span>
                {rule.lastAmount ? <span>최근 입력 금액 {fmtKRW(rule.lastAmount)}</span> : null}
              </div>
              <input
                className="ldg-input"
                inputMode="numeric"
                aria-label={`${rule.title} 이번 달 금액`}
                placeholder="이번 달 금액 입력"
                value={amounts[rule.id] ?? ""}
                onChange={(event) =>
                  setAmounts((current) => ({
                    ...current,
                    [rule.id]: event.target.value.replace(/[^0-9]/g, ""),
                  }))
                }
              />
              <div className="ldg-recurring-actions">
                <button
                  type="button"
                  className="ldg-submit-btn"
                  disabled={amount <= 0}
                  onClick={() => handleConfirm(rule, amount)}
                >
                  이번 달 거래로 추가
                </button>
                <button type="button" className="ldg-secondary-btn" onClick={() => handleSkip(rule.id)}>
                  이번 달 건너뛰기
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
