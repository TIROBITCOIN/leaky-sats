import assert from "node:assert/strict";

const TXNS_STORAGE_KEY = "myledger.txns.v1";
const CATEGORIES_STORAGE_KEY = "myledger.categories.v1";
const PENDING_UNDO_STORAGE_KEY = "myledger.pendingUndo.v1";
const UNDO_WINDOW_MS = 5000;

const builtInCategories = [
  { id: "food", label: "Food", group: "expense", flow: "expense", icon: "fork", fg: "#f87171" },
  { id: "salary", label: "Salary", group: "income", flow: "income", icon: "banknote", fg: "#4ade80" },
  { id: "etc", label: "Other", group: "expense", flow: "expense", icon: "dots", fg: "#d4d4d4", protected: true },
  {
    id: "etc_income",
    label: "Other income",
    group: "income",
    flow: "income",
    icon: "arrowDown",
    fg: "#94a3b8",
    protected: true,
  },
  { id: "btc_buy", label: "BTC Buy", group: "invest", flow: "expense", icon: "bitcoin", fg: "#f7931a", protected: true },
  { id: "btc_sell", label: "BTC Sell", group: "invest", flow: "income", icon: "bitcoin", fg: "#4ade80", protected: true },
];

const protectedIds = new Set(["etc", "etc_income", "btc_buy", "btc_sell"]);
const fallbackIds = { expense: "etc", income: "etc_income" };

class MemoryStorage {
  #items = new Map();

  getItem(key) {
    return this.#items.has(key) ? this.#items.get(key) : null;
  }

  setItem(key, value) {
    this.#items.set(key, String(value));
  }

  removeItem(key) {
    this.#items.delete(key);
  }
}

function formatTxnTime(iso) {
  const d = new Date(iso);
  const hh = String(d.getHours()).padStart(2, "0");
  const mm = String(d.getMinutes()).padStart(2, "0");
  return `${d.getMonth() + 1}/${d.getDate()} ${hh}:${mm}`;
}

function calculateTxnSummary(txns) {
  return txns.reduce(
    (summary, txn) => {
      const amount = Number.isFinite(txn.amount) ? txn.amount : 0;
      summary.balance += amount;
      if (amount > 0) summary.income += amount;
      if (amount < 0) summary.expense += -amount;
      return summary;
    },
    { balance: 0, income: 0, expense: 0 }
  );
}

function isValidTxn(txn) {
  return (
    txn &&
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
    txn.btcAt > 0
  );
}

function normalizeTxns(value) {
  if (!Array.isArray(value)) return null;
  const seen = new Set();
  const txns = [];
  for (const item of value) {
    if (!isValidTxn(item) || seen.has(item.id)) continue;
    seen.add(item.id);
    txns.push({ ...item, title: item.title.trim() || item.catLabel });
  }
  return txns;
}

function nextTxnIdFrom(txns, storedNextId) {
  const maxTxnId = txns.reduce((max, txn) => Math.max(max, txn.id), 0);
  const candidate = typeof storedNextId === "number" && Number.isFinite(storedNextId) ? storedNextId : 0;
  return Math.max(candidate, maxTxnId + 1, Date.now());
}

function normalizeCategories(value) {
  if (!Array.isArray(value)) return null;
  const byId = new Map(builtInCategories.map((category) => [category.id, category]));
  for (const item of value) {
    if (
      !item ||
      typeof item.id !== "string" ||
      typeof item.label !== "string" ||
      !["expense", "income", "invest"].includes(item.group) ||
      !["expense", "income"].includes(item.flow) ||
      typeof item.icon !== "string" ||
      typeof item.fg !== "string"
    ) {
      continue;
    }
    byId.set(item.id, { ...item, label: item.label.trim() || item.id, protected: item.protected === true || protectedIds.has(item.id) });
  }
  return Array.from(byId.values());
}

