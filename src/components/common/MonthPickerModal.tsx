import { useEffect, useState } from "react";
import { getCurrentMonthKey, getYearFromMonthKey } from "../../lib/month";

const MONTHS = Array.from({ length: 12 }, (_, i) => i + 1);

interface Props {
  selectedMonth: string; // "YYYY-MM"
  onSelect: (monthKey: string) => void;
  onGoToCurrentMonth: () => void;
  onClose: () => void;
}

export default function MonthPickerModal({ selectedMonth, onSelect, onGoToCurrentMonth, onClose }: Props) {
  const selectedYear = Number(getYearFromMonthKey(selectedMonth));
  const selectedMonthNum = Number(selectedMonth.split("-")[1]);
  const [year, setYear] = useState(selectedYear);

  const currentMonthKey = getCurrentMonthKey();
  const currentYear = Number(getYearFromMonthKey(currentMonthKey));
  const currentMonthNum = Number(currentMonthKey.split("-")[1]);

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [onClose]);

  const monthKeyFor = (m: number) => `${year}-${String(m).padStart(2, "0")}`;

  return (
    <div className="ldg-modal-backdrop" onClick={onClose}>
      <div className="ldg-modal-content" onClick={(e) => e.stopPropagation()}>
        <div className="ldg-month-picker-year">
          <button type="button" className="ldg-month-nav-btn" onClick={() => setYear((y) => y - 1)} aria-label="이전 연도">
            〈
          </button>
          <div className="ldg-month-picker-year-label">{year}년</div>
          <button type="button" className="ldg-month-nav-btn" onClick={() => setYear((y) => y + 1)} aria-label="다음 연도">
            〉
          </button>
        </div>

        <div className="ldg-month-picker-grid">
          {MONTHS.map((m) => {
            const isSelected = year === selectedYear && m === selectedMonthNum;
            const isThisMonth = year === currentYear && m === currentMonthNum;
            return (
              <button
                type="button"
                key={m}
                className={`ldg-month-picker-cell${isSelected ? " selected" : ""}${isThisMonth ? " today" : ""}`}
                onClick={() => onSelect(monthKeyFor(m))}
              >
                {m}월
              </button>
            );
          })}
        </div>

        <button type="button" className="ldg-secondary-btn" onClick={onGoToCurrentMonth}>
          이번 달로 이동
        </button>
      </div>
    </div>
  );
}
