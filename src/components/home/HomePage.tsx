import { useCallback, useEffect, useState } from "react";
import "../../styles/ledger.css";
import { useLedger } from "../../state/LedgerContext";
import { loadWalletName } from "../../lib/walletName";
import { getHeldBtc } from "../../lib/heldBtc";
import { loadBtcUnit, type BtcUnit } from "../../lib/format";
import { calculateMonthlyLivingCashflow, calculateSellNeeded } from "../../lib/sellCalculator";
import { getCurrentMonthKey } from "../../lib/month";
import {
  summarizeBtcSellRecordsByMonth,
  summarizeBtcSellRecordsByYear,
  listBtcSellRecordsByMonth,
} from "../../lib/btcSellRecords";
import LightningOverlay from "../lightning/LightningOverlay";
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
import ChartCard from "./ChartCard";
import TxnsCard from "./TxnsCard";

export default function HomePage() {
  const { currency, setCurrency, data, categoriesById } = useLedger();
  const [walletName, setWalletName] = useState(loadWalletName);
  const [heldBtc, setHeldBtc] = useState(getHeldBtc);
  const [btcUnit, setBtcUnit] = useState<BtcUnit>(loadBtcUnit);
  const [sellModalOpen, setSellModalOpen] = useState(false);
  const [, setRefreshTick] = useState(0);

  useEffect(() => {
    document.title = walletName;
  }, [walletName]);

  // Re-read wallet name, held BTC, and btcUnit when the page becomes visible
  useEffect(() => {
    const refresh = () => {
      setWalletName(loadWalletName());
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

  const monthKey = getCurrentMonthKey();
  const yearKey = monthKey.split("-")[0];

  const monthlySellSummary = summarizeBtcSellRecordsByMonth(monthKey);
  const yearlySellSummary = summarizeBtcSellRecordsByYear(yearKey);
  const monthRecords = listBtcSellRecordsByMonth(monthKey);

  const { incomeKrw, expenseKrw } = calculateMonthlyLivingCashflow(
    data.txns,
    categoriesById,
  );
  const sellResult = calculateSellNeeded({
    incomeKrw,
    expenseKrw,
    btcKrw: data.btcKRW,
    heldBtc,
    confirmedCoverageKrw: monthlySellSummary.totalKrwCovered,
  });

  const handleSellSaved = useCallback(() => {
    setHeldBtc(getHeldBtc());
    setRefreshTick((k) => k + 1);
  }, []);

  return (
    <div className="ldg-page-root">
      <LightningOverlay />
      <div className="ldg-screen">
        <div className="ldg-content">
          <Slogan />
          <LedgerHeader d={data} walletName={walletName} />
          <CurrencyToggle value={currency} onChange={setCurrency} />
          <BalanceCard d={data} heldBtc={heldBtc} unit={btcUnit} />
          <InOutCards d={data} currency={currency} />
          <SellNeededCard
            result={sellResult}
            unit={btcUnit}
            onConfirmSell={sellResult.deficitKrw > 0 ? () => setSellModalOpen(true) : undefined}
          />
          <MonthlySellSummaryCard summary={monthlySellSummary} records={monthRecords} unit={btcUnit} />
          <YearlySellSummaryCard summary={yearlySellSummary} unit={btcUnit} />
          <PriceWidget d={data} />
          <ChartCard />
          <TxnsCard d={data} currency={currency} />
        </div>
      </div>
      {sellModalOpen && (
        <SellConfirmModal
          result={sellResult}
          btcKrw={data.btcKRW}
          unit={btcUnit}
          onClose={() => setSellModalOpen(false)}
          onSaved={handleSellSaved}
        />
      )}
    </div>
  );
}
