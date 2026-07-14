import { useCallback, useEffect, useState } from "react";
import "../../styles/ledger.css";
import { useLedger } from "../../state/LedgerContext";
import { loadWalletName } from "../../lib/walletName";
import { getHeldBtc } from "../../lib/heldBtc";
import { loadBtcUnit, type BtcUnit } from "../../lib/format";
import { calculateMonthlyLivingCashflow, calculateSellNeeded } from "../../lib/sellCalculator";
import { useSelectedMonth } from "../../lib/useSelectedMonth";
import { getSettlementMonthKeyForDate, getSettlementPeriod, loadSettlementDay } from "../../lib/settlement";
import { listBtcSellRecordsByMonth, summarizeBtcSellRecordsByMonth, type BtcSellRecord } from "../../lib/btcSellRecords";
import { getAggregatedTotalSats, getHeldBtcMode, WALLET_SYNC_EVENT } from "../../lib/walletConfig";
import { syncAllWallets } from "../../lib/walletSync";
import MonthSelector from "../common/MonthSelector";
import Slogan from "./Slogan";
import LedgerHeader from "./LedgerHeader";
import CurrencyToggle from "./CurrencyToggle";
import BalanceCard from "./BalanceCard";
import InOutCards from "./InOutCards";
import SellNeededCard from "./SellNeededCard";
import SellConfirmModal from "./SellConfirmModal";
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
  const [sellModalState, setSellModalState] = useState<{ mode: "add" } | { mode: "edit"; record: BtcSellRecord } | null>(
    null
  );
  const [sellSavedMessage, setSellSavedMessage] = useState<string | null>(null);
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
    const refreshWalletSyncView = () => {
      setHeldBtc(getHeldBtc());
      setRefreshTick((k) => k + 1);
    };
    const onVisibility = () => {
      if (document.visibilityState === "visible") {
        refresh();
      }
    };
    const onWalletSync = () => refreshWalletSyncView();
    document.addEventListener("visibilitychange", onVisibility);
    window.addEventListener("focus", refresh);
    window.addEventListener(WALLET_SYNC_EVENT, onWalletSync);
    return () => {
      document.removeEventListener("visibilitychange", onVisibility);
      window.removeEventListener("focus", refresh);
      window.removeEventListener(WALLET_SYNC_EVENT, onWalletSync);
    };
  }, [selectedMonth]);

  const period = getSettlementPeriod(selectedMonth, settlementDay);

  const monthlySellSummary = summarizeBtcSellRecordsByMonth(selectedMonth);
  const monthSellRecords = listBtcSellRecordsByMonth(selectedMonth);

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
  });

  // 판매 기록 저장/수정/삭제 후 보유 BTC와 화면을 다시 계산한다. 저장 시에는 토스트도 함께 띄운다.
  const refreshAfterSellChange = useCallback(() => {
    setHeldBtc(getHeldBtc());
    setRefreshTick((k) => k + 1);
  }, []);

  const handleSellSaved = useCallback(() => {
    refreshAfterSellChange();
    setSellSavedMessage("BTC 판매가 확정되었습니다. 보유 BTC가 업데이트되었습니다.");
    if (getHeldBtcMode() === "wallet-sync") {
      void syncAllWallets({ force: true, retryAfterRunning: true })
        .then(() => setHeldBtc(getHeldBtc()))
        .catch(() => undefined);
    }
  }, [refreshAfterSellChange]);

  useEffect(() => {
    if (!sellSavedMessage) return;
    const id = setTimeout(() => setSellSavedMessage(null), 3000);
    return () => clearTimeout(id);
  }, [sellSavedMessage]);

  const syncMeta = (() => {
    const mode = getHeldBtcMode();
    if (mode !== "wallet-sync") {
      return { mode, walletCount: 0, lastSyncLabel: "", unconfirmedSats: 0, wallets: [] };
    }
    const agg = getAggregatedTotalSats();
    const freshnessAt = agg.anyPartialOrOffline
      ? agg.oldestIncludedFetchedAt
      : agg.lastFetchedAt;
    let lastSyncLabel = "동기화 기록 없음";
    if (freshnessAt) {
      const diffMs = Date.now() - new Date(freshnessAt).getTime();
      if (Number.isFinite(diffMs) && diffMs < 60_000) lastSyncLabel = "방금 전 동기화";
      else if (diffMs < 3_600_000) lastSyncLabel = `${Math.floor(diffMs / 60_000)}분 전 동기화`;
      else if (diffMs < 86_400_000) lastSyncLabel = `${Math.floor(diffMs / 3_600_000)}시간 전 동기화`;
      else lastSyncLabel = "오래전 동기화";
    }
    return {
      mode,
      walletCount: agg.walletCount,
      lastSyncLabel,
      unconfirmedSats: agg.unconfirmedSats,
      wallets: agg.wallets.map((w) => ({
        id: w.id,
        label: w.label,
        totalSats: w.totalSats,
        unconfirmedSats: w.unconfirmedSats,
        status: w.status,
      })),
    };
  })();

  return (
    <div className="ldg-page-root">
      <div className="ldg-screen">
        <div className="ldg-content">
          <Slogan />
          <LedgerHeader d={data} walletName={walletName} />
          <CurrencyToggle value={currency} onChange={setCurrency} />
          <BalanceCard heldBtc={heldBtc} unit={btcUnit} syncMeta={syncMeta} />
          <div className="ldg-home-month-selector">
            <MonthSelector selectedMonth={selectedMonth} onChangeMonth={setSelectedMonth} label={period.rangeLabel} />
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
            monthlySellSummary={monthlySellSummary}
            records={monthSellRecords}
            onConfirmSell={sellResult.deficitKrw > 0 ? () => setSellModalState({ mode: "add" }) : undefined}
            onEditRecord={(record) => setSellModalState({ mode: "edit", record })}
            onRecordsChanged={refreshAfterSellChange}
          />
          <PriceWidget d={data} />
          <TxnsCard d={data} selectedMonth={selectedMonth} period={period} />
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
