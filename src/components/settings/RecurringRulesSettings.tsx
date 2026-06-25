import { useState } from "react";
import { deleteRecurringRule, listRecurringRules } from "../../lib/recurringRules";
import { fmtKRW } from "../../lib/format";

export default function RecurringRulesSettings() {
  const [rules, setRules] = useState(listRecurringRules);

  return (
    <div className="ldg-card">
      <div className="ldg-setting-label">반복 항목 관리</div>
      <div className="ldg-setting-desc" style={{ marginBottom: 8 }}>
        규칙을 삭제해도 이미 만든 과거 거래는 유지됩니다.
      </div>
      {rules.length === 0 ? (
        <div className="ldg-page-sub">등록된 반복 항목이 없습니다.</div>
      ) : (
        rules.map((rule) => (
          <div className="ldg-setting-row" key={rule.id}>
            <div>
              <div className="ldg-setting-label">{rule.title}</div>
              <div className="ldg-setting-desc">
                매월 {rule.dayOfMonth}일 · {rule.isIncome ? "수입" : "지출"}
                {rule.lastAmount ? ` · 최근 ${fmtKRW(rule.lastAmount)}` : ""}
                {rule.dayOfMonth >= 29 ? " · 없는 달은 말일" : ""}
              </div>
            </div>
            <button
              type="button"
              className="ldg-link danger"
              onClick={() => {
                deleteRecurringRule(rule.id);
                setRules(listRecurringRules());
              }}
            >
              삭제
            </button>
          </div>
        ))
      )}
    </div>
  );
}
