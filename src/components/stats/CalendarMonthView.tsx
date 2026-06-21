import { fmtKRWCompact } from "../../lib/format";
import { enumerateDateKeysInRange, getTodayDateKey, getWeekdayOfDateKey } from "../../lib/month";
import type { SettlementPeriod } from "../../lib/settlement";
import type { DayStats } from "../../lib/calendarStats";

const WEEKDAYS = ["일", "월", "화", "수", "목", "금", "토"];

interface Props {
  period: SettlementPeriod;
  byDay: Record<string, DayStats>;
  selectedDate: string | null;
  onSelectDate: (dateKey: string) => void;
}

/** 정산기간 셀에 "6/17"처럼 월/일을 같이 보여준다 — 기간이 두 달에 걸칠 수 있어서 일자만으로는 헷갈린다. */
function monthDayLabel(dateKeyStr: string): string {
  const [, m, d] = dateKeyStr.split("-");
  return `${Number(m)}/${Number(d)}`;
}

export default function CalendarMonthView({ period, byDay, selectedDate, onSelectDate }: Props) {
  const dateKeys = enumerateDateKeysInRange(period.startDate, period.endDate);
  const leadingBlanks = getWeekdayOfDateKey(period.startDate);
  const todayKey = getTodayDateKey();

  const cells: (string | null)[] = [...Array.from({ length: leadingBlanks }, () => null), ...dateKeys];

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
          const isToday = dateKey === todayKey;
          const isSelected = dateKey === selectedDate;
          return (
            <button
              type="button"
              key={dateKey}
              className={`ldg-calendar-cell${isToday ? " today" : ""}${isSelected ? " selected" : ""}`}
              onClick={() => onSelectDate(dateKey)}
            >
              <span className="ldg-calendar-date">{monthDayLabel(dateKey)}</span>
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
