import { useState } from "react";
import type { CategoryDef, CategoryGroup } from "../../types";
import { useLedger } from "../../state/LedgerContext";
import { GROUP_LABEL, BUILT_IN_CATEGORIES } from "../../lib/categories";
import { ICONS, ICONS_BY_ID } from "../../lib/categoryIcons";
import { hexToRgba } from "../../lib/colorUtils";
import FullScreenModal from "../common/FullScreenModal";

const GROUP_ORDER: CategoryGroup[] = ["income", "expense", "invest"];
// "투자"보다 사용자에게 익숙한 "BTC"로 섹션 제목만 다르게 보여준다(GROUP_LABEL은 다른 곳에서 그대로 재사용).
const SECTION_LABEL: Record<CategoryGroup, string> = { income: "수입", expense: "지출", invest: "BTC" };
const ADDABLE_GROUPS: Extract<CategoryGroup, "expense" | "income">[] = ["expense", "income"];

// Phase 10에서 큰 항목 중심으로 정리한 기본 카테고리(BUILT_IN_CATEGORIES) id 집합을 "현재" 카테고리로
// 본다. 여기 없는 id(식비/카페 등 예전 기본 카테고리나 사용자 커스텀 카테고리)는 삭제하지 않고
// "이전 카테고리" 섹션에 접어서 보여준다. 일반 거래 입력에 노출되지 않는 btc_sell도
// BUILT_IN_CATEGORIES 기준이면 빠짐없이 "현재" 취급된다.
const CURRENT_CATEGORY_IDS = new Set(BUILT_IN_CATEGORIES.map((c) => c.id));

type FormMode = { kind: "add" } | { kind: "edit"; id: string };

function CatSwatch({ c }: { c: CategoryDef }) {
  const path = ICONS_BY_ID[c.icon]?.path ?? ICONS_BY_ID.dots.path;
  return (
    <span
      style={{
        width: 32,
        height: 32,
        borderRadius: 10,
        background: hexToRgba(c.fg, 0.15),
        color: c.fg,
        display: "grid",
        placeItems: "center",
        flexShrink: 0,
      }}
    >
      <svg viewBox="0 0 24 24" width="17" height="17" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <path d={path} />
      </svg>
    </span>
  );
}

function CategoryRow({ c, onEdit, onDelete }: { c: CategoryDef; onEdit: () => void; onDelete: () => void }) {
  return (
    <div className="ldg-cat-row">
      <CatSwatch c={c} />
      <span style={{ fontSize: 13, flex: 1, minWidth: 0 }}>{c.label}</span>
      <div className="ldg-cat-manage-actions">
        <button type="button" className="ldg-icon-action" onClick={onEdit} aria-label="편집">
          <svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
            <path d="M12 20h9 M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4z" />
          </svg>
        </button>
        {c.protected ? (
          <span className="ldg-tiny" style={{ padding: "0 4px" }}>
            기본
          </span>
        ) : (
          <button type="button" className="ldg-icon-action danger" onClick={onDelete} aria-label="삭제">
            <svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
              <path d="M4 7h16 M9 7V5a2 2 0 0 1 2-2h2a2 2 0 0 1 2 2v2 M6 7l1 13a2 2 0 0 0 2 2h6a2 2 0 0 0 2-2l1-13" />
            </svg>
          </button>
        )}
      </div>
    </div>
  );
}

