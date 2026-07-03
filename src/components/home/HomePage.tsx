import { useCallback, useEffect, useState } from "react";
import "../../styles/ledger.css";
import { useLedger } from "../../state/LedgerContext";
import { loadWalletName } from "../../lib/walletName";
import { getHeldBtc } from "../../lib/heldBtc";
import { loadBtcUnit, type BtcUnit } from "../../lib/format";
import {
  calculateSellNeeded,
  calculateTheoreticalBalance,
  calculateUnsettledLivingCashflow,
} from "../../lib/sellCalculator";
import { getYearFromMonthKey } from "../../lib/month";
import { useSelectedMonth } from "../../lib/useSelectedMonth";
import { getSettlementMonthKeyForDate, getSettlementPeriod, loadSettlementDay } from "../../lib/settlement";
import {
  summarizeBtcSellRecordsByMonth,
  summarizeBtcSellRecordsByYear,
  listBtcSellRecordsByMonth,
  type BtcSellRecord,
} from "../../lib/btcSellRecords";
import MonthSelector from "../common/MonthSelector";
import Slogan from "./Slogan";
import LedgerHeader from "./LedgerHeader";
import CurrencyToggle from "./CurrencyToggle";
import BalanceCard from "./BalanceCard";
import SellNeededCard from "./SellNeededCard";
import SellConfirmModal from "./SellConfirmModal";
import MonthlySellSummaryCard from "./MonthlySellSummaryCard";
import YearlySellSummaryCard from "./YearlySellSummaryCard";
import PriceWidget from "./PriceWidget";
import TxnsCard from "./TxnsCard";
import RecurringPendingCard from "./RecurringPendingCard";
import OnboardingPrompt from "../onboarding/OnboardingPrompt";

