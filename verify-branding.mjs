import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

const root = process.cwd();
const manifestPath = join(root, "public", "manifest.webmanifest");
const indexPath = join(root, "index.html");
const tokensPath = join(root, "src", "styles", "tokens.css");
const globalPath = join(root, "src", "styles", "global.css");
const formsPath = join(root, "src", "styles", "forms.css");
const ledgerPath = join(root, "src", "styles", "ledger.css");
const appleIconPath = join(root, "public", "icons", "apple-touch-icon.svg");

assert.equal(existsSync(manifestPath), true, "manifest exists");
assert.equal(existsSync(indexPath), true, "index.html exists");
assert.equal(existsSync(appleIconPath), true, "apple touch icon exists");

const manifest = JSON.parse(readFileSync(manifestPath, "utf8"));
assert.ok(Array.isArray(manifest.icons) && manifest.icons.length >= 4, "manifest icons array exists");
assert.ok(manifest.icons.some((icon) => icon.sizes === "192x192"), "192 icon exists in manifest");
assert.ok(manifest.icons.some((icon) => icon.sizes === "512x512" && icon.purpose === "any"), "512 icon exists in manifest");
assert.ok(manifest.icons.some((icon) => /maskable/.test(icon.purpose)), "maskable icon exists in manifest");
assert.ok(manifest.icons.some((icon) => /apple-touch-icon/.test(icon.src)), "apple icon exists in manifest");

for (const icon of manifest.icons) {
  assert.equal(existsSync(join(root, "public", icon.src.replace(/^\//, ""))), true, `icon exists: ${icon.src}`);
}

const index = readFileSync(indexPath, "utf8");
assert.match(index, /rel="apple-touch-icon"/, "index includes apple-touch-icon");
assert.match(index, /font-display|display=swap/, "external font uses display swap");

const tokens = readFileSync(tokensPath, "utf8");
assert.match(tokens, /system-ui/, "font stack includes system-ui");
assert.match(tokens, /Apple SD Gothic Neo/, "font stack includes Apple SD Gothic Neo");
assert.match(tokens, /Noto Sans KR/, "font stack includes Noto Sans KR");
assert.match(tokens, /Malgun Gothic/, "font stack includes Malgun Gothic");

const styles = [
  readFileSync(globalPath, "utf8"),
  readFileSync(formsPath, "utf8"),
  readFileSync(ledgerPath, "utf8"),
].join("\n");
assert.match(styles, /font-variant-numeric:\s*tabular-nums|font-feature-settings:\s*"tnum"/, "numeric tabular style exists");
assert.doesNotMatch(styles, /letter-spacing:\s*-\d/, "negative letter spacing removed from primary styles");

console.log("verify:branding passed");