function CategoryManagerModal({ onClose }: { onClose: () => void }) {
  const { categories, data, addCategory, updateCategory, deleteCategory } = useLedger();
  const [formMode, setFormMode] = useState<FormMode | null>(null);
  const [formLabel, setFormLabel] = useState("");
  const [formFg, setFormFg] = useState("#f87171");
  const [formIcon, setFormIcon] = useState("dots");
  const [formGroup, setFormGroup] = useState<"expense" | "income">("expense");
  const [legacyOpen, setLegacyOpen] = useState(false);

  const categoriesById = Object.fromEntries(categories.map((c) => [c.id, c]));
  const currentCategories = categories.filter((c) => CURRENT_CATEGORY_IDS.has(c.id));
  const legacyCategories = categories.filter((c) => !CURRENT_CATEGORY_IDS.has(c.id));

  const openAdd = () => {
    setFormMode({ kind: "add" });
    setFormLabel("");
    setFormFg("#f87171");
    setFormIcon("dots");
    setFormGroup("expense");
  };

  const openEdit = (c: CategoryDef) => {
    setFormMode({ kind: "edit", id: c.id });
    setFormLabel(c.label);
    setFormFg(c.fg);
    setFormIcon(c.icon);
  };

  const closeForm = () => setFormMode(null);

  const handleSave = () => {
    const label = formLabel.trim();
    if (!label) return;
    if (formMode?.kind === "add") {
      addCategory({ label, fg: formFg, icon: formIcon, group: formGroup });
    } else if (formMode?.kind === "edit") {
      updateCategory(formMode.id, { label, fg: formFg, icon: formIcon });
    }
    closeForm();
  };

  const handleDelete = (c: CategoryDef) => {
    const linkedCount = data.txns.filter((t) => t.cat === c.id).length;
    if (linkedCount > 0) {
      const fallbackId = c.group === "income" ? "etc_income" : "etc";
      const fallbackLabel = categoriesById[fallbackId]?.label ?? "기타";
      const ok = window.confirm(
        `"${c.label}" 카테고리에 연결된 거래가 ${linkedCount}건 있어요.\n삭제하면 모두 "${fallbackLabel}"(으)로 이동합니다. 계속할까요?`
      );
      if (!ok) return;
    }
    deleteCategory(c.id);
    if (formMode?.kind === "edit" && formMode.id === c.id) closeForm();
  };

  return (
    <FullScreenModal
      title="카테고리 관리"
      onClose={onClose}
      ariaLabel="카테고리 관리"
      headerAction={
        formMode === null ? (
          <button type="button" className="ldg-link" onClick={openAdd}>
            + 새 카테고리
          </button>
        ) : undefined
      }
    >

      {formMode && (
        <div className="ldg-cat-form">
          {formMode.kind === "add" && (
            <div className="ldg-field">
              <div className="ldg-label">그룹</div>
              <div className="ldg-radio-group">
                {ADDABLE_GROUPS.map((g) => (
                  <button type="button" key={g} className={formGroup === g ? "on" : ""} onClick={() => setFormGroup(g)}>
                    {GROUP_LABEL[g]}
                  </button>
                ))}
              </div>
            </div>
          )}
          <div className="ldg-field">
            <div className="ldg-label">이름</div>
            <input className="ldg-input" value={formLabel} onChange={(e) => setFormLabel(e.target.value)} placeholder="카테고리 이름" />
          </div>
          <div className="ldg-field">
            <div className="ldg-label">색상</div>
            <div className="ldg-color-row">
              <input type="color" value={formFg} onChange={(e) => setFormFg(e.target.value)} className="ldg-color-input" />
              <span className="ldg-tiny mono" style={{ fontFamily: "var(--ldg-mono)" }}>
                {formFg}
              </span>
            </div>
          </div>
          <div className="ldg-field">
            <div className="ldg-label">아이콘</div>
            <div className="ldg-icon-picker-grid">
              {ICONS.map((icon) => (
                <button
                  type="button"
                  key={icon.id}
                  className={`ldg-icon-picker-btn ${formIcon === icon.id ? "selected" : ""}`}
                  style={{ color: formFg, background: hexToRgba(formFg, formIcon === icon.id ? 0.22 : 0.08) }}
                  onClick={() => setFormIcon(icon.id)}
                  title={icon.label}
                  aria-label={icon.label}
                >
                  <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                    <path d={icon.path} />
                  </svg>
                </button>
              ))}
            </div>
          </div>
          <div className="ldg-cat-form-actions">
            <button type="button" className="ldg-link" onClick={closeForm}>
              취소
            </button>
            <button type="button" className="ldg-submit-btn" style={{ width: "auto", padding: "10px 20px" }} onClick={handleSave}>
              저장
            </button>
          </div>
        </div>
      )}

      {GROUP_ORDER.map((group) => {
        const items = currentCategories.filter((c) => c.group === group);
        if (items.length === 0) return null;
        return (
          <div key={group} className="ldg-cat-manage-section">
            <div className="ldg-tiny" style={{ margin: "14px 0 6px" }}>
              {SECTION_LABEL[group].toUpperCase()} · {items.length}
            </div>
            {group === "invest" && (
              <div className="ldg-setting-desc" style={{ marginBottom: 8 }}>
                DCA / BTC 매수는 거래 입력에서는 지출로 기록되지만 생활비 부족 계산에서는 제외됩니다.
              </div>
            )}
            <div className="ldg-cat-list">
              {items.map((c) => (
                <CategoryRow key={c.id} c={c} onEdit={() => openEdit(c)} onDelete={() => handleDelete(c)} />
              ))}
            </div>
          </div>
        );
      })}

      {legacyCategories.length > 0 && (
        <div className="ldg-cat-manage-section">
          <button
            type="button"
            className="ldg-cat-group-header"
            style={{ marginTop: 14 }}
            onClick={() => setLegacyOpen((v) => !v)}
            aria-expanded={legacyOpen}
          >
            <span>이전 카테고리</span>
            <span className="ldg-cat-group-count">{legacyCategories.length}</span>
            <svg
              viewBox="0 0 24 24"
              width="14"
              height="14"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              style={{ transform: legacyOpen ? "rotate(180deg)" : "none", transition: "transform 0.15s", marginLeft: "auto" }}
            >
              <path d="M6 9l6 6 6-6" />
            </svg>
          </button>
          {legacyOpen && (
            <div className="ldg-cat-list" style={{ marginTop: 6 }}>
              {legacyCategories.map((c) => (
                <CategoryRow key={c.id} c={c} onEdit={() => openEdit(c)} onDelete={() => handleDelete(c)} />
              ))}
            </div>
          )}
        </div>
      )}
    </FullScreenModal>
  );
}

export default function CategoryManager() {
  const { categories } = useLedger();
  const [open, setOpen] = useState(false);

  return (
    <div className="ldg-card">
      <button
        type="button"
        className="ldg-setting-row"
        style={{ width: "100%", background: "transparent", border: 0, cursor: "pointer", textAlign: "left" }}
        onClick={() => setOpen(true)}
      >
        <div className="ldg-setting-label">카테고리 관리</div>
        <div className="ldg-setting-desc" style={{ display: "flex", alignItems: "center", gap: 6 }}>
          {categories.length}개
          <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M9 18l6-6-6-6" />
          </svg>
        </div>
      </button>
      {open && <CategoryManagerModal onClose={() => setOpen(false)} />}
    </div>
  );
}
