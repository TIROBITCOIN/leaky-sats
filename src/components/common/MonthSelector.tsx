import { useState } from "react";
import { getCurrentMonthKey, getMonthLabel, getNextMonthKey, getPreviousMonthKey, isCurrentMonth } from "../../lib/month";
import MonthPickerModal from "./MonthPickerModal";

interface Props {
  selectedMonth: string;
  onChangeMonth: (monthKey: string) => void;
  /** 기본은 getMonthLabel(selectedMonth)("2026년 6월"). 정산 기준일 적용 화면은 settlement.getSettlementPeriod().label
   *  ("2026년 6월 정산")로 오버라이드해서 쓴다. */
  label?: string;
}

/** 홈/통계가 공유하는 월 이동 UI — 〈 2026년 6월 〉. 월 label을 누르면 1~12월 팝업이 열린다. */
export default function MonthSelector({ selectedMonth, onChangeMonth, label }: Props) {
  const [pickerOpen, setPickerOpen] = useState(false);
  const monthLabel = label ?? getMonthLabel(selectedMonth);
  const isCurrent = isCurrentMonth(selectedMonth);

  return (
    <div className="ldg-month-selector">
      <button
        type="button"
        className="ldg-month-nav-btn"
        onClick={() => onChangeMonth(getPreviousMonthKey(selectedMonth))}
        aria-label="이전 달"
      >
        〈
      </button>
      <button
        type="button"
        className={`ldg-month-selector-label${isCurrent ? "" : " ldg-month-selector-label-past"}`}
        onClick={() => setPickerOpen(true)}
      >
        {monthLabel}
      </button>
      <button
        type="button"
        className="ldg-month-nav-btn"
        onClick={() => onChangeMonth(getNextMonthKey(selectedMonth))}
        aria-label="다음 달"
      >
        〉
      </button>

      {pickerOpen && (
        <MonthPickerModal
          selectedMonth={selectedMonth}
          onSelect={(monthKey) => {
            onChangeMonth(monthKey);
            setPickerOpen(false);
          }}
          onGoToCurrentMonth={() => {
            onChangeMonth(getCurrentMonthKey());
            setPickerOpen(false);
          }}
          onClose={() => setPickerOpen(false)}
        />
      )}
    </div>
  );
}
