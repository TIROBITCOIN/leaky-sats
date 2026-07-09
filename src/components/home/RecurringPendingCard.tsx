import { useEffect, useMemo, useState } from "react";
import type { NewTxnInput } from "../../types";
import type { SettlementPeriod } from "../../lib/settlement";
import {
  getRecurringDueDate,
  listDuePendingRecurringRules,
  mapRecurringRuleDate,
  markRecurringMaterialized,
  type RecurringRule,
  updateRecurringRule,
} from "../../lib/recurringRules";
import { getTodayDateKey } from "../../lib/month";
import { formatKrwInput, fmtKRW, parseKrwInput } from "../../lib/format";
import { useLedger } from "../../state/LedgerContext";

interface Props {
  selectedMonth: string;
  period: SettlementPeriod;
  addTxn: (input: NewTxnInput) => void;
}

export default function RecurringPendingCard({ selectedMonth, period, addTxn }: Props) {
  const { categoriesById } = useLedger();
  const [revision, setRevision] = useState(0);
  const todayKey = getTodayDateKey();
  const periodStart = period.startDate;
  const periodEnd = period.endDate;
  // 예정일(due)이 오늘 이하이고 아직 materialize 되지 않은 규칙만 노출. 미래 날짜 선노출 방지.
  const pending = useMemo(
    () => listDuePendingRecurringRules(selectedMonth, { startDate: periodStart, endDate: periodEnd }, todayKey),
    [selectedMonth, periodStart, periodEnd, todayKey, revision]
  );
  const [amounts, setAmounts] = useState<Record<string, string>>({});

  useEffect(() => {
    const list = listDuePendingRecurringRules(
      selectedMonth,
      { startDate: periodStart, endDate: periodEnd },
      getTodayDateKey()
    );
    setAmounts(
      Object.fromEntries(
        list.map((rule) => [rule.id, rule.lastAmount ? formatKrwInput(rule.lastAmount) : ""])
      )
    );
  }, [selectedMonth, periodStart, periodEnd, revision]);

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
      recurringRuleId: rule.id,
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
            예정일이 된 항목만 표시됩니다. 지난 금액을 참고해 이번 달 금액을 입력하세요.
          </div>
        </div>
      </div>
      <div className="ldg-recurring-list">
        {pending.map((rule) => {
          const amount = parseKrwInput(amounts[rule.id] ?? "");
          const categoryLabel = categoriesById[rule.cat]?.label ?? rule.cat;
          const dueDate = getRecurringDueDate(period, rule.dayOfMonth);
          return (
            <div className="ldg-recurring-item" key={rule.id}>
              <div className="ldg-recurring-item-head">
                <div>
                  <div className="ldg-setting-label">{rule.title}</div>
                  <div className="ldg-setting-desc">
                    {dueDate.slice(5).replace("-", "/")} · 매월 {rule.dayOfMonth}일 ·{" "}
                    {rule.isIncome ? "수입" : "지출"} · {categoryLabel}
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
                type="text"
                inputMode="numeric"
                pattern="[0-9,]*"
                autoComplete="off"
                enterKeyHint="done"
                aria-label={`${rule.title} 이번 달 금액`}
                placeholder="이번 달 금액 입력"
                value={amounts[rule.id] ?? ""}
                onChange={(event) =>
                  setAmounts((current) => ({
                    ...current,
                    [rule.id]: formatKrwInput(event.target.value),
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
