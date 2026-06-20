import fs from "fs";

let ok = true;
function check(label, pass) {
  if (!pass) {
    console.error(`FAIL: ${label}`);
    ok = false;
  }
}

const indexHtml = fs.readFileSync("index.html", "utf8");
check("viewport-fit=cover in index.html", indexHtml.includes("viewport-fit=cover"));
check("maximum-scale=1 in viewport", indexHtml.includes("maximum-scale=1"));

const globalCss = fs.readFileSync("src/styles/global.css", "utf8");
check("overscroll-behavior in global.css", globalCss.includes("overscroll-behavior"));
check("touch-action: manipulation in global.css", globalCss.includes("touch-action: manipulation"));
check("input font-size 16px in global.css", globalCss.includes("font-size: 16px"));
check("-webkit-text-size-adjust in global.css", globalCss.includes("-webkit-text-size-adjust"));

const tokensCss = fs.readFileSync("src/styles/tokens.css", "utf8");
check("safe-area-inset-top variable in tokens.css", tokensCss.includes("safe-area-inset-top"));
check("safe-area-inset-bottom variable in tokens.css", tokensCss.includes("safe-area-inset-bottom"));

const ledgerCss = fs.readFileSync("src/styles/ledger.css", "utf8");
check("safe-top in ldg-content padding", ledgerCss.includes("--safe-top"));
check("overscroll-behavior-y in ledger.css", ledgerCss.includes("overscroll-behavior-y"));
check("swipe-row overflow hidden", ledgerCss.includes("overflow: hidden") && ledgerCss.includes("swipe-row"));
check("swipe-row-action visibility hidden", ledgerCss.includes("visibility: hidden"));

const tabbarCss = fs.readFileSync("src/styles/tabbar.css", "utf8");
check("safe-area-inset-bottom in tabbar", tabbarCss.includes("safe-area-inset-bottom"));

const walletNameLib = fs.readFileSync("src/lib/walletName.ts", "utf8");
check("walletName localStorage key", walletNameLib.includes("myledger.walletName.v1"));

const settingsPage = fs.readFileSync("src/components/settings/SettingsPage.tsx", "utf8");
check("wallet name UI in SettingsPage", settingsPage.includes("지갑 이름"));
check("wallet name form class in SettingsPage", settingsPage.includes("ldg-wallet-name-form"));
check("BackupRestoreCard in SettingsPage", settingsPage.includes("BackupRestoreCard"));
check("AppLockSettings in SettingsPage", settingsPage.includes("AppLockSettings"));

const formsCss = fs.readFileSync("src/styles/forms.css", "utf8");
check("wallet-name-form CSS class exists", formsCss.includes("ldg-wallet-name-form"));

const homePage = fs.readFileSync("src/components/home/HomePage.tsx", "utf8");
check("walletName in HomePage", homePage.includes("walletName"));

const ledgerHeader = fs.readFileSync("src/components/home/LedgerHeader.tsx", "utf8");
check("walletName prop in LedgerHeader", ledgerHeader.includes("walletName"));

const swipeableRow = fs.readFileSync("src/components/transaction/SwipeableRow.tsx", "utf8");
check("swiping class in SwipeableRow", swipeableRow.includes("swiping"));

// Privacy: lock screen should not reveal app identity
const appLockGate = fs.readFileSync("src/components/security/AppLockGate.tsx", "utf8");
check("lock screen has no My Ledger text", !appLockGate.includes('"My Ledger"') && !appLockGate.includes("'My Ledger'"));
check("lock screen has no bitcoin symbol", !appLockGate.includes("₿"));

// Icons should not contain bitcoin references
const iconFiles = [
  "public/icons/icon-192.svg",
  "public/icons/icon-512.svg",
  "public/icons/maskable-icon.svg",
  "public/icons/apple-touch-icon.svg",
];
for (const iconPath of iconFiles) {
  const svg = fs.readFileSync(iconPath, "utf8");
  check(`${iconPath} has no bitcoin symbol`, !svg.includes("₿"));
  check(`${iconPath} has no bitcoin orange #f7931a`, !svg.toLowerCase().includes("#f7931a"));
}

if (ok) {
  console.log("verify:mobile passed");
} else {
  process.exit(1);
}
