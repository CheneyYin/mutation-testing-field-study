// Stage 2 funnel measurement for one cloned repo (cwd = clone root).
// Usage: node stage2-measure.js <owner/name>. Prints one TSV row.
const { execSync } = require("child_process");
const fs = require("fs");
const path = require("path");

const repo = process.argv[2];
const sh = (cmd) => execSync(cmd, { encoding: "utf8", maxBuffer: 1 << 26 }).trim();

const pkg = JSON.parse(fs.readFileSync("package.json", "utf8"));
const devDeps = Object.keys(pkg.devDependencies || {});
const testScript = (pkg.scripts && pkg.scripts.test) || "";
const runnerNames = ["vitest", "jest", "mocha", "jasmine", "ava", "tap", "tape", "lab"];
const found = new Set();
for (const d of devDeps) {
  const m = runnerNames.find((r) => d === r || d.startsWith(r + "-"));
  if (m) found.add(m);
}
for (const r of runnerNames) if (testScript.includes(r)) found.add(r);
const runner = [...found].sort().join("+") || "?";
const runnerOk = found.has("jest") || found.has("vitest");

const EXCLUDE = [/\.(d|test|spec)\.[cm]?[jt]sx?$/, /(^|\/)(__tests__|tests?|__mocks__|fixtures|coverage|dist|build|node_modules)\//];
function isSrcFile(p) {
  return /\.[cm]?[jt]sx?$/.test(p) && !EXCLUDE.some((re) => re.test(p));
}
let srcDir = "none";
let loc = 0;
for (const d of ["src", "lib", "source"]) {
  if (!fs.existsSync(d)) continue;
  let n = 0;
  const walk = (dir) => {
    for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
      const p = path.join(dir, e.name);
      if (e.isDirectory()) walk(p);
      else if (isSrcFile(p)) n += fs.readFileSync(p, "utf8").split("\n").length;
    }
  };
  walk(d);
  if (n > loc) { loc = n; srcDir = d; }
}
const locOk = loc >= 5000 && loc <= 50000;

const greps = ["fix", "bug", "correct", "handle", "patch"].flatMap((g) => ["--grep", g]);
const fixTotal = sh(`git log --format=%H --regexp-ignore-case ${greps.map((g) => (g === "--grep" ? g : `"${g}"`)).join(" ")} | wc -l`);
const fix730 = sh(`git log --format=%H --regexp-ignore-case --since="730 days ago" ${greps.map((g) => (g === "--grep" ? g : `"${g}"`)).join(" ")} | wc -l`);
const fixOk = Number(fixTotal) >= 30;

const gate = runnerOk && locOk && fixOk ? "PASS" : "FAIL";
console.log([repo, runner, String(loc), srcDir, fixTotal, fix730, gate].join("\t"));
