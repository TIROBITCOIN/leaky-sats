import type { ReactNode } from "react";
import type { MonthSellSummary } from "../../lib/btcSellRecords";
import type { SellResult } from "../../lib/sellCalculator";
import { fmtBtcValue, fmtKRW, type BtcUnit } from "../../lib/format";
import { getMonthLabel } from "../../lib/month";

interface Props {
  result: SellResult;
  unit: BtcUnit;
  selectedMonth: string;
  monthlySellSummary: MonthSellSummary;
  btcKrw: number;
  onConfirmSell?: () => void;
}

function satsFromKrw(krw: number, btcKrw: number): number {
  return Number.isFinite(btcKrw) && btcKrw > 0 ? Math.round((krw / btcKrw) * 100_000_000) : 0;
}

function btcFromSats(sats: number): number {
  return sats / 100_000_000;
}

function BtcAndSats({ btc, sats, unit }: { btc: number; sats: number; unit: BtcUnit }) {
  return (
    <span className="ldg-sell-value">
      <strong>{fmtBtcValue(btc, unit)}</strong>
      <span className="ldg-balance-sub ldg-sell-sub">
        {sats.toLocaleString("en-US")} sats / {btc.toFixed(8)} BTC
      </span>
    </span>
  );
}

function formatDoneBtc(btc: number): string {
  const safeBtc = Number.isFinite(btc) ? btc : 0;
  return `${safeBtc.toFixed(8)} BTC`;
}

function DoneAmount({ btc, sats }: { btc: number; sats: number }) {
  return (
    <span className="ldg-done-val ldg-btc-val">
      <strong>{sats.toLocaleString("en-US")} sats</strong>
      <span className="sub">{formatDoneBtc(btc)}</span>
    </span>
  );
}

function DoneRow({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="ldg-done-row">
      <span className="ldg-done-label">{label}</span>
      {children}
    </div>
  );
}

export default function SellNeededCard({ result, unit, selectedMonth, monthlySellSummary, btcKrw, onConfirmSell }: Props) {
  const { deficitKrw, sellBtc, sellSats, totalDeficitKrw } = result;
  const everHadDeficit = totalDeficitKrw > 0;
  const sellRecorded = everHadDeficit && monthlySellSummary.totalKrwCovered >= totalDeficitKrw;
  const needSell = deficitKrw > 0 && !sellRecorded;

  if (!everHadDeficit) return null;

  const monthLabel = getMonthLabel(selectedMonth);
  const expectedTotalSats = satsFromKrw(totalDeficitKrw, btcKrw);
  const expectedTotalBtc = btcFromSats(expectedTotalSats);
  const actualSoldBtc = monthlySellSummary.totalSatsSold / 100_000_000;

  return (
    <div className="ldg-card">
      {sellRecorded ? (
        <>
          <div className="ldg-settlement-done">판매 완료</div>
          <div className="ldg-done-list">
            <DoneRow label="예상 판매량">
              <DoneAmount btc={expectedTotalBtc} sats={expectedTotalSats} />
            </DoneRow>
            <DoneRow label="실제 판매량">
              <DoneAmount btc={actualSoldBtc} sats={monthlySellSummary.totalSatsSold} />
            </DoneRow>
            <DoneRow label="판매 후 BTC">
              <span className="ldg-done-val ldg-btc-val">
                <strong>{formatDoneBtc(result.heldBtc)}</strong>
              </span>
            </DoneRow>
          </div>
        </>
      ) : needSell ? (
        <>
          <div className="ldg-label">판매해야 하는 비트코인</div>
          <div className="ldg-sell-deficit-label">{monthLabel} 부족분</div>
          <div className="ldg-sell-deficit-value ldg-money-val">{fmtKRW(deficitKrw)}</div>
          <div className="ldg-sell-needed-row">
            <span>현재 BTC 가격 기준 예상 판매량</span>
            <BtcAndSats btc={sellBtc} sats={sellSats} unit={unit} />
          </div>
          {onConfirmSell && (
            <button type="button" className="ldg-submit-btn" style={{ marginTop: 12 }} onClick={onConfirmSell}>
              BTC 판매 확정
            </button>
          )}
        </>
      ) : null}
    </div>
  );
}
