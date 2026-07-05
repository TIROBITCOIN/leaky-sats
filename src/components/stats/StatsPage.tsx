import { useCallback, useEffect, useMemo, useState } from "react";
import "../../styles/ledger.css";
import "../../styles/forms.css";
import { useLedger } from "../../state/LedgerContext";
import { fmtKRW, loadBtcUnit, type BtcUnit } from "../../lib/format";
import { useSelectedMonth } from "../../lib/useSelectedMonth";
import { getYearFromMonthKey } from "../../lib/month";
import { getHeldBtc } from "../../lib/heldBtc";
import { calculateMonthlyLivingCashflow, calculateSellNeeded } from "../../lib/sellCalculator";
import {
  summarizeBtcSellRecordsByMonth,
  summarizeBtcSellRecordsByYear,
  listBtcSellRecordsByMonth,
  type BtcSellRecord,
} from "../../lib/btcSellRecords";
import {
  getDefaultDateKeyForPeriod,
  getSettlementMonthKeyForDate,
  getSettlementPeriod,
  loadSettlementDay,
} from "../../lib/settlement";
import { calculateMonthCalendarStats, listTxnsForDay } from "../../lib/calendarStats";
import MonthSelector from "../common/MonthSelector";
import CalendarMonthView from "./CalendarMonthView";
import SelectedDayTransactions from "./SelectedDayTransactions";
import CategoryDonut from "./CategoryDonut";
import MonthlySellSummaryCard from "../home/MonthlySellSummaryCard";
import YearlySellSummaryCard from "../home/YearlySellSummaryCard";
import SellConfirmModal from "../home/SellConfirmModal";

export default function StatsPage() {
  const { data, categoriesById } = useLedger();
  const [settlementDay, setSettlementDay] = useState(loadSettlementDay);
  const [heldBtc, setHeldBtc] = useState(getHeldBtc);
  const [btcUnit, setBtcUnit] = useState<BtcUnit>(loadBtcUnit);
  const defaultSettlementMonthKey = getSettlementMonthKeyForDate(new Date().toISOString(), settlementDay);
  const [selectedMonth, setSelectedMonth] = useSelectedMonth(defaultSettlementMonthKey);
  const period = useMemo(() => getSettlementPeriod(selectedMonth, settlementDay), [selectedMonth, settlementDay]);
  const [selectedDate, setSelectedDate] = useState<string>(() => getDefaultDateKeyForPeriod(period));
  const [sellEditRecord, setSellEditRecord] = useState<BtcSellRecord | null>(null);
  const [, setRefreshTick] = useState(0);

  // 설정에서 정산 기준일을 바꾸거나 다른 화면에서 판매/단위를 바꾸고 돌아오면 최신 값을 다시 읽는다.
  useEffect(() => {
    const refresh = () => {
      setSettlementDay(loadSettlementDay());
      setHeldBtc(getHeldBtc());
      setBtcUnit(loadBtcUnit());
    };
    const onVisibility = () => {
      if (document.visibilityState === "visible") refresh();
    };
    document.addEventListener("visibilitychange", onVisibility);
    window.addEventListener("focus", refresh);
    return () => {
      document.removeEventListener("visibilitychange", onVisibility);
      window.removeEventListener("focus", refresh);
    };
  }, []);

  // 정산기간이 바뀌면 그 기간의 기본 날짜(오늘이 기간 안이면 오늘, 아니면 기간 시작일)로 선택일을
  // 다시 맞춘다 — 예를 들어 이전 기간의 말일을 보다가 다음 기간으로 넘어가면 그 날짜가 더 이상
  // 존재하지 않는 채로 선택된 상태로 남지 않게 한다.
  useEffect(() => {
    setSelectedDate(getDefaultDateKeyForPeriod(period));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [period.startDate, period.endDate]);

  const monthStats = useMemo(
    () => calculateMonthCalendarStats(data.txns, categoriesById, period),
    [data.txns, categoriesById, period]
  );
  const dayTxns = useMemo(() => listTxnsForDay(monthStats.txns, selectedDate), [monthStats.txns, selectedDate]);

  const yearKey = getYearFromMonthKey(selectedMonth);
  const monthlySellSummary = summarizeBtcSellRecordsByMonth(selectedMonth);
  const yearlySellSummary = summarizeBtcSellRecordsByYear(yearKey);
  const monthRecords = listBtcSellRecordsByMonth(selectedMonth);

  const { incomeKrw, expenseKrw } = calculateMonthlyLivingCashflow(data.txns, categoriesById, period);
  const sellResult = calculateSellNeeded({ incomeKrw, expenseKrw, btcKrw: data.btcKRW, heldBtc });

  // 판매 기록 수정/삭제 후 보유 BTC와 요약을 다시 계산한다.
  const refreshAfterSellChange = useCallback(() => {
    setHeldBtc(getHeldBtc());
    setRefreshTick((k) => k + 1);
  }, []);

  return (
    <div className="ldg-screen">
      <div className="ldg-content">
        <div className="ldg-page-title">통계</div>
        <div className="ldg-page-sub">달력에서 날짜를 누르면 그날의 거래를 확인할 수 있어요.</div>

        <div className="ldg-stats-month-selector">
          <MonthSelector selectedMonth={selectedMonth} onChangeMonth={setSelectedMonth} label={period.label} />
          <div className="ldg-settlement-range-label">{period.rangeLabel}</div>
        </div>

        <div className="ldg-card">
          <div className="ldg-calendar-summary">
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
            period={period}
            byDay={monthStats.byDay}
            selectedDate={selectedDate}
            onSelectDate={setSelectedDate}
          />
        </div>

        <SelectedDayTransactions dateKey={selectedDate} txns={dayTxns} />

        <div className="ldg-card">
          <div className="ldg-label" style={{ marginBottom: 10 }}>
            카테고리별 생활비 지출
          </div>
          <CategoryDonut txns={monthStats.txns} />
        </div>

        <MonthlySellSummaryCard
          summary={monthlySellSummary}
          records={monthRecords}
          unit={btcUnit}
          selectedMonth={selectedMonth}
          period={period}
          onEditRecord={(record) => setSellEditRecord(record)}
          onRecordsChanged={refreshAfterSellChange}
        />
        <YearlySellSummaryCard summary={yearlySellSummary} unit={btcUnit} year={yearKey} />
      </div>

      {sellEditRecord && (
        <SellConfirmModal
          result={sellResult}
          btcKrw={data.btcKRW}
          unit={btcUnit}
          selectedMonth={selectedMonth}
          period={period}
          editRecord={sellEditRecord}
          onClose={() => setSellEditRecord(null)}
          onSaved={() => {
            refreshAfterSellChange();
            setSellEditRecord(null);
          }}
        />
      )}
    </div>
  );
}
