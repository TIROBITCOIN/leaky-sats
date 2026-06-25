import { useMemo, useState, type FormEvent, type ReactNode } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import "../../styles/ledger.css";
import "../../styles/forms.css";
import { useLedger } from "../../state/LedgerContext";
import { fmtKRW, krwToSats } from "../../lib/format";
import { getTodayDateKey, isValidMonthKey } from "../../lib/month";
import {
  loadSettlementDay,
  getSettlementPeriod,
  getDefaultDateKeyForPeriod,
  getSettlementMonthKeyForDate,
} from "../../lib/settlement";
import type { CategoryId } from "../../types";
import CategoryGroupPicker from "./CategoryGroupPicker";
import { MAJOR_ITEM_GROUPS, type MajorItem } from "../../lib/majorItems";
import { addRecurringRule, markRecurringMaterialized, normalizeRecurringDay } from "../../lib/recurringRules";

/** 금액 · 날짜 · 메모 · 저장 버튼 — 수정 화면과 큰 항목 2단계 입력 화면이 공유한다. */
function AmountDateMemoFields({
  amountValue,
  onAmountChange,
  isIncome,
  sats,
  btcKRW,
  dateValue,
  onDateChange,
  memoValue,
  onMemoChange,
  submitLabel,
  disabled,
  extraBefore,
  extraAfter,
}: {
  amountValue: string;
  onAmountChange: (v: string) => void;
  isIncome: boolean;
  sats: number;
  btcKRW: number;
  dateValue: string;
  onDateChange: (v: string) => void;
  memoValue: string;
  onMemoChange: (v: string) => void;
  submitLabel: string;
  disabled: boolean;
  extraBefore?: ReactNode;
  extraAfter?: ReactNode;
}) {
  return (
    <>
      {extraBefore}
      <div className="ldg-field" style={{ marginTop: extraBefore ? 12 : 0 }}>
        <div className="ldg-label" style={{ display: "flex", alignItems: "center", gap: 6 }}>
          금액 (₩)
          <span className={`ldg-flow-badge ${isIncome ? "income" : "expense"}`}>{isIncome ? "수입" : "지출"}</span>
        </div>
        <input
          className="ldg-amount-input"
          inputMode="numeric"
          placeholder="0"
          value={amountValue}
          onChange={(e) => onAmountChange(e.target.value)}
        />
        <div className="ldg-preview">
          ≈ <b style={{ whiteSpace: "nowrap" }}>{sats.toLocaleString("en-US")} sats</b> · 현재 시세{" "}
          <span style={{ whiteSpace: "nowrap" }}>₩{(btcKRW / 1_000_000).toFixed(1)}M</span> 기준
        </div>
      </div>

      <div className="ldg-field">
        <div className="ldg-label">날짜</div>
        <input
          className="ldg-input"
          type="date"
          value={dateValue}
          onChange={(e) => onDateChange(e.target.value)}
          required
        />
      </div>

      <div className="ldg-field">
        <div className="ldg-label">메모 (선택)</div>
        <textarea className="ldg-textarea" value={memoValue} onChange={(e) => onMemoChange(e.target.value)} />
      </div>

      {extraAfter}
      <button className="ldg-submit-btn" type="submit" disabled={disabled} style={{ marginTop: 14 }}>
        {isIncome ? "+" : "-"}
        {fmtKRW(Number(amountValue.replace(/[^0-9]/g, "")) || 0)} {submitLabel}
      </button>
    </>
  );
}

