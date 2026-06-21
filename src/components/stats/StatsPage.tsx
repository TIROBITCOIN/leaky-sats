import { useEffect, useMemo, useState } from "react";
import "../../styles/ledger.css";
import "../../styles/forms.css";
import { useLedger } from "../../state/LedgerContext";
import { fmtKRW } from "../../lib/format";
import { useSelectedMonth } from "../../lib/useSelectedMonth";
import { getTodayDateKey, isCurrentMonth } from "../../lib/month";
import { calculateMonthCalendarStats, listTxnsForDay } from "../../lib/calendarStats";
import MonthSelector from "../common/MonthSelector";
import CalendarMonthView from "./CalendarMonthView";
import SelectedDayTransactions from "./SelectedDayTransactions";
import CategoryDonut from "./CategoryDonut";

export default function StatsPage() {
  const { data, currency, categoriesById } = useLedger();
  const [selectedMonth, setSelectedMonth] = useSelectedMonth();
  const [selectedDate, setSelectedDate] = useState<string>(() =>
    isCurrentMonth(selectedMonth) ? getTodayDateKey() : `${selectedMonth}-01`
  );

  // 월이 바뀌면 그 달의 기본 날짜(현재 월이면 오늘, 아니면 1일)로 선택일을 다시 맞춘다 —
  // 예를 들어 31일을 보다가 2월로 넘어가면 존재하지 않는 날짜가 선택된 채로 남지 않게 한다.
  useEffect(() => {
    setSelectedDate(isCurrentMonth(selectedMonth) ? getTodayDateKey() : `${selectedMonth}-01`);
  }, [selectedMonth]);

  const monthStats = useMemo(
    () => calculateMonthCalendarStats(data.txns, categoriesById, selectedMonth),
    [data.txns, categoriesById, selectedMonth]
  );
  const dayTxns = useMemo(() => listTxnsForDay(monthStats.txns, selectedDate), [monthStats.txns, selectedDate]);

  return (
    <div className="ldg-screen">
      <div className="ldg-content">
        <div className="ldg-page-title">통계</div>
        <div className="ldg-page-sub">달력에서 날짜를 누르면 그날의 거래를 확인할 수 있어요.</div>

        <div className="ldg-card">
          <MonthSelector selectedMonth={selectedMonth} onChangeMonth={setSelectedMonth} />
          <div className="ldg-calendar-summary" style={{ marginTop: 12 }}>
            <div>
              <div className="ldg-label">수입</div>
              <div className="ldg-inout-main pos">{fmtKRW(monthStats.incomeKrw)}</div>
            </div>
            <div>
              <div className="ldg-label">지출</div>
              <div className="ldg-inout-main neg">{fmtKRW(monthStats.expenseKrw)}</div>
            </div>
            <div>
              <div className="ldg-label">순현금흐름</div>
              <div className="ldg-inout-main">{fmtKRW(monthStats.netKrw)}</div>
            </div>
          </div>
        </div>

        <div className="ldg-card">
          <CalendarMonthView
            monthKey={selectedMonth}
            byDay={monthStats.byDay}
            selectedDate={selectedDate}
            onSelectDate={setSelectedDate}
          />
        </div>

        <SelectedDayTransactions dateKey={selectedDate} txns={dayTxns} currency={currency} btcKRW={data.btcKRW} />

        <div className="ldg-card">
          <div className="ldg-label" style={{ marginBottom: 10 }}>
            카테고리별 생활비 지출
          </div>
          <CategoryDonut txns={monthStats.txns} />
        </div>
      </div>
    </div>
  );
}
