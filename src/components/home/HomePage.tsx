import { useCallback, useEffect, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import "../../styles/ledger.css";
import { useLedger } from "../../state/LedgerContext";
import { loadWalletName } from "../../lib/walletName";
import { getHeldBtc } from "../../lib/heldBtc";
import { loadBtcUnit, type BtcUnit } from "../../lib/format";
import { calculateMonthlyLivingCashflow, calculateSellNeeded } from "../../lib/sellCalculator";
import { getYearFromMonthKey } from "../../lib/month";
import { useSelectedMonth } from "../../lib/useSelectedMonth";
import { getSettlementMonthKeyForDate, getSettlementPeriod, loadSettlementDay } from "../../lib/settlement";
import {
  summarizeBtcSellRecordsByMonth,
  summarizeBtcSellRecordsByYear,
  listBtcSellRecordsByMonth,
  type BtcSellRecord,
} from "../../lib/btcSellRecords";
import LightningOverlay from "../lightning/LightningOverlay";
import MonthSelector from "../common/MonthSelector";
import Slogan from "./Slogan";
import LedgerHeader from "./LedgerHeader";
import CurrencyToggle from "./CurrencyToggle";
import BalanceCard from "./BalanceCard";
import InOutCards from "./InOutCards";
import SellNeededCard from "./SellNeededCard";
import SellConfirmModal from "./SellConfirmModal";
import MonthlySellSummaryCard from "./MonthlySellSummaryCard";
import YearlySellSummaryCard from "./YearlySellSummaryCard";
import PriceWidget from "./PriceWidget";
import TxnsCard from "./TxnsCard";
import RecurringPendingCard from "./RecurringPendingCard";

export default function HomePage() {
  const { currency, setCurrency, data, categoriesById, addTxn } = useLedger();
  const [walletName, setWalletName] = useState(loadWalletName);
  const [heldBtc, setHeldBtc] = useState(getHeldBtc);
  const [btcUnit, setBtcUnit] = useState<BtcUnit>(loadBtcUnit);
  const [settlementDay, setSettlementDay] = useState(loadSettlementDay);
  const defaultSettlementMonthKey = getSettlementMonthKeyForDate(new Date().toISOString(), settlementDay);
  const [selectedMonth, setSelectedMonth] = useSelectedMonth(defaultSettlementMonthKey);
  const location = useLocation();
  const navigate = useNavigate();
  const [sellModalState, setSellModalState] = useState<{ mode: "add" } | { mode: "edit"; record: BtcSellRecord } | null>(
    null
  );
  const [sellSavedMessage, setSellSavedMessage] = useState<string | null>(null);
  const [, setRefreshTick] = useState(0);

  useEffect(() => {
    document.title = walletName;
  }, [walletName]);

  // 거래 입력 화면에서 "BTC 판매 확정"을 고르면 여기로 돌아오면서 모달을 바로 연다.
  // 한 번 소비한 뒤에는 history state를 비워서 뒤로가기로 재트리거되지 않게 한다.
  useEffect(() => {
    const state = location.state as { openSellModal?: boolean } | null;
    if (state?.openSellModal) {
      setSellModalState({ mode: "add" });
      navigate(`${location.pathname}${location.search}`, { replace: true, state: null });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

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
  }, []);

  const yearKey = getYearFromMonthKey(selectedMonth);
  const period = getSettlementPeriod(selectedMonth, settlementDay);

  const monthlySellSummary = summarizeBtcSellRecordsByMonth(selectedMonth);
  const yearlySellSummary = summarizeBtcSellRecordsByYear(yearKey);
  const monthRecords = listBtcSellRecordsByMonth(selectedMonth);

  const { incomeKrw, expenseKrw } = calculateMonthlyLivingCashflow(
    data.txns,
    categoriesById,
    period,
  );
  const netKrw = incomeKrw - expenseKrw;
  const sellResult = calculateSellNeeded({
    incomeKrw,
    expenseKrw,
    btcKrw: data.btcKRW,
    heldBtc,
    confirmedCoverageKrw: monthlySellSummary.totalKrwCovered,
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
      <LightningOverlay />
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
          <InOutCards
            incomeKrw={incomeKrw}
            expenseKrw={expenseKrw}
            netKrw={netKrw}
            btcKRW={data.btcKRW}
            currency={currency}
          />
          <RecurringPendingCard selectedMonth={selectedMonth} period={period} addTxn={addTxn} />
          <SellNeededCard
            result={sellResult}
            unit={btcUnit}
            selectedMonth={selectedMonth}
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
          <TxnsCard d={data} currency={currency} />
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
      {sellSavedMessage && (
        <div className="ldg-toast">
          <span>{sellSavedMessage}</span>
        </div>
      )}
    </div>
  );
}
