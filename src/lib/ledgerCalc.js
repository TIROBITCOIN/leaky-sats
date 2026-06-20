export const SATS_PER_BTC = 100_000_000;
export const BTC_BUY_CATEGORY_ID = "btc_buy";
export const BTC_SELL_CATEGORY_ID = "btc_sell";

export function safeAmount(txn) {
  return typeof txn?.amount === "number" && Number.isFinite(txn.amount) ? txn.amount : 0;
}

export function safeBtcPrice(price) {
  return typeof price === "number" && Number.isFinite(price) && price > 0 ? price : 0;
}

export function parseTxnDate(txn) {
  if (typeof txn?.date !== "string") return null;
  const date = new Date(txn.date);
  return Number.isNaN(date.getTime()) ? null : date;
}

export function getAnchorDate(txns, fallback = new Date()) {
  const dates = txns.map(parseTxnDate).filter(Boolean);
  if (dates.length === 0) return fallback;
  return dates.reduce((latest, date) => (date.getTime() > latest.getTime() ? date : latest), dates[0]);
}

export function isSamePeriod(date, anchor, range) {
  if (range === "day") {
    return (
      date.getFullYear() === anchor.getFullYear() &&
      date.getMonth() === anchor.getMonth() &&
      date.getDate() === anchor.getDate()
    );
  }
  if (range === "month") {
    return date.getFullYear() === anchor.getFullYear() && date.getMonth() === anchor.getMonth();
  }
  return date.getFullYear() === anchor.getFullYear();
}

export function filterTxnsByPeriod(txns, range = "month", anchor = getAnchorDate(txns)) {
  return txns.filter((txn) => {
    const date = parseTxnDate(txn);
    return date ? isSamePeriod(date, anchor, range) : false;
  });
}

export function calculateCashflow(txns) {
  return txns.reduce(
    (summary, txn) => {
      const amount = safeAmount(txn);
      if (amount > 0) summary.income += amount;
      if (amount < 0) summary.expense += Math.abs(amount);
      summary.net = summary.income - summary.expense;
      return summary;
    },
    { income: 0, expense: 0, net: 0 }
  );
}

export function calculatePeriodStats(txns, range = "month", anchor = getAnchorDate(txns)) {
  const periodTxns = filterTxnsByPeriod(txns, range, anchor);
  return { txns: periodTxns, ...calculateCashflow(periodTxns) };
}

export function isInvestmentExpense(txn) {
  return txn?.cat === BTC_BUY_CATEGORY_ID;
}

export function calculateCategorySpending(txns, options = {}) {
  const includeInvestments = options.includeInvestments === true;
  const byCategory = new Map();

  for (const txn of txns) {
    const amount = safeAmount(txn);
    if (amount >= 0) continue;
    if (!includeInvestments && isInvestmentExpense(txn)) continue;

    const categoryId = typeof txn?.cat === "string" && txn.cat ? txn.cat : "uncategorized";
    const current = byCategory.get(categoryId) ?? {
      cat: categoryId,
      catLabel: typeof txn?.catLabel === "string" && txn.catLabel ? txn.catLabel : categoryId,
      amount: 0,
      kind: isInvestmentExpense(txn) ? "investment" : "living",
    };
    current.amount += Math.abs(amount);
    byCategory.set(categoryId, current);
  }

  const entries = Array.from(byCategory.values()).sort((a, b) => b.amount - a.amount);
  const total = entries.reduce((sum, entry) => sum + entry.amount, 0);
  return { entries, total };
}

export function calculateSpendingBreakdown(txns) {
  const livingExpense = calculateCategorySpending(txns, { includeInvestments: false }).total;
  const investmentExpense = txns.reduce((sum, txn) => {
    const amount = safeAmount(txn);
    return amount < 0 && isInvestmentExpense(txn) ? sum + Math.abs(amount) : sum;
  }, 0);
  return {
    livingExpense,
    investmentExpense,
    totalExpense: livingExpense + investmentExpense,
  };
}

export function txnToBitcoinSats(txn) {
  const amount = Math.abs(safeAmount(txn));
  const btcAt = safeBtcPrice(txn?.btcAt);
  if (amount <= 0 || btcAt <= 0) return 0;
  return Math.round((amount / btcAt) * SATS_PER_BTC);
}

export function calculateBitcoinPortfolio(txns, currentBtcKRW) {
  let totalBuyKrw = 0;
  let totalSellKrw = 0;
  let totalBuySats = 0;
  let totalSellSats = 0;

  const portfolioTxns = txns
    .filter((txn) => txn?.cat === BTC_BUY_CATEGORY_ID || txn?.cat === BTC_SELL_CATEGORY_ID)
    .filter((txn) => parseTxnDate(txn) && txnToBitcoinSats(txn) > 0)
    .slice()
    .sort((a, b) => parseTxnDate(a).getTime() - parseTxnDate(b).getTime());

  const accumulation = [];
  let cumulativeSats = 0;

  for (const txn of portfolioTxns) {
    const sats = txnToBitcoinSats(txn);
    const amount = Math.abs(safeAmount(txn));
    if (txn.cat === BTC_BUY_CATEGORY_ID) {
      totalBuyKrw += amount;
      totalBuySats += sats;
      cumulativeSats += sats;
    } else {
      totalSellKrw += amount;
      totalSellSats += sats;
      cumulativeSats = Math.max(0, cumulativeSats - sats);
    }
    accumulation.push({ id: txn.id, date: txn.date, satsDelta: txn.cat === BTC_BUY_CATEGORY_ID ? sats : -sats, cumulativeSats });
  }

  const holdingSats = Math.max(0, totalBuySats - totalSellSats);
  const holdingBtc = holdingSats / SATS_PER_BTC;
  const currentPrice = safeBtcPrice(currentBtcKRW);
  const valuationKrw = currentPrice > 0 ? holdingBtc * currentPrice : 0;
  const averageCostKrwPerBtc = totalBuySats > 0 ? totalBuyKrw / (totalBuySats / SATS_PER_BTC) : 0;

  // MVP policy: this is not FIFO or tax-grade realized P/L. Sells reduce net capital only.
  const netInvestedKrw = totalBuyKrw - totalSellKrw;
  const unrealizedPnlKrw = valuationKrw - netInvestedKrw;
  const unrealizedPnlPct = netInvestedKrw > 0 ? (unrealizedPnlKrw / netInvestedKrw) * 100 : 0;

  return {
    totalBuyKrw,
    totalSellKrw,
    netInvestedKrw,
    totalBuySats,
    totalSellSats,
    holdingSats,
    holdingBtc,
    currentPrice,
    valuationKrw,
    averageCostKrwPerBtc,
    unrealizedPnlKrw,
    unrealizedPnlPct,
    accumulation,
  };
}
