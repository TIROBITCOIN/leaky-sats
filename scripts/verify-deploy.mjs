import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

const root = process.cwd();
const vercelPath = join(root, "vercel.json");
const deploymentPath = join(root, "docs", "DEPLOYMENT.md");
const readmePath = join(root, "README.md");

assert.equal(existsSync(vercelPath), true, "vercel.json exists");
const vercel = JSON.parse(readFileSync(vercelPath, "utf8"));
assert.equal(vercel.buildCommand, "npm run build", "Vercel build command");
assert.equal(vercel.outputDirectory, "dist", "Vercel output directory");
assert.ok(Array.isArray(vercel.rewrites), "Vercel rewrites exist");
assert.ok(vercel.rewrites.some((rewrite) => rewrite.source === "/(.*)" && rewrite.destination === "/index.html"), "Vercel SPA rewrite");
assert.ok(Array.isArray(vercel.headers), "Vercel headers exist");
assert.ok(
  vercel.headers.some((entry) => entry.source === "/sw.js" && JSON.stringify(entry).includes("no-cache")),
  "Vercel service worker cache rule"
);

assert.equal(existsSync(deploymentPath), true, "deployment docs exist");
const deployment = readFileSync(deploymentPath, "utf8");
const readme = readFileSync(readmePath, "utf8");
assert.match(deployment, /https:\/\/leaky-sats\.vercel\.app/, "deployment docs include stable Vercel URL");
assert.doesNotMatch(deployment, /Netlify/i, "deployment docs do not direct users to Netlify");
assert.match(readme, /DEPLOYMENT\.md/, "README links deployment docs");
assert.match(readme, /https:\/\/leaky-sats\.vercel\.app/, "README includes stable Vercel URL");

console.log("verify:deploy passed");
