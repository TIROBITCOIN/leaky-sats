import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

const root = process.cwd();
const read = (p) => readFileSync(join(root, p), "utf8");

const tabBarSrc = read("src/components/layout/TabBar.tsx");
const appSrc = read("src/App.tsx");

// 1. TabBar 또는 하단 네비게이션에 "자산" 라벨이 없음
assert.doesNotMatch(tabBarSrc, /label:\s*"자산"/, "TabBar no longer has a 자산 tab label");

// 2. TabBar 또는 하단 네비게이션에 assets 경로 링크가 없음
assert.doesNotMatch(tabBarSrc, /\/assets/, "TabBar no longer links to /assets");

// 3. App route에서 /assets가 직접 AssetsPage를 렌더링하지 않음
assert.doesNotMatch(appSrc, /path="\/assets"\s+element=\{<AssetsPage/, "/assets no longer renders AssetsPage directly");

// 4. AssetsPage import가 App.tsx 또는 TabBar에서 제거됨
assert.doesNotMatch(appSrc, /AssetsPage/, "App.tsx no longer imports/references AssetsPage");
assert.doesNotMatch(tabBarSrc, /AssetsPage/, "TabBar no longer imports/references AssetsPage");
assert.ok(!existsSync(join(root, "src/components/assets/AssetsPage.tsx")), "AssetsPage.tsx file is removed");

// 5. 홈/입력/통계/설정 탭 라벨은 유지됨
for (const label of ["홈", "입력", "통계", "설정"]) {
  assert.match(tabBarSrc, new RegExp(`label:\\s*"${label}"`), `TabBar keeps the ${label} tab label`);
}

// 6-7. heldBtc 관련 localStorage key는 삭제되지 않음 / myledger.heldBtc.v1 문자열이 코드에 남아 있음
const heldBtcSrc = read("src/lib/heldBtc.ts");
assert.match(heldBtcSrc, /myledger\.heldBtc\.v1/, "heldBtc.ts still uses myledger.heldBtc.v1");
const homePageSrc = read("src/components/home/HomePage.tsx");
assert.match(homePageSrc, /getHeldBtc/, "HomePage still reads heldBtc");
const settingsPageSrc = read("src/components/settings/SettingsPage.tsx");
assert.match(settingsPageSrc, /getHeldBtc|setHeldBtc/, "SettingsPage still manages heldBtc");

// 8. BTC Price / PriceWidget은 홈에서 유지됨
assert.match(homePageSrc, /PriceWidget/, "HomePage still renders PriceWidget");
const priceWidgetSrc = read("src/components/home/PriceWidget.tsx");
assert.ok(priceWidgetSrc.length > 0, "PriceWidget.tsx still exists");

// 9. SellNeededCard는 홈에서 유지됨
assert.match(homePageSrc, /SellNeededCard/, "HomePage still renders SellNeededCard");
assert.match(homePageSrc, /Total Balance|BalanceCard/i, "HomePage still shows Total Balance via BalanceCard");

// 10. 정산 기준일 기능은 유지됨
assert.match(homePageSrc, /getSettlementPeriod/, "HomePage still computes the settlement period");
const settlementSrc = read("src/lib/settlement.ts");
assert.match(settlementSrc, /myledger\.settlementDay\.v1/, "settlement.ts still uses myledger.settlementDay.v1");

// 11. 백업/복원 기능은 유지됨
const backupSrc = read("src/lib/backup.ts");
assert.match(backupSrc, /createBackupPayload/, "backup.ts still exports createBackupPayload");
assert.match(backupSrc, /restoreBackupPayload/, "backup.ts still exports restoreBackupPayload");
for (const key of [
  "myledger.txns.v1",
  "myledger.categories.v1",
  "myledger.heldBtc.v1",
  "myledger.displayUnit.v1",
  "myledger.btcSellRecords.v1",
]) {
  assert.ok(backupSrc.includes(key), `backup.ts still includes ${key}`);
}

// 12. "매수/매도" 문구 재도입 없음
assert.doesNotMatch(tabBarSrc, /매수|매도/, "TabBar has no 매수/매도 wording");
assert.doesNotMatch(appSrc, /매수|매도/, "App.tsx has no 매수/매도 wording");

// 13. 새 의존성 없음
const pkg = JSON.parse(read("package.json"));
const deps = Object.keys(pkg.dependencies ?? {});
const devDeps = Object.keys(pkg.devDependencies ?? {});
assert.deepEqual(deps.sort(), ["react", "react-dom", "react-router-dom"], "no new runtime dependency added");
assert.deepEqual(
  devDeps.sort(),
  ["@types/react", "@types/react-dom", "@vitejs/plugin-react", "typescript", "vite"],
  "no new dev dependency added"
);

console.log("verify:remove-assets-tab passed");
