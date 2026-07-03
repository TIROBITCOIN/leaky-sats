import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const onboarding = readFileSync("src/components/onboarding/OnboardingPrompt.tsx", "utf8");
const app = readFileSync("src/App.tsx", "utf8");
const home = readFileSync("src/components/home/HomePage.tsx", "utf8");

assert.match(onboarding, /지금 통장에 얼마 있어/, "first-run prompt asks for account balance");
assert.match(onboarding, /setPeriodStartBalance/, "prompt saves period start balance");
assert.match(onboarding, /건너뛰기/, "prompt supports skipping");
assert.match(onboarding, /skipped \? 0 : parseKrwInput/, "skip stores a zero balance");
assert.doesNotMatch(onboarding, /<ol|다시 보지 않기|자세히 보기/, "old multi-step onboarding copy is removed");
assert.doesNotMatch(app, /showOnboarding \?/, "App no longer owns the old onboarding/install switch");
assert.match(app, /<InstallPrompt \/>/, "install prompt remains available");
assert.match(home, /<OnboardingPrompt/, "HomePage prompts for missing period balance");
assert.match(home, /!hasPeriodStartBalance/, "HomePage only prompts when the selected period is missing a balance");

console.log("verify:onboarding passed");