function createLedger(storage) {
  const rawTxns = storage.getItem(TXNS_STORAGE_KEY);
  let txns = [];
  let nextTxnId = Date.now();
  try {
    if (rawTxns) {
      const parsed = JSON.parse(rawTxns);
      txns = normalizeTxns(parsed.txns) ?? [];
      nextTxnId = nextTxnIdFrom(txns, parsed.nextTxnId);
    }
  } catch {
    txns = [];
    nextTxnId = Date.now();
  }

  let categories = builtInCategories;
  try {
    const rawCategories = storage.getItem(CATEGORIES_STORAGE_KEY);
    if (rawCategories) categories = normalizeCategories(JSON.parse(rawCategories)) ?? builtInCategories;
  } catch {
    categories = builtInCategories;
  }

  let pendingUndo = null;
  try {
    const rawUndo = storage.getItem(PENDING_UNDO_STORAGE_KEY);
    if (rawUndo) {
      const parsed = JSON.parse(rawUndo);
      if (parsed && isValidTxn(parsed.txn) && Date.now() < parsed.expiresAt) pendingUndo = parsed;
      else storage.removeItem(PENDING_UNDO_STORAGE_KEY);
    }
  } catch {
    storage.removeItem(PENDING_UNDO_STORAGE_KEY);
  }

  const persistTxns = () => storage.setItem(TXNS_STORAGE_KEY, JSON.stringify({ txns, nextTxnId }));
  const persistCategories = () => storage.setItem(CATEGORIES_STORAGE_KEY, JSON.stringify(categories));
  const persistUndo = () => {
    if (pendingUndo) storage.setItem(PENDING_UNDO_STORAGE_KEY, JSON.stringify(pendingUndo));
    else storage.removeItem(PENDING_UNDO_STORAGE_KEY);
  };
  const data = () => ({ txns, ...calculateTxnSummary(txns) });

  return {
    data,
    get pendingUndo() {
      return pendingUndo;
    },
    get categories() {
      return categories;
    },
    addTxn(input) {
      const category = categories.find((c) => c.id === input.cat);
      const label = category?.label ?? input.cat;
      const id = Math.max(nextTxnId, Date.now());
      nextTxnId = id + 1;
      txns = [
        {
          id,
          title: input.title.trim() || label,
          cat: input.cat,
          catLabel: label,
          time: formatTxnTime(input.date),
          date: input.date,
          amount: input.isIncome ? Math.abs(input.amount) : -Math.abs(input.amount),
          btcAt: 158_000_000,
          memo: input.memo,
        },
        ...txns,
      ];
      persistTxns();
      return id;
    },
    updateTxn(id, input) {
      const idx = txns.findIndex((txn) => txn.id === id);
      if (idx === -1) return;
      const category = categories.find((c) => c.id === input.cat);
      const label = category?.label ?? input.cat;
      const next = txns.slice();
      next[idx] = {
        ...txns[idx],
        title: input.title.trim() || label,
        cat: input.cat,
        catLabel: label,
        time: formatTxnTime(input.date),
        date: input.date,
        amount: input.isIncome ? Math.abs(input.amount) : -Math.abs(input.amount),
        memo: input.memo,
      };
      txns = next;
      persistTxns();
    },
    deleteTxn(id) {
      const idx = txns.findIndex((txn) => txn.id === id);
      if (idx === -1) return;
      const [removed] = txns.splice(idx, 1);
      pendingUndo = { txn: removed, index: idx, expiresAt: Date.now() + UNDO_WINDOW_MS };
      persistTxns();
      persistUndo();
    },
    undoLastDelete() {
      if (!pendingUndo || txns.some((txn) => txn.id === pendingUndo.txn.id)) {
        pendingUndo = null;
        persistUndo();
        return;
      }
      const insertAt = Math.max(0, Math.min(pendingUndo.index, txns.length));
      txns = [...txns.slice(0, insertAt), pendingUndo.txn, ...txns.slice(insertAt)];
      nextTxnId = nextTxnIdFrom(txns, nextTxnId);
      pendingUndo = null;
      persistTxns();
      persistUndo();
    },
    deleteCategory(id) {
      const target = categories.find((category) => category.id === id);
      if (!target || target.protected || protectedIds.has(target.id)) return;
      const fallbackFlow = target.group === "income" ? "income" : "expense";
      const fallback =
        categories.find((category) => category.id === fallbackIds[fallbackFlow]) ??
        builtInCategories.find((category) => category.id === fallbackIds[fallbackFlow]);
      categories = categories.filter((category) => category.id !== id);
      if (fallback) {
        txns = txns.map((txn) => (txn.cat === id ? { ...txn, cat: fallback.id, catLabel: fallback.label } : txn));
      }
      persistCategories();
      persistTxns();
    },
  };
}

