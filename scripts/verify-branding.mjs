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
const applePngPath = join(root, "public", "icons", "apple-touch-icon-180.png");
const categoryIconsPath = join(root, "src", "lib", "categoryIcons.ts");
const categoriesPath = join(root, "src", "lib", "categories.ts");
const categoryIconComponentPath = join(root, "src", "components", "home", "CategoryIcon.tsx");
const ledgerContextPath = join(root, "src", "state", "LedgerContext.tsx");

assert.equal(existsSync(manifestPath), true, "manifest exists");
assert.equal(existsSync(indexPath), true, "index.html exists");
assert.equal(existsSync(appleIconPath), true, "apple touch icon exists");
assert.equal(existsSync(applePngPath), true, "iOS PNG apple touch icon exists");

const manifest = JSON.parse(readFileSync(manifestPath, "utf8"));
assert.ok(Array.isArray(manifest.icons) && manifest.icons.length >= 4, "manifest icons array exists");
assert.ok(manifest.icons.some((icon) => icon.sizes === "192x192"), "192 icon exists in manifest");
assert.ok(manifest.icons.some((icon) => icon.sizes === "512x512" && icon.purpose === "any"), "512 icon exists in manifest");
assert.ok(manifest.icons.some((icon) => /maskable/.test(icon.purpose)), "maskable icon exists in manifest");
assert.ok(manifest.icons.some((icon) => /apple-touch-icon/.test(icon.src)), "apple icon exists in manifest");
assert.ok(
  manifest.icons.some((icon) => icon.src === "/icons/icon-192.png" && icon.type === "image/png"),
  "PNG 192 icon exists in manifest"
);
assert.ok(
  manifest.icons.some((icon) => icon.src === "/icons/icon-512.png" && icon.type === "image/png"),
  "PNG 512 icon exists in manifest"
);
assert.ok(
  manifest.icons.some((icon) => icon.src === "/icons/apple-touch-icon-180.png" && icon.type === "image/png"),
  "PNG apple touch icon exists in manifest"
);

for (const icon of manifest.icons) {
  assert.equal(existsSync(join(root, "public", icon.src.replace(/^\//, ""))), true, `icon exists: ${icon.src}`);
}

const index = readFileSync(indexPath, "utf8");
assert.match(index, /rel="apple-touch-icon"/, "index includes apple-touch-icon");
assert.match(index, /href="\/icons\/apple-touch-icon-180\.png"/, "index uses PNG apple-touch-icon");
assert.match(index, /font-display|display=swap/, "external font uses display swap");

const categoryIcons = readFileSync(categoryIconsPath, "utf8");
const categories = readFileSync(categoriesPath, "utf8");
const categoryIconComponent = readFileSync(categoryIconComponentPath, "utf8");
const ledgerContext = readFileSync(ledgerContextPath, "utf8");
assert.match(categoryIcons, /id:\s*"card"/, "card category icon exists");
assert.match(
  categoryIcons,
  /M18 6L6 18 M8 8a2 2 0 1 0 0\.01 0 M16 16a2 2 0 1 0 0\.01 0/,
  "percent icon uses the symmetric path"
);
assert.match(
  categoryIcons,
  /M8\.5 6\.5h5a2\.3 2\.3 0 0 1 0 4\.6H8\.5 M8\.5 11\.1h5\.4a2\.4 2\.4 0 0 1 0 4\.8H8\.5/,
  "bitcoin icon uses the minimal symbol path"
);
assert.match(categories, /id:\s*"card_bill"[\s\S]*?icon:\s*"card"/, "card bill uses the card icon");
assert.match(
  ledgerContext,
  /category\.id\s*===\s*"card_bill"\s*\?\s*builtIn\.icon\s*:\s*category\.icon/,
  "persisted card_bill categories are refreshed to the built-in card icon"
);
assert.match(categoryIconComponent, /hexToRgba\(c\.fg,\s*0\.1\)/, "category icon background opacity is minimal");
assert.match(categoryIconComponent, /strokeWidth="1\.6"/, "category icon stroke is lighter");

for (const iconName of ["icon-192.svg", "icon-512.svg", "maskable-icon.svg", "apple-touch-icon.svg"]) {
  const svg = readFileSync(join(root, "public", "icons", iconName), "utf8");
  assert.match(svg, /#f7931a/i, `${iconName} has orange receipt background`);
  assert.match(svg, /M14 8h20v32l-4-2-3 2-3-2-3 2-3-2-4 2z/, `${iconName} has receipt body`);
}

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
