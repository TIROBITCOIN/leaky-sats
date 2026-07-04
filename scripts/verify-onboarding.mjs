import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const onboarding = readFileSync("src/components/onboarding/OnboardingPrompt.tsx", "utf8");
const app = readFileSync("src/App.tsx", "utf8");
const install = readFileSync("src/components/pwa/InstallPrompt.tsx", "utf8");
const tabbar = readFileSync("src/components/layout/TabBar.tsx", "utf8");

// OnboardingPrompt uses correct localStorage key
assert.match(onboarding, /myledger\.onboarding\.dismissed\.v1/, "uses dismissed localStorage key");

// OnboardingPrompt uses correct sessionStorage key
assert.match(onboarding, /myledger\.onboarding\.closedThisSession\.v1/, "uses session close key");

// "다시 보지 않기" checkbox with localStorage write on close
assert.match(onboarding, /다시 보지 않기/, "has dont-show-again checkbox");
assert.match(onboarding, /localStorage\.setItem\(DISMISS_KEY/, "close with checkbox writes localStorage");

// Session-only close writes sessionStorage
assert.match(onboarding, /sessionStorage\.setItem\(SESSION_KEY/, "close without checkbox writes sessionStorage");

// "자세히 보기" navigates to /help and dismisses
assert.match(onboarding, /navigate\("\/help"\)/, "detail button navigates to /help");

// App.tsx imports and renders OnboardingPrompt
assert.match(app, /import OnboardingPrompt/, "App imports OnboardingPrompt");
assert.match(app, /isOnboardingVisible/, "App uses isOnboardingVisible");

// Conflict prevention: OnboardingPrompt and InstallPrompt are mutually exclusive
assert.match(app, /showOnboarding \?/, "App conditionally renders onboarding vs install");
assert.match(app, /<OnboardingPrompt/, "App renders OnboardingPrompt");
assert.match(app, /<InstallPrompt/, "App renders InstallPrompt");

// InstallPrompt keeps its own dismiss key unchanged
assert.match(install, /myledger\.installPrompt\.dismissed\.v1/, "InstallPrompt keeps its own dismiss key");

// OnboardingPrompt does not reference install dismiss key
assert.doesNotMatch(onboarding, /installPrompt\.dismissed/, "OnboardingPrompt does not touch install key");

// No new tab added
assert.doesNotMatch(tabbar, /onboarding/i, "TabBar does not add onboarding tab");

// OnboardingPrompt is inside AppLockGate (rendered in App inside the gate)
assert.match(app, /AppLockGate[\s\S]*OnboardingPrompt/, "OnboardingPrompt is inside AppLockGate");

console.log("verify:onboarding passed");