export default function HomePage() {
  const { currency, setCurrency, data, categoriesById, addTxn, periodStartBalances, setPeriodActualBalance } = useLedger();
  const [walletName, setWalletName] = useState(loadWalletName);
  const [heldBtc, setHeldBtc] = useState(getHeldBtc);
  const [btcUnit, setBtcUnit] = useState<BtcUnit>(loadBtcUnit);
  const [settlementDay, setSettlementDay] = useState(loadSettlementDay);
  const defaultSettlementMonthKey = getSettlementMonthKeyForDate(new Date().toISOString(), settlementDay);
  const [selectedMonth, setSelectedMonth] = useSelectedMonth(defaultSettlementMonthKey);
  const [sellModalState, setSellModalState] = useState<{ mode: "add" } | { mode: "edit"; record: BtcSellRecord } | null>(
    null
  );
  const [sellSavedMessage, setSellSavedMessage] = useState<string | null>(null);
  const [balancePromptKey, setBalancePromptKey] = useState(0);
  const [, setRefreshTick] = useState(0);

  useEffect(() => {
    document.title = walletName;
  }, [walletName]);

  useEffect(() => {
    const refresh = () => {
      setWalletName(loadWalletName());
      setHeldBtc(getHeldBtc());
      setBtcUnit(loadBtcUnit());
      setSettlementDay(loadSettlementDay());
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
  }, [selectedMonth]);

  const yearKey = getYearFromMonthKey(selectedMonth);
  const period = getSettlementPeriod(selectedMonth, settlementDay);
  const periodBalance = periodStartBalances[selectedMonth];
  const hasPeriodStartBalance = !!periodBalance;
  const periodStartBalanceKrw = periodBalance?.startBalanceKrw ?? 0;

  const monthlySellSummary = summarizeBtcSellRecordsByMonth(selectedMonth);
  const yearlySellSummary = summarizeBtcSellRecordsByYear(yearKey);
  const monthRecords = listBtcSellRecordsByMonth(selectedMonth);

  const { incomeKrw: unsettledIncomeKrw, expenseKrw: unsettledExpenseKrw } = calculateUnsettledLivingCashflow(
    data.txns,
    categoriesById,
    period,
  );
  const theoreticalBalanceKrw = calculateTheoreticalBalance({
    periodStartBalanceKrw,
    txns: data.txns,
    categoriesById,
    period,
  });
  const sellResult = calculateSellNeeded({
    incomeKrw: unsettledIncomeKrw,
    expenseKrw: unsettledExpenseKrw,
    theoreticalBalanceKrw,
    btcKrw: data.btcKRW,
    heldBtc,
  });

  // 판매 기록 저장/수정/삭제 후 보유 BTC와 화면을 다시 계산한다. 저장 시에는 토스트도 함께 띄운다.
  const refreshAfterSellChange = useCallback(() => {
    setHeldBtc(getHeldBtc());
    setRefreshTick((k) => k + 1);
  }, []);

  const handleSellSaved = useCallback(() => {
    refreshAfterSellChange();
    setSellSavedMessage("BTC 판매가 확정되었습니다. 보유 BTC가 업데이트되었습니다.");
  }, [refreshAfterSellChange]);

  useEffect(() => {
    if (!sellSavedMessage) return;
    const id = setTimeout(() => setSellSavedMessage(null), 3000);
    return () => clearTimeout(id);
  }, [sellSavedMessage]);

  return (
    <div className="ldg-page-root">
      <div className="ldg-screen">
        <div className="ldg-content">
          <Slogan />
          <LedgerHeader d={data} walletName={walletName} />
          <CurrencyToggle value={currency} onChange={setCurrency} />
          <BalanceCard heldBtc={heldBtc} unit={btcUnit} />
          <div className="ldg-home-month-selector">
            <MonthSelector selectedMonth={selectedMonth} onChangeMonth={setSelectedMonth} label={period.label} />
            <div className="ldg-settlement-range-label">{period.rangeLabel}</div>
          </div>
          <RecurringPendingCard selectedMonth={selectedMonth} period={period} addTxn={addTxn} />
          <SellNeededCard
            result={sellResult}
            unit={btcUnit}
            selectedMonth={selectedMonth}
            btcKrw={data.btcKRW}
            unsettledIncomeKrw={unsettledIncomeKrw}
            unsettledExpenseKrw={unsettledExpenseKrw}
            theoreticalBalanceKrw={theoreticalBalanceKrw}
            balanceMissing={!hasPeriodStartBalance || periodBalance?.skipped === true}
            actualBalanceKrw={periodBalance?.actualBalanceKrw}
            onActualBalanceChange={(value) => setPeriodActualBalance(selectedMonth, value)}
            onConfirmSell={sellResult.deficitKrw > 0 ? () => setSellModalState({ mode: "add" }) : undefined}
          />
          <MonthlySellSummaryCard
            summary={monthlySellSummary}
            records={monthRecords}
            unit={btcUnit}
            selectedMonth={selectedMonth}
            onEditRecord={(record) => setSellModalState({ mode: "edit", record })}
            onRecordsChanged={refreshAfterSellChange}
          />
          <YearlySellSummaryCard summary={yearlySellSummary} unit={btcUnit} year={yearKey} />
          <PriceWidget d={data} />
          <TxnsCard d={data} currency={currency} selectedMonth={selectedMonth} period={period} />
        </div>
      </div>
      {sellModalState && (
        <SellConfirmModal
          result={sellResult}
          btcKrw={data.btcKRW}
          unit={btcUnit}
          selectedMonth={selectedMonth}
          period={period}
          editRecord={sellModalState.mode === "edit" ? sellModalState.record : undefined}
          onClose={() => setSellModalState(null)}
          onSaved={handleSellSaved}
        />
      )}
      {!hasPeriodStartBalance && (
        <OnboardingPrompt key={`${selectedMonth}-${balancePromptKey}`} month={selectedMonth} onDone={() => setBalancePromptKey((k) => k + 1)} />
      )}
      {sellSavedMessage && (
        <div className="ldg-toast">
          <span>{sellSavedMessage}</span>
        </div>
      )}
    </div>
  );
}
