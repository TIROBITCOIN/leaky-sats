import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const root = process.cwd();
const read = (rel) => readFileSync(join(root, rel), "utf8");

// 1. categories.ts exports CANONICAL_IDS and isCanonicalCategory
const categoriesSrc = read("src/lib/categories.ts");
assert.match(categoriesSrc, /export const CANONICAL_IDS/, "CANONICAL_IDS is exported");
assert.match(categoriesSrc, /export function isCanonicalCategory/, "isCanonicalCategory is exported");

// 2. BUILT_IN_CATEGORIES의 모든 id가 CANONICAL_IDS에 포함되어야 한다 (구현 검증)
assert.match(categoriesSrc, /BUILT_IN_CATEGORIES\.map/, "CANONICAL_IDS derives from BUILT_IN_CATEGORIES");

// 3. 보호 카테고리 4개가 PROTECTED_IDS에 존재
for (const id of ["etc", "etc_income", "btc_buy", "btc_sell"]) {
  assert.match(categoriesSrc, new RegExp(`"${id}"`), `protected category "${id}" exists`);
}

// 4. CategoryGroupPicker가 canonicalOnly prop을 지원하고 isCanonicalCategory를 사용
const pickerSrc = read("src/components/transaction/CategoryGroupPicker.tsx");
assert.match(pickerSrc, /canonicalOnly/, "CategoryGroupPicker supports canonicalOnly prop");
assert.match(pickerSrc, /isCanonicalCategory/, "CategoryGroupPicker uses isCanonicalCategory filter");

// 5. TransactionEntryPage 편집 모드에서 canonicalOnly를 전달
const entrySrc = read("src/components/transaction/TransactionEntryPage.tsx");
assert.match(entrySrc, /canonicalOnly/, "TransactionEntryPage passes canonicalOnly to picker");

// 6. LedgerContext에 MIGRATE_LEGACY_CATEGORIES 액션이 있고 보호 카테고리를 건드리지 않음
const contextSrc = read("src/state/LedgerContext.tsx");
assert.match(contextSrc, /MIGRATE_LEGACY_CATEGORIES/, "MIGRATE_LEGACY_CATEGORIES action exists");
assert.match(contextSrc, /PROTECTED_IDS\.has/, "migration checks PROTECTED_IDS");
assert.match(contextSrc, /migrateLegacyCategories/, "migrateLegacyCategories is exposed in context");

// 7. majorItems.ts의 그룹명이 "투자"로 통일 ("BTC" 아님)
const majorItemsSrc = read("src/lib/majorItems.ts");
assert.match(majorItemsSrc, /label:\s*"투자"/, "BTC group label is '투자' matching GROUP_LABEL");
assert.doesNotMatch(majorItemsSrc, /label:\s*"BTC"/, "no 'BTC' group label in MAJOR_ITEM_GROUPS");

// 8. SettingsPage에 세분화 카테고리 정리 UI가 존재
const settingsSrc = read("src/components/settings/SettingsPage.tsx");
assert.match(settingsSrc, /세분화 카테고리 정리/, "SettingsPage has legacy category cleanup UI");
assert.match(settingsSrc, /window\.confirm/, "cleanup requires user confirmation");

console.log("verify:category-unify passed");
