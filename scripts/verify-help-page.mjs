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

const expectedHelpCopy = [
  "이 앱은 거래소 앱이 아닙니다.",
  "실제 비트코인을 사고팔지 않습니다.",
  "데이터는 내 브라우저에 저장됩니다.",
  "백업하지 않으면 데이터가 사라질 수 있습니다.",
  "암호화 백업 비밀번호를 잊으면 복원이 어렵습니다.",
  "은행이나 거래소와 자동으로 연결되는 앱이 아니며",
  "서버 계정, 로그인, 클라우드 동기화가 아니기 때문에",
  "기준일이 17일이면 6월 17일부터 7월 16일까지",
  "시세 지연은 앱 고장이 아니라",
  "임시 Vercel deployment URL로 QR 코드를 만드는 것",
];

for (const text of expectedHelpCopy) {
  assert.match(help, new RegExp(text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")), `Help copy includes: ${text}`);
}

assert.match(help, /HELP_SECTIONS/, "Help page keeps sections data-driven");
assert.match(help, /설정으로 돌아가기/, "Help page links back to settings");
assert.match(css, /\.ldg-help-important/, "Help page important callout style exists");
assert.match(css, /\.ldg-help-section/, "Help page section style exists");
assert.match(checklist, /Settings -> Help \/ Usage/, "Release checklist mentions in-app help route");

console.log("verify:help-page passed");
