import { getDaysInMonth } from "./month";

const RULES_STORAGE_KEY = "myledger.recurringRules.v1";
const MATERIALIZED_STORAGE_KEY = "myledger.recurringMaterialized.v1";
const MIN_DAY = 1;
const MAX_DAY = 31;

export interface RecurringRule {
  id: string;
  title: string;
  cat: string;
  isIncome: boolean;
  dayOfMonth: number;
  lastAmount?: number;
  createdAt: string;
}

export interface NewRecurringRule {
  title: string;
  cat: string;
  isIncome: boolean;
  dayOfMonth: number;
  lastAmount?: number;
}

export function normalizeRecurringDay(value: unknown): number {
  const numberValue = typeof value === "string" ? Number(value) : value;
  if (typeof numberValue !== "number" || !Number.isFinite(numberValue)) return MIN_DAY;
  return Math.min(MAX_DAY, Math.max(MIN_DAY, Math.round(numberValue)));
}

function isValidAmount(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value) && value > 0;
}

function isValidRule(value: unknown): value is RecurringRule {
  if (!value || typeof value !== "object") return false;
  const rule = value as Partial<RecurringRule>;
  return (
    typeof rule.id === "string" &&
    rule.id.length > 0 &&
    typeof rule.title === "string" &&
    rule.title.trim().length > 0 &&
    typeof rule.cat === "string" &&
    rule.cat.length > 0 &&
    typeof rule.isIncome === "boolean" &&
    typeof rule.dayOfMonth === "number" &&
    rule.dayOfMonth >= MIN_DAY &&
    rule.dayOfMonth <= MAX_DAY &&
    Number.isInteger(rule.dayOfMonth) &&
    (rule.lastAmount === undefined || isValidAmount(rule.lastAmount)) &&
    typeof rule.createdAt === "string"
  );
}

function saveRules(rules: RecurringRule[]): void {
  try {
    localStorage.setItem(RULES_STORAGE_KEY, JSON.stringify(rules));
  } catch {
    // 저장 공간이 막혀도 현재 화면의 거래 입력 자체는 계속 사용할 수 있다.
  }
}

export function listRecurringRules(): RecurringRule[] {
  try {
    const raw = localStorage.getItem(RULES_STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    const seen = new Set<string>();
    return parsed.filter((item): item is RecurringRule => {
      if (!isValidRule(item) || seen.has(item.id)) return false;
      seen.add(item.id);
      return true;
    });
  } catch {
    return [];
  }
}

function generateRuleId(): string {
  return `rec_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 7)}`;
}

export function addRecurringRule(input: NewRecurringRule): RecurringRule {
  const title = input.title.trim() || "반복 항목";
  const rule: RecurringRule = {
    id: generateRuleId(),
    title,
    cat: input.cat,
    isIncome: input.isIncome,
    dayOfMonth: normalizeRecurringDay(input.dayOfMonth),
    lastAmount: isValidAmount(input.lastAmount) ? input.lastAmount : undefined,
    createdAt: new Date().toISOString(),
  };
  saveRules([rule, ...listRecurringRules()]);
  return rule;
}

export function updateRecurringRule(
  id: string,
  patch: Partial<Pick<RecurringRule, "title" | "cat" | "isIncome" | "dayOfMonth" | "lastAmount">>
): RecurringRule | null {
  const rules = listRecurringRules();
  const index = rules.findIndex((rule) => rule.id === id);
  if (index === -1) return null;
  const current = rules[index];
  const next: RecurringRule = {
    ...current,
    ...patch,
    title: patch.title === undefined ? current.title : patch.title.trim() || current.title,
    dayOfMonth:
      patch.dayOfMonth === undefined ? current.dayOfMonth : normalizeRecurringDay(patch.dayOfMonth),
    lastAmount:
      patch.lastAmount === undefined
        ? current.lastAmount
        : isValidAmount(patch.lastAmount)
        ? patch.lastAmount
        : current.lastAmount,
  };
  rules[index] = next;
  saveRules(rules);
  return next;
}

export function deleteRecurringRule(id: string): boolean {
  const rules = listRecurringRules();
  const next = rules.filter((rule) => rule.id !== id);
  if (next.length === rules.length) return false;
  saveRules(next);
  return true;
}

function loadMaterializedKeys(): Set<string> {
  try {
    const raw = localStorage.getItem(MATERIALIZED_STORAGE_KEY);
    if (!raw) return new Set();
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return new Set();
    return new Set(parsed.filter((item): item is string => typeof item === "string" && item.length > 0));
  } catch {
    return new Set();
  }
}

function materializedKey(ruleId: string, monthKey: string): string {
  return `${ruleId}:${monthKey}`;
}

export function isRecurringMaterialized(ruleId: string, monthKey: string): boolean {
  return loadMaterializedKeys().has(materializedKey(ruleId, monthKey));
}

export function markRecurringMaterialized(ruleId: string, monthKey: string): boolean {
  const keys = loadMaterializedKeys();
  const key = materializedKey(ruleId, monthKey);
  if (keys.has(key)) return false;
  keys.add(key);
  try {
    localStorage.setItem(MATERIALIZED_STORAGE_KEY, JSON.stringify([...keys]));
  } catch {
    return false;
  }
  return true;
}

function dateForMonth(monthKey: string, day: number): string {
  const effectiveDay = Math.min(day, getDaysInMonth(monthKey));
  return `${monthKey}-${String(effectiveDay).padStart(2, "0")}`;
}

export function mapRecurringRuleDate(
  period: { startDate: string; endDate: string },
  dayOfMonth: number
): string {
  const day = normalizeRecurringDay(dayOfMonth);
  const startMonth = period.startDate.slice(0, 7);
  const endMonth = period.endDate.slice(0, 7);
  const candidates = [...new Set([dateForMonth(startMonth, day), dateForMonth(endMonth, day)])];
  return candidates.find((date) => date >= period.startDate && date <= period.endDate) ?? period.startDate;
}

export {
  RULES_STORAGE_KEY as RECURRING_RULES_KEY,
  MATERIALIZED_STORAGE_KEY as RECURRING_MATERIALIZED_KEY,
};
