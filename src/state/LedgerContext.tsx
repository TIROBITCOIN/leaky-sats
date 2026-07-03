import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useReducer,
  useRef,
  useState,
  type ReactNode,
} from "react";
import type { CategoryDef, Currency, LedgerData, NewTxnInput, Txn } from "../types";
import { DUMMY } from "../lib/dummyData";
import { BUILT_IN_CATEGORIES, DEFAULT_FALLBACK, PROTECTED_IDS, isCanonicalCategory } from "../lib/categories";
import { formatTxnTime, formatCategoryLabel } from "../lib/format";
import {
  fetchLivePrices,
  type PriceFetchResult,
  type PriceSource,
  type PriceSourceMeta,
} from "../lib/priceApi";
import {
  loadCurrency,
  loadRefreshInterval,
  normalizeRefreshInterval,
  saveCurrency,
  saveRefreshInterval,
} from "../lib/preferences";
import {
  applyPriceFetchResult,
  createInitialPriceFreshness,
  getLatestPriceUpdateAt,
  hasPriceFallback,
  isPriceStale as isPriceFreshnessStale,
  type PriceFreshness,
  type PriceSourceUpdatedAt,
} from "../lib/priceFreshness";

export type PriceStatus = "idle" | "loading" | "ok" | "error";

interface PriceMeta {
  status: PriceStatus;
  error: string | null;
  btcKrwIsFallback: boolean;
  freshness: PriceFreshness;
  sourceMeta: PriceSourceMeta;
}

export const CATEGORIES_STORAGE_KEY = "myledger.categories.v1";
export const TXNS_STORAGE_KEY = "myledger.txns.v1";
export const PENDING_UNDO_STORAGE_KEY = "myledger.pendingUndo.v1";
const UNDO_WINDOW_MS = 5000;

interface TxnSummary {
  balance: number;
  income: number;
  expense: number;
}

interface PersistedTxnsState {
  txns: Txn[];
  nextTxnId: number;
}

interface PersistedUndoState {
  txn: Txn;
  index: number;
  expiresAt: number;
}

interface State {
  currency: Currency;
  data: LedgerData;
  nextTxnId: number;
  refreshIntervalMs: number;
  priceMeta: PriceMeta;
  categories: CategoryDef[];
}

export interface NewCategoryInput {
  label: string;
  fg: string;
  icon: string;
  group: "expense" | "income";
}

export interface PendingUndo {
  txn: Txn;
  index: number;
  expiresAt: number;
}

type Action =
  | { type: "SET_CURRENCY"; currency: Currency }
  | { type: "ADD_TXN"; input: NewTxnInput }
  | { type: "UPDATE_TXN"; id: number; input: NewTxnInput }
  | { type: "SET_TXN_SETTLED"; id: number; settled: boolean }
  | { type: "DELETE_TXN"; id: number }
  | { type: "RESTORE_TXN"; txn: Txn; index: number }
  | { type: "SET_REFRESH_INTERVAL"; ms: number }
  | { type: "PRICE_FETCH_START" }
  | ({ type: "PRICE_FETCH_SETTLED" } & PriceFetchResult)
  | { type: "ADD_CATEGORY"; category: CategoryDef }
  | { type: "UPDATE_CATEGORY"; id: string; patch: Partial<Pick<CategoryDef, "label" | "fg" | "icon">> }
  | { type: "DELETE_CATEGORY"; id: string }
  | { type: "MIGRATE_LEGACY_CATEGORIES" };

