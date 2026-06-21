import { fmtKRWCompact } from "../../lib/format";
import { getDaysInMonth, getFirstWeekdayOfMonth, getTodayDateKey } from "../../lib/month";
import type { DayStats } from "../../lib/calendarStats";

const WEEKDAYS = ["일", "월", "화", "수", "목", "금", "토"];

interface Props {
  monthKey: string;
  byDay: Record<string, DayStats>;
  selectedDate: string | null;
  onSelectDate: (dateKey: string) => void;
}

export default function CalendarMonthView({ monthKey, byDay, selectedDate, onSelectDate }: Props) {
  const daysInMonth = getDaysInMonth(monthKey);
  const leadingBlanks = getFirstWeekdayOfMonth(monthKey);
  const todayKey = getTodayDateKey();

  const cells: (string | null)[] = [
    ...Array.from({ length: leadingBlanks }, () => null),
    ...Array.from({ length: daysInMonth }, (_, i) => `${monthKey}-${String(i + 1).padStart(2, "0")}`),
  ];

  return (
    <div>
      <div className="ldg-calendar-weekdays">
        {WEEKDAYS.map((w) => (
          <div key={w} className="ldg-calendar-weekday">
            {w}
          </div>
        ))}
      </div>
      <div className="ldg-calendar-grid">
        {cells.map((dateKey, i) => {
          if (!dateKey) return <div key={`blank-${i}`} aria-hidden="true" />;
          const day = byDay[dateKey];
          const dayNum = Number(dateKey.split("-")[2]);
          const isToday = dateKey === todayKey;
          const isSelected = dateKey === selectedDate;
          return (
            <button
              type="button"
              key={dateKey}
              className={`ldg-calendar-cell${isToday ? " today" : ""}${isSelected ? " selected" : ""}`}
              onClick={() => onSelectDate(dateKey)}
            >
              <span className="ldg-calendar-date">{dayNum}</span>
              {day && day.incomeKrw > 0 && (
                <span className="ldg-calendar-amt income">+{fmtKRWCompact(day.incomeKrw)}</span>
              )}
              {day && day.expenseKrw > 0 && (
                <span className="ldg-calendar-amt expense">-{fmtKRWCompact(day.expenseKrw)}</span>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}
