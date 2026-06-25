import { useState } from "react";
import { deleteRecurringRule, listRecurringRules } from "../../lib/recurringRules";
import { fmtKRW } from "../../lib/format";
import { useLedger } from "../../state/LedgerContext";

export default function RecurringRulesSettings() {
  const { categoriesById } = useLedger();
  const [rules, setRules] = useState(listRecurringRules);

  return (
    <div className="ldg-card">
      <div className="ldg-setting-label">매월 반복 예정 항목 관리</div>
      <div className="ldg-setting-desc" style={{ marginBottom: 8 }}>
        날짜·항목·카테고리를 저장하고, 금액은 매월 확인 후 거래로 추가합니다.{" "}
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
                매월 {rule.dayOfMonth}일 · {rule.isIncome ? "수입" : "지출"} ·{" "}
                {categoriesById[rule.cat]?.label ?? rule.cat}
                {rule.dayOfMonth >= 29 ? " · 없는 달은 말일" : ""}
              </div>
              <div className="ldg-setting-desc">
                {rule.lastAmount
                  ? `최근 입력 금액 ${fmtKRW(rule.lastAmount)} · 다음 입력 때 기본 제안`
                  : "최근 입력 금액 없음 · 다음 입력 때 직접 입력"}
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