const storage = new MemoryStorage();

let ledger = createLedger(storage);
assert.equal(ledger.data().txns.length, 0, "initial state loads safely");

const expenseId = ledger.addTxn({ title: "", cat: "food", amount: 5000, isIncome: false, date: "2026-06-20T09:00" });
assert.equal(ledger.data().txns[0].amount, -5000, "expense is stored as negative");
assert.equal(ledger.data().txns[0].title, "Food", "empty title falls back to category label");

ledger = createLedger(storage);
assert.equal(ledger.data().txns.some((txn) => txn.id === expenseId), true, "transaction survives reload");

ledger.updateTxn(expenseId, { title: "Salary fix", cat: "salary", amount: 10000, isIncome: true, date: "2026-06-20T10:00" });
assert.equal(ledger.data().balance, 10000, "summary recalculates after income edit");
assert.equal(ledger.data().income, 10000, "income recalculates after edit");
assert.equal(ledger.data().expense, 0, "expense recalculates after edit");

ledger.deleteTxn(expenseId);
assert.equal(ledger.data().txns.length, 0, "deleted transaction is removed");
assert.ok(storage.getItem(PENDING_UNDO_STORAGE_KEY), "pending undo is persisted");

ledger = createLedger(storage);
assert.equal(ledger.pendingUndo?.txn.id, expenseId, "pending undo survives reload inside window");
ledger.undoLastDelete();
assert.equal(ledger.data().txns.length, 1, "undo restores transaction");
ledger.undoLastDelete();
assert.equal(ledger.data().txns.length, 1, "double undo does not duplicate transaction");

ledger.deleteTxn(expenseId);
const nextId = ledger.addTxn({ title: "Coffee", cat: "food", amount: 6000, isIncome: false, date: "2026-06-20T11:00" });
assert.notEqual(nextId, expenseId, "new transaction does not reuse deleted id");

storage.setItem(TXNS_STORAGE_KEY, "{not json");
ledger = createLedger(storage);
assert.equal(ledger.data().txns.length, 0, "broken transaction storage recovers safely");

storage.setItem(CATEGORIES_STORAGE_KEY, "{not json");
ledger = createLedger(storage);
assert.equal(ledger.categories.some((category) => category.id === "btc_buy" && category.protected), true, "broken categories recover protected built-ins");

storage.setItem(
  CATEGORIES_STORAGE_KEY,
  JSON.stringify([...builtInCategories, { id: "custom_food", label: "Custom food", group: "expense", flow: "expense", icon: "dots", fg: "#ffffff" }])
);
ledger = createLedger(storage);
const customId = ledger.addTxn({ title: "Custom", cat: "custom_food", amount: 7000, isIncome: false, date: "2026-06-20T12:00" });
ledger.deleteCategory("custom_food");
assert.equal(ledger.data().txns.find((txn) => txn.id === customId)?.cat, "etc", "deleted category falls back on linked transactions");
ledger.deleteCategory("btc_buy");
assert.equal(ledger.categories.some((category) => category.id === "btc_buy"), true, "protected BTC category cannot be deleted");

console.log("verify:persist passed");