interface LedgerContextValue {
  currency: Currency;
  setCurrency: (c: Currency) => void;
  data: LedgerData;
  addTxn: (input: NewTxnInput) => void;
  updateTxn: (id: number, input: NewTxnInput) => void;
  setTxnSettled: (id: number, settled: boolean) => void;
  deleteTxn: (id: number) => void;
  pendingUndo: PendingUndo | null;
  undoLastDelete: () => void;
  refreshIntervalMs: number;
  setRefreshIntervalMs: (ms: number) => void;
  priceStatus: PriceStatus;
  priceError: string | null;
  priceUpdatedAt: number | null;
  isPriceFallback: boolean;
  isPriceStale: boolean;
  btcKrwIsFallback: boolean;
  priceStaleSources: PriceSource[];
  priceSourceUpdatedAt: PriceSourceUpdatedAt;
  priceSourceMeta: PriceSourceMeta;
  refreshPrices: () => void;
  categories: CategoryDef[];
  categoriesById: Record<string, CategoryDef>;
  addCategory: (input: NewCategoryInput) => void;
  updateCategory: (id: string, patch: Partial<Pick<CategoryDef, "label" | "fg" | "icon">>) => void;
  deleteCategory: (id: string) => void;
  migrateLegacyCategories: () => void;
}

const LedgerContext = createContext<LedgerContextValue | null>(null);

function calculateTxnSummary(txns: Txn[]): TxnSummary {
  return txns.reduce<TxnSummary>(
    (summary, txn) => {
      const amount = Number.isFinite(txn.amount) ? txn.amount : 0;
      return {
        balance: summary.balance + amount,
        income: summary.income + (amount > 0 ? amount : 0),
        expense: summary.expense + (amount < 0 ? -amount : 0),
      };
    },
    { balance: 0, income: 0, expense: 0 }
  );
}

function withTxnSummary(data: LedgerData, txns: Txn[]): LedgerData {
  return { ...data, ...calculateTxnSummary(txns), txns };
}

function isValidTxn(value: unknown): value is Txn {
  if (!value || typeof value !== "object") return false;
  const txn = value as Partial<Txn>;
  return (
    typeof txn.id === "number" &&
    Number.isFinite(txn.id) &&
    typeof txn.title === "string" &&
    typeof txn.cat === "string" &&
    typeof txn.catLabel === "string" &&
    typeof txn.time === "string" &&
    typeof txn.date === "string" &&
    !Number.isNaN(new Date(txn.date).getTime()) &&
    typeof txn.amount === "number" &&
    Number.isFinite(txn.amount) &&
    typeof txn.btcAt === "number" &&
    Number.isFinite(txn.btcAt) &&
    txn.btcAt > 0 &&
    (txn.settled === undefined || typeof txn.settled === "boolean") &&
    (txn.recurringRuleId === undefined || typeof txn.recurringRuleId === "string")
  );
}

function normalizeTxns(value: unknown): Txn[] | null {
  if (!Array.isArray(value)) return null;
  const seen = new Set<number>();
  const txns: Txn[] = [];
  for (const item of value) {
    if (!isValidTxn(item) || seen.has(item.id)) continue;
    seen.add(item.id);
    txns.push({ ...item, title: item.title.trim() || item.catLabel });
  }
  return txns;
}

function nextTxnIdFrom(txns: Txn[], storedNextId?: unknown): number {
  const maxTxnId = txns.reduce((max, txn) => Math.max(max, txn.id), 0);
  const candidate = typeof storedNextId === "number" && Number.isFinite(storedNextId) ? storedNextId : 0;
  return Math.max(candidate, maxTxnId + 1, Date.now());
}

function normalizeCategories(value: unknown): CategoryDef[] | null {
  if (!Array.isArray(value)) return null;
  const builtInsById = new Map(BUILT_IN_CATEGORIES.map((category) => [category.id, category]));
  const byId = new Map(BUILT_IN_CATEGORIES.map((category) => [category.id, category]));

  for (const item of value) {
    if (!item || typeof item !== "object") continue;
    const category = item as Partial<CategoryDef>;
    if (
      typeof category.id !== "string" ||
      typeof category.label !== "string" ||
      !["expense", "income", "invest"].includes(String(category.group)) ||
      !["expense", "income"].includes(String(category.flow)) ||
      typeof category.icon !== "string" ||
      typeof category.fg !== "string"
    ) {
      continue;
    }

    const group = category.group as CategoryDef["group"];
    const flow = category.flow as CategoryDef["flow"];
    const builtIn = builtInsById.get(category.id);
    const icon = builtIn && category.id === "card_bill" ? builtIn.icon : category.icon;
    if (builtIn && PROTECTED_IDS.has(category.id)) {
      byId.set(category.id, {
        ...builtIn,
        label: formatCategoryLabel(category.label.trim() || builtIn.label),
        fg: category.fg,
        icon,
        protected: true,
      });
      continue;
    }

    byId.set(category.id, {
      id: category.id,
      label: category.label.trim() || category.id,
      group,
      flow,
      icon,
      fg: category.fg,
      protected: category.protected === true || PROTECTED_IDS.has(category.id),
    });
  }

  return Array.from(byId.values());
}

