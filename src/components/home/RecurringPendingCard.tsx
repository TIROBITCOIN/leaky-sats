import { useEffect, useMemo, useState } from "react";
import type { NewTxnInput } from "../../types";
import type { SettlementPeriod } from "../../lib/settlement";
import {
  isRecurringMaterialized,
  listRecurringRules,
  mapRecurringRuleDate,
  markRecurringMaterialized,
  updateRecurringRule,
} from "../../lib/recurringRules";
import { fmtKRW } from "../../lib/format";

interface Props {
  selectedMonth: string;
  period: SettlementPeriod;
  addTxn: (input: NewTxnInput) => void;
}

export default function RecurringPendingCard({ selectedMonth, period, addTxn }: Props) {
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

  const finishRule = (ruleId: string) => {
    markRecurringMaterialized(ruleId, selectedMonth);
    setRevision((value) => value + 1);
  };

  return (
    <div className="ldg-card ldg-recurring-card">
      <div className="ldg-card-head">
        <div>
          <div className="ldg-label">반복 예정</div>
          <div className="ldg-tiny">금액을 확인한 뒤 이번 정산기간 거래로 추가하세요.</div>
        </div>
      </div>
      <div className="ldg-recurring-list">
        {pending.map((rule) => {
          const amount = Number((amounts[rule.id] ?? "").replace(/[^0-9]/g, "")) || 0;
          return (
            <div className="ldg-recurring-item" key={rule.id}>
              <div className="ldg-recurring-item-head">
                <div>
                  <div className="ldg-setting-label">{rule.title}</div>
                  <div className="ldg-setting-desc">매월 {rule.dayOfMonth}일 · {rule.isIncome ? "수입" : "지출"}</div>
                </div>
                {amount > 0 && <div className="ldg-recurring-preview">{fmtKRW(amount)}</div>}
              </div>
              <input
                className="ldg-input"
                inputMode="numeric"
                placeholder="금액 입력"
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
                  onClick={() => {
                    if (amount <= 0) return;
                    const dateKey = mapRecurringRuleDate(period, rule.dayOfMonth);
                    addTxn({
                      title: rule.title,
                      cat: rule.cat,
                      amount,
                      isIncome: rule.isIncome,
                      date: `${dateKey}T09:00`,
                    });
                    updateRecurringRule(rule.id, { lastAmount: amount });
                    finishRule(rule.id);
                  }}
                >
                  추가
                </button>
                <button type="button" className="ldg-secondary-btn" onClick={() => finishRule(rule.id)}>
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
