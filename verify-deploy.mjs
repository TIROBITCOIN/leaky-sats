import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

const root = process.cwd();
const netlifyPath = join(root, "netlify.toml");
const vercelPath = join(root, "vercel.json");
const deploymentPath = join(root, "docs", "DEPLOYMENT.md");
const readmePath = join(root, "README.md");

assert.equal(existsSync(netlifyPath), true, "netlify.toml exists");
const netlify = readFileSync(netlifyPath, "utf8");
assert.match(netlify, /command\s*=\s*"npm run build"/, "Netlify build command");
assert.match(netlify, /publish\s*=\s*"dist"/, "Netlify publish directory");
assert.match(netlify, /from\s*=\s*"\/\*"/, "Netlify SPA redirect source");
assert.match(netlify, /to\s*=\s*"\/index\.html"/, "Netlify SPA redirect target");
assert.match(netlify, /status\s*=\s*200/, "Netlify SPA redirect status");

assert.equal(existsSync(vercelPath), true, "vercel.json exists");
const vercel = JSON.parse(readFileSync(vercelPath, "utf8"));
assert.equal(vercel.buildCommand, "npm run build", "Vercel build command");
assert.equal(vercel.outputDirectory, "dist", "Vercel output directory");
assert.ok(Array.isArray(vercel.rewrites), "Vercel rewrites exist");
assert.ok(vercel.rewrites.some((rewrite) => rewrite.source === "/(.*)" && rewrite.destination === "/index.html"), "Vercel SPA rewrite");

assert.equal(existsSync(deploymentPath), true, "deployment docs exist");
const readme = readFileSync(readmePath, "utf8");
assert.match(readme, /DEPLOYMENT\.md/, "README links deployment docs");

console.log("verify:deploy passed");
