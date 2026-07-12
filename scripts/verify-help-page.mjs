import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";

const app = readFileSync("src/App.tsx", "utf8");
const settings = readFileSync("src/components/settings/SettingsPage.tsx", "utf8");
const tabbar = readFileSync("src/components/layout/TabBar.tsx", "utf8");
const css = readFileSync("src/styles/ledger.css", "utf8");
const checklist = readFileSync("docs/RELEASE_CHECKLIST.md", "utf8");
const helpPath = "src/components/settings/HelpPage.tsx";

assert.equal(existsSync(helpPath), true, "HelpPage component exists");
const help = readFileSync(helpPath, "utf8");

assert.match(app, /import HelpPage/, "App imports HelpPage");
assert.match(app, /<Route path="\/help" element=\{<HelpPage \/>\}/, "App registers /help route");
assert.match(settings, /to="\/help"/, "Settings links to /help");
assert.match(settings, /도움말 \/ 사용법/, "Settings shows help entry");
assert.doesNotMatch(tabbar, /\/help/, "bottom tab bar does not add a help tab");

// Help page was condensed from 10 long sections to 3 short ones: a must-remember callout,
// a numbered usage list, and a short reference list.
const expectedHelpCopy = [
  "꼭 기억할 것",
  "이 앱은 가계부입니다. 실제 비트코인을 사고팔지 않습니다.",
  "데이터는 이 기기 브라우저에만 저장됩니다. 백업 없이 삭제하면 복구할 수 없습니다.",
  "암호화 백업 비밀번호를 잊으면 복원할 수 없습니다.",
  "설정에서 보유 BTC 입력 또는 공개키(xpub) 등록",
  "정산 기준일 설정",
  "수입/지출 입력, 반복 항목 등록",
  "정기적으로 백업",
  "정산기간: 기준일부터 다음 달 전날까지가 한 달입니다.",
  "판매해야 하는 비트코인",
  "시세가 지연되면 김프 계산이 잠시 보류될 수 있습니다.",
];

for (const text of expectedHelpCopy) {
  assert.match(help, new RegExp(text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")), `Help copy includes: ${text}`);
}

assert.match(help, /설정으로 돌아가기/, "Help page links back to settings");
assert.match(css, /\.ldg-help-important/, "Help page important callout style exists");
assert.match(css, /\.ldg-help-section/, "Help page section style exists");
assert.match(checklist, /Settings -> Help \/ Usage/, "Release checklist mentions in-app help route");

console.log("verify:help-page passed");