export default function TransactionEntryPage() {
  const { data, addTxn, updateTxn, categories } = useLedger();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  const editId = searchParams.get("edit");
  const editingTxn = editId ? data.txns.find((t) => t.id === Number(editId)) ?? null : null;
  const monthParam = searchParams.get("month");

  // 거래 추가(편집 아님)일 때만 "큰 항목 선택 → 세부 입력" 2단계 흐름을 쓴다.
  // 편집은 정본(큰 카테고리 + 사용자 추가) 집합만 선택지로 보여준다.
  const [selectedItem, setSelectedItem] = useState<MajorItem | null>(null);

  const [amount, setAmount] = useState(() => (editingTxn ? String(Math.abs(editingTxn.amount)) : ""));
  const [cat, setCat] = useState<CategoryId>(
    () =>
      editingTxn?.cat ??
      (categories.find((c) => c.id === "card_bill") ?? categories.find((c) => c.group === "expense") ?? categories[0]).id
  );
  const [title, setTitle] = useState(() => editingTxn?.title ?? "");
  const [memo, setMemo] = useState(() => editingTxn?.memo ?? "");
  const [createRecurring, setCreateRecurring] = useState(false);
  const [date, setDate] = useState(() => {
    if (editingTxn) return editingTxn.date.slice(0, 10);
    if (!isValidMonthKey(monthParam)) return getTodayDateKey();
    // 홈에서 보던 정산기간으로 들어오면, 오늘이 그 기간 안이면 오늘을, 아니면 기간 시작일을 기본값으로 쓴다.
    const period = getSettlementPeriod(monthParam, loadSettlementDay());
    return getDefaultDateKeyForPeriod(period);
  });

  const selectedCategory = categories.find((c) => c.id === cat) ?? categories[0];
  const isIncome = selectedCategory.flow === "income";

  const amountNum = Number(amount.replace(/[^0-9]/g, "")) || 0;
  const sats = useMemo(() => krwToSats(amountNum, data.btcKRW), [amountNum, data.btcKRW]);
  const recurringDay = normalizeRecurringDay(Number(date.slice(8, 10)));

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    if (amountNum <= 0 || !date) return;
    const storedDate = `${date}T00:00`;
    if (editingTxn) {
      updateTxn(editingTxn.id, { title, cat, amount: amountNum, isIncome, date: storedDate, memo });
      navigate(-1);
    } else {
      addTxn({ title, cat, amount: amountNum, isIncome, date: storedDate, memo });
      if (createRecurring) {
        const rule = addRecurringRule({
          title: title.trim() || selectedCategory.label,
          cat,
          isIncome,
          dayOfMonth: recurringDay,
          lastAmount: amountNum,
        });
        markRecurringMaterialized(rule.id, getSettlementMonthKeyForDate(storedDate, loadSettlementDay()));
      }
      navigate("/");
    }
  };

  const handleSelectMajorItem = (item: MajorItem) => {
    if (item.opensSellConfirm) {
      // BTC 판매 확정은 일반 거래 입력이 아니라 기존 SellConfirmModal/btcSellRecords 흐름을 재사용한다.
      navigate("/", { state: { openSellModal: true } });
      return;
    }
    if (!item.categoryId) return;
    setSelectedItem(item);
    setCat(item.categoryId);
    setTitle("");
  };

  const resetToPicker = () => {
    setSelectedItem(null);
    setTitle("");
    setAmount("");
  };

  // ---- 편집: 정본 카테고리만 노출하는 피커 ----
  if (editingTxn) {
    return (
      <div className="ldg-screen">
        <div className="ldg-content">
          <div className="ldg-page-title">거래 수정</div>
          <div className="ldg-page-sub">금액·카테고리·날짜를 바꾸면 잔액과 통계에 바로 반영돼요.</div>

          <form onSubmit={handleSubmit}>
            <div className="ldg-card">
              <div className="ldg-field">
                <div className="ldg-label">카테고리</div>
                <CategoryGroupPicker value={cat} onSelect={(category) => setCat(category.id)} canonicalOnly />
              </div>

              <div className="ldg-field" style={{ marginTop: 12 }}>
                <div className="ldg-label">제목</div>
                <input
                  className="ldg-input"
                  placeholder={selectedCategory.label}
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                />
              </div>

              <AmountDateMemoFields
                amountValue={amount}
                onAmountChange={setAmount}
                isIncome={isIncome}
                sats={sats}
                btcKRW={data.btcKRW}
                dateValue={date}
                onDateChange={setDate}
                memoValue={memo}
                onMemoChange={setMemo}
                submitLabel="수정 완료"
                disabled={amountNum <= 0 || !date}
              />
            </div>
          </form>
        </div>
      </div>
    );
  }

  // ---- 추가, 1단계: 큰 항목 선택 ----
  if (!selectedItem) {
    return (
      <div className="ldg-screen">
        <div className="ldg-content">
          <div className="ldg-page-title">거래 입력</div>
          <div className="ldg-page-sub">큰 항목을 먼저 선택하면 빠르게 입력할 수 있어요.</div>

          {MAJOR_ITEM_GROUPS.map((group) => (
            <div className="ldg-card" key={group.label} style={{ marginTop: 12 }}>
              <div className="ldg-label" style={{ marginBottom: 10 }}>
                {group.label}
              </div>
              <div className="ldg-chip-group">
                {group.items.map((item) => (
                  <button type="button" key={item.id} className="ldg-chip" onClick={() => handleSelectMajorItem(item)}>
                    {item.label}
                  </button>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  // ---- 추가, 2단계: 세부 입력 ----
  const showDetailField = selectedItem.requiresDetail !== false;

  return (
    <div className="ldg-screen">
      <div className="ldg-content">
        <div className="ldg-page-title">{selectedItem.label}</div>
        <div className="ldg-page-sub">필요한 정보만 빠르게 입력하세요.</div>

        <form onSubmit={handleSubmit}>
          <div className="ldg-card">
            <AmountDateMemoFields
              amountValue={amount}
              onAmountChange={setAmount}
              isIncome={isIncome}
              sats={sats}
              btcKRW={data.btcKRW}
              dateValue={date}
              onDateChange={setDate}
              memoValue={memo}
              onMemoChange={setMemo}
              submitLabel="기록하기"
              disabled={amountNum <= 0 || !date}
              extraBefore={
                showDetailField ? (
                  <div className="ldg-field">
                    <div className="ldg-label">{selectedItem.detailLabel ?? "내용"}</div>
                    <input
                      className="ldg-input"
                      placeholder={selectedItem.placeholder}
                      value={title}
                      onChange={(e) => setTitle(e.target.value)}
                    />
                  </div>
                ) : undefined
              }
              extraAfter={
                <label className="ldg-recurring-check">
                  <input
                    type="checkbox"
                    checked={createRecurring}
                    onChange={(event) => setCreateRecurring(event.target.checked)}
                  />
                  <span>
                    매월 {recurringDay}일 반복
                    {recurringDay >= 29 && (
                      <span className="ldg-setting-desc"> · 해당 날짜가 없는 달은 말일로 처리됩니다.</span>
                    )}
                  </span>
                </label>
              }
            />
          </div>
          <button type="button" className="ldg-secondary-btn" style={{ marginTop: 10 }} onClick={resetToPicker}>
            다른 항목 선택
          </button>
        </form>
      </div>
    </div>
  );
}