function loadCategories(): CategoryDef[] {
  try {
    const raw = localStorage.getItem(CATEGORIES_STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      const categories = normalizeCategories(parsed);
      if (categories && categories.length > 0) return categories;
    }
  } catch {
    // Ignore malformed persisted categories and recover with built-ins.
  }
  return BUILT_IN_CATEGORIES;
}

function saveCategories(categories: CategoryDef[]) {
  try {
    localStorage.setItem(CATEGORIES_STORAGE_KEY, JSON.stringify(categories));
  } catch {
    // Keep in-memory state working if the browser refuses writes.
  }
}

function loadTxnsState(): PersistedTxnsState | null {
  try {
    const raw = localStorage.getItem(TXNS_STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    const txns = normalizeTxns(parsed?.txns);
    if (txns) return { txns, nextTxnId: nextTxnIdFrom(txns, parsed?.nextTxnId) };
  } catch {
    // Ignore malformed persisted transactions and recover with defaults.
  }
  return null;
}

function saveTxnsState(s: PersistedTxnsState) {
  try {
    localStorage.setItem(TXNS_STORAGE_KEY, JSON.stringify(s));
  } catch {
    // Keep in-memory state working if the browser refuses writes.
  }
}

function loadPendingUndo(): PendingUndo | null {
  try {
    const raw = localStorage.getItem(PENDING_UNDO_STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (
      parsed &&
      typeof parsed.index === "number" &&
      typeof parsed.expiresAt === "number" &&
      isValidTxn(parsed.txn) &&
      Date.now() < parsed.expiresAt
    ) {
      return parsed;
    }
    localStorage.removeItem(PENDING_UNDO_STORAGE_KEY);
  } catch {
    localStorage.removeItem(PENDING_UNDO_STORAGE_KEY);
  }
  return null;
}

function savePendingUndo(pendingUndo: PendingUndo | null) {
  try {
    if (!pendingUndo) {
      localStorage.removeItem(PENDING_UNDO_STORAGE_KEY);
      return;
    }
    const persisted: PersistedUndoState = pendingUndo;
    localStorage.setItem(PENDING_UNDO_STORAGE_KEY, JSON.stringify(persisted));
  } catch {
    // If persistence fails, the in-memory undo state still works.
  }
}

function genCategoryId(): string {
  return `cat_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 7)}`;
}

function findFallbackCategory(categories: CategoryDef[], flow: "expense" | "income"): CategoryDef | null {
  const fallbackId = DEFAULT_FALLBACK[flow];
  return (
    categories.find((c) => c.id === fallbackId) ??
    BUILT_IN_CATEGORIES.find((c) => c.id === fallbackId) ??
    categories.find((c) => c.flow === flow) ??
    BUILT_IN_CATEGORIES.find((c) => c.flow === flow) ??
    null
  );
}

function reducer(state: State, action: Action): State {
  switch (action.type) {
    case "SET_CURRENCY":
      return { ...state, currency: action.currency };
    case "ADD_TXN":
      return applyAddTxn(state, action.input);
    case "UPDATE_TXN":
      return applyUpdateTxn(state, action.id, action.input);
    case "SET_TXN_SETTLED":
      return applySetTxnSettled(state, action.id, action.settled);
    case "DELETE_TXN":
      return applyDeleteTxn(state, action.id);
    case "RESTORE_TXN":
      return applyRestoreTxn(state, action.txn, action.index);
    case "SET_REFRESH_INTERVAL":
      return { ...state, refreshIntervalMs: normalizeRefreshInterval(action.ms) };
    case "PRICE_FETCH_START":
      return { ...state, priceMeta: { ...state.priceMeta, status: "loading" } };
    case "PRICE_FETCH_SETTLED": {
      const { btcKRW, btcUSD, usdKRW, blockHeight, errors, sourceMeta } = action;
      const freshness = applyPriceFetchResult(state.priceMeta.freshness, action);
      return {
        ...state,
        data: {
          ...state.data,
          btcKRW: btcKRW ?? state.data.btcKRW,
          btcUSD: btcUSD ?? state.data.btcUSD,
          usdKRW: usdKRW ?? state.data.usdKRW,
          blockHeight: blockHeight ?? state.data.blockHeight,
        },
        priceMeta: {
          status: errors.length > 0 ? "error" : "ok",
          error: errors.length > 0 ? errors.join(" / ") : null,
          btcKrwIsFallback: action.btcKrwIsFallback === true,
          freshness,
          sourceMeta: {
            btcUsd: sourceMeta.btcUsd ?? state.priceMeta.sourceMeta.btcUsd,
            usdKrw: sourceMeta.usdKrw ?? state.priceMeta.sourceMeta.usdKrw,
            fxReferenceDate:
              sourceMeta.usdKrw !== null
                ? sourceMeta.fxReferenceDate
                : state.priceMeta.sourceMeta.fxReferenceDate,
          },
        },
      };
    }
    case "ADD_CATEGORY":
      return { ...state, categories: [...state.categories, action.category] };
    case "UPDATE_CATEGORY": {
      const nextLabel = action.patch.label;
      return {
        ...state,
        categories: state.categories.map((c) => (c.id === action.id ? { ...c, ...action.patch } : c)),
        data:
          nextLabel === undefined
            ? state.data
            : withTxnSummary(
                state.data,
                state.data.txns.map((t) => (t.cat === action.id ? { ...t, catLabel: nextLabel } : t))
              ),
      };
    }
    case "DELETE_CATEGORY": {
      const target = state.categories.find((c) => c.id === action.id);
      if (!target || target.protected || PROTECTED_IDS.has(target.id)) return state;

      const fallback = findFallbackCategory(state.categories, target.group === "income" ? "income" : "expense");
      if (!fallback) return { ...state, categories: state.categories.filter((c) => c.id !== action.id) };

      const nextTxns = state.data.txns.map((t) =>
        t.cat === action.id ? { ...t, cat: fallback.id, catLabel: fallback.label } : t
      );
      return {
        ...state,
        categories: state.categories.filter((c) => c.id !== action.id),
        data: withTxnSummary(state.data, nextTxns),
      };
    }
    case "MIGRATE_LEGACY_CATEGORIES": {
      // 레거시(정본 집합에 없는 비보호) 카테고리에 묶인 거래를 그룹의 기타 카테고리로 재배정하고,
      // 더 이상 쓰이지 않는 레거시 카테고리를 제거한다. 금액/btcAt 불변, cat/catLabel만 갱신.
      const legacyIds = new Set(
        state.categories
          .filter((c) => !isCanonicalCategory(c.id) && !PROTECTED_IDS.has(c.id))
          .map((c) => c.id)
      );
      if (legacyIds.size === 0) return state;

      const catById = new Map(state.categories.map((c) => [c.id, c]));
      const nextTxns = state.data.txns.map((t) => {
        if (!legacyIds.has(t.cat)) return t;
        const old = catById.get(t.cat);
        const fallbackFlow = old?.flow === "income" ? "income" : "expense";
        const fb = findFallbackCategory(state.categories, fallbackFlow);
        if (!fb) return t;
        return { ...t, cat: fb.id, catLabel: fb.label };
      });
      return {
        ...state,
        categories: state.categories.filter((c) => !legacyIds.has(c.id)),
        data: withTxnSummary(state.data, nextTxns),
      };
    }
  }
}

function applyAddTxn(state: State, input: NewTxnInput): State {
  const category = state.categories.find((c) => c.id === input.cat);
  const label = category?.label ?? input.cat;
  const signedAmount = input.isIncome ? Math.abs(input.amount) : -Math.abs(input.amount);
  const nextId = Math.max(state.nextTxnId, Date.now());
  const newTxn: Txn = {
    id: nextId,
    title: input.title.trim() || label,
    cat: input.cat,
    catLabel: label,
    time: formatTxnTime(input.date),
    date: input.date,
    amount: signedAmount,
    btcAt: state.data.btcKRW,
    settled: input.settled,
    memo: input.memo,
    recurringRuleId: input.recurringRuleId,
  };
  return {
    ...state,
    nextTxnId: nextId + 1,
    data: withTxnSummary(state.data, [newTxn, ...state.data.txns]),
  };
}

function applyUpdateTxn(state: State, id: number, input: NewTxnInput): State {
  const idx = state.data.txns.findIndex((t) => t.id === id);
  if (idx === -1) return state;
  const oldTxn = state.data.txns[idx];
  const category = state.categories.find((c) => c.id === input.cat);
  const label = category?.label ?? input.cat;
  const signedAmount = input.isIncome ? Math.abs(input.amount) : -Math.abs(input.amount);
  const updatedTxn: Txn = {
    ...oldTxn,
    title: input.title.trim() || label,
    cat: input.cat,
    catLabel: label,
    time: formatTxnTime(input.date),
    date: input.date,
    amount: signedAmount,
    settled: input.settled ?? oldTxn.settled,
    memo: input.memo,
    recurringRuleId: input.recurringRuleId,
  };
  const nextTxns = state.data.txns.slice();
  nextTxns[idx] = updatedTxn;
  return { ...state, data: withTxnSummary(state.data, nextTxns) };
}

function applySetTxnSettled(state: State, id: number, settled: boolean): State {
  const nextTxns = state.data.txns.map((txn) => (txn.id === id ? { ...txn, settled } : txn));
  return { ...state, data: withTxnSummary(state.data, nextTxns) };
}

function applyDeleteTxn(state: State, id: number): State {
  const idx = state.data.txns.findIndex((t) => t.id === id);
  if (idx === -1) return state;
  const nextTxns = state.data.txns.slice();
  nextTxns.splice(idx, 1);
  return { ...state, data: withTxnSummary(state.data, nextTxns) };
}

function applyRestoreTxn(state: State, txn: Txn, index: number): State {
  if (!isValidTxn(txn) || state.data.txns.some((t) => t.id === txn.id)) return state;
  const nextTxns = state.data.txns.slice();
  const insertAt = Math.max(0, Math.min(index, nextTxns.length));
  nextTxns.splice(insertAt, 0, txn);
  return {
    ...state,
    nextTxnId: nextTxnIdFrom(nextTxns, state.nextTxnId),
    data: withTxnSummary(state.data, nextTxns),
  };
}

function buildInitialState(): State {
  const persisted = loadTxnsState();
  const initialTxns = persisted?.txns ?? DUMMY.txns;
  const data = withTxnSummary(DUMMY, initialTxns);
  return {
    currency: loadCurrency(),
    data,
    nextTxnId: persisted?.nextTxnId ?? nextTxnIdFrom(initialTxns),
    refreshIntervalMs: loadRefreshInterval(),
    priceMeta: {
      status: "idle",
      error: null,
      btcKrwIsFallback: false,
      freshness: createInitialPriceFreshness(),
      sourceMeta: { btcUsd: null, usdKrw: null },
    },
    categories: loadCategories(),
  };
}

export function LedgerProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(reducer, undefined, buildInitialState);
  const [pendingUndo, setPendingUndo] = useState<PendingUndo | null>(() => loadPendingUndo());
  const undoTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const fetchAndApplyPrices = useCallback(async () => {
    dispatch({ type: "PRICE_FETCH_START" });
    const result = await fetchLivePrices();
    dispatch({ type: "PRICE_FETCH_SETTLED", ...result });
  }, []);

  useEffect(() => {
    fetchAndApplyPrices();
    const id = setInterval(fetchAndApplyPrices, state.refreshIntervalMs);
    return () => clearInterval(id);
  }, [state.refreshIntervalMs, fetchAndApplyPrices]);

  useEffect(() => {
    saveCategories(state.categories);
  }, [state.categories]);

  useEffect(() => {
    saveCurrency(state.currency);
  }, [state.currency]);

  useEffect(() => {
    saveRefreshInterval(state.refreshIntervalMs);
  }, [state.refreshIntervalMs]);

  useEffect(() => {
    saveTxnsState({ txns: state.data.txns, nextTxnId: state.nextTxnId });
  }, [state.data.txns, state.nextTxnId]);

  useEffect(() => {
    if (undoTimerRef.current) clearTimeout(undoTimerRef.current);
    savePendingUndo(pendingUndo);
    if (!pendingUndo) return;

    const remainingMs = pendingUndo.expiresAt - Date.now();
    if (remainingMs <= 0) {
      setPendingUndo(null);
      return;
    }
    undoTimerRef.current = setTimeout(() => setPendingUndo(null), remainingMs);
    return () => {
      if (undoTimerRef.current) clearTimeout(undoTimerRef.current);
    };
  }, [pendingUndo]);

  const value = useMemo<LedgerContextValue>(() => {
    const { freshness } = state.priceMeta;

    const deleteTxn = (id: number) => {
      const idx = state.data.txns.findIndex((t) => t.id === id);
      if (idx === -1) return;
      const removed = state.data.txns[idx];
      dispatch({ type: "DELETE_TXN", id });
      setPendingUndo({ txn: removed, index: idx, expiresAt: Date.now() + UNDO_WINDOW_MS });
    };

    const undoLastDelete = () => {
      if (!pendingUndo) return;
      dispatch({ type: "RESTORE_TXN", txn: pendingUndo.txn, index: pendingUndo.index });
      setPendingUndo(null);
    };

    return {
      currency: state.currency,
      setCurrency: (c) => dispatch({ type: "SET_CURRENCY", currency: c }),
      data: state.data,
      addTxn: (input) => dispatch({ type: "ADD_TXN", input }),
      updateTxn: (id, input) => dispatch({ type: "UPDATE_TXN", id, input }),
      setTxnSettled: (id, settled) => dispatch({ type: "SET_TXN_SETTLED", id, settled }),
      deleteTxn,
      pendingUndo,
      undoLastDelete,
      refreshIntervalMs: state.refreshIntervalMs,
      setRefreshIntervalMs: (ms) => dispatch({ type: "SET_REFRESH_INTERVAL", ms }),
      priceStatus: state.priceMeta.status,
      priceError: state.priceMeta.error,
      priceUpdatedAt: getLatestPriceUpdateAt(freshness),
      isPriceFallback: hasPriceFallback(freshness),
      isPriceStale: isPriceFreshnessStale(freshness),
      btcKrwIsFallback: state.priceMeta.btcKrwIsFallback,
      priceStaleSources: freshness.staleSources,
      priceSourceUpdatedAt: freshness.lastOkAt,
      priceSourceMeta: state.priceMeta.sourceMeta,
      refreshPrices: fetchAndApplyPrices,
      categories: state.categories,
      categoriesById: Object.fromEntries(state.categories.map((c) => [c.id, c])),
      addCategory: (input) =>
        dispatch({
          type: "ADD_CATEGORY",
          category: {
            id: genCategoryId(),
            label: input.label,
            group: input.group,
            flow: input.group,
            icon: input.icon,
            fg: input.fg,
          },
        }),
      updateCategory: (id, patch) => dispatch({ type: "UPDATE_CATEGORY", id, patch }),
      deleteCategory: (id) => dispatch({ type: "DELETE_CATEGORY", id }),
      migrateLegacyCategories: () => dispatch({ type: "MIGRATE_LEGACY_CATEGORIES" }),
    };
  }, [state, pendingUndo, fetchAndApplyPrices]);

  return <LedgerContext.Provider value={value}>{children}</LedgerContext.Provider>;
}

export function useLedger(): LedgerContextValue {
  const ctx = useContext(LedgerContext);
  if (!ctx) throw new Error("useLedger must be used within LedgerProvider");
  return ctx;
}
