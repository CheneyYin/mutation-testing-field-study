// run-matrix lever (P1): executes the preregistered timing matrix, writes runs.jsonl.
// Resumable: cells with recorded verdicts are skipped. Per-cell wall-clock cap via timeout.
// All configs derived from the smoke-validated base (vitest.related=false, disableTypeChecks=false).
// Cell order fixed: small-conc2 first (calibration), then ascending cost.
const { execSync, spawnSync } = require("child_process");
const fs = require("fs");
const path = require("path");

const ROOT = path.join(__dirname, "..");
const REPO = path.join(ROOT, "repos", "showdown");
const MAT = path.join(ROOT, "data", "matrix");
const RUNS = path.join(ROOT, "data", "runs.jsonl");
const LOGS = path.join(ROOT, "logs");
fs.mkdirSync(MAT, { recursive: true });

const SMALL = ["src/subParsers/makehtml/heading.js"];
const MEDIUM = [
  "src/subParsers/makehtml/paragraphs.js",
  "src/subParsers/makehtml/codeBlock.js",
  "src/helpers/hashHTMLBlocks.js",
];
const FULL = ["src/**/*.js"];
// Amendment (matrix revision, recorded): medium conc1 and full-repo cells dropped
// (measured rates put them over any useful cap; conc1 slope from s_c1_r1, scale from l_c4_r1).
// l_c4_r1 = 8-file frame (data/frame.json), doubles as P3 guidance run for Arm A.
const FRAME = JSON.parse(fs.readFileSync(path.join(ROOT, "data", "frame.json"), "utf8"));
const LARGE = FRAME.showdown;
for (const f of MEDIUM) {
  if (!fs.existsSync(path.join(REPO, f))) throw new Error(`medium scope file missing: ${f}`);
}

const CELLS = [
  { id: "s_c4_r1b", scope: SMALL, conc: 4, ignoreStatic: true, cap: 2700 },
  { id: "m_c2_r1", scope: MEDIUM, conc: 2, ignoreStatic: true, cap: 2700 },
  { id: "m_c4_r1", scope: MEDIUM, conc: 4, ignoreStatic: true, cap: 2700 },
  { id: "m_c2_r2", scope: MEDIUM, conc: 2, ignoreStatic: true, cap: 2700 },
  { id: "m_c4_r2", scope: MEDIUM, conc: 4, ignoreStatic: true, cap: 2700 },
  { id: "l_c4_r1", scope: LARGE, conc: 4, ignoreStatic: true, cap: 5400 },
  { id: "h3_false", scope: SMALL, conc: 2, ignoreStatic: false, cap: 5400 },
  { id: "hl_high", scope: SMALL, conc: 2, ignoreStatic: true, hitLimit: 1000000, cap: 2700 },
];

const done = new Set();
if (fs.existsSync(RUNS)) {
  for (const l of fs.readFileSync(RUNS, "utf8").trim().split("\n").filter(Boolean)) {
    try { done.add(JSON.parse(l).cell); } catch {}
  }
}

const envInfo = {
  cores: require("os").cpus().length,
  cpu_model: (require("os").cpus()[0] || {}).model || "?",
  node_ver: process.version,
};
let strykerVer = "?";
try { strykerVer = execSync("npx stryker --version", { cwd: REPO, encoding: "utf8" }).trim().split("\n").pop(); } catch {}

const sh = (cmd, opts = {}) => execSync(cmd, { cwd: REPO, encoding: "utf8", maxBuffer: 1 << 26, ...opts });
const requireClean = () => {
  execSync("rm -rf .stryker-tmp", { cwd: REPO });
  const s = sh("git status --porcelain").split("\n").filter((l) => l.trim() && !l.includes(".stryker-tmp"));
  if (s.length) throw new Error(`tree not clean:\n${s.join("\n")}`);
};

const parseTimeFile = (p) => {
  const t = fs.readFileSync(p, "utf8");
  const grab = (re) => { const m = t.match(re); return m ? parseFloat(m[1].replace(",", ".")) : null; };
  return { wall: grab(/Elapsed \(wall clock\) time[^:]*: (\d+:\d+[\d:.]*|\d+[\d.]*)/), user: grab(/User time[^:]*: (\d+[\d.,]*)/), sys: grab(/System time[^:]*: (\d+[\d.,]*)/) };
};
const wallToSec = (w) => {
  if (w == null) return null;
  if (typeof w === "number") return w;
  const parts = String(w).split(":").map(Number);
  return parts.length === 3 ? parts[0] * 3600 + parts[1] * 60 + parts[2] : parts.length === 2 ? parts[0] * 60 + parts[1] : parts[0];
};

for (const cell of CELLS) {
  if (done.has(cell.id)) { console.log(`skip ${cell.id}`); continue; }
  const cfgPath = path.join(MAT, `${cell.id}.config.json`);
  const reportPath = path.join(MAT, `${cell.id}.report.json`);
  const logPath = path.join(LOGS, `matrix-${cell.id}.log`);
  const timePath = path.join(MAT, `${cell.id}.time`);
  const cfg = {
    testRunner: "vitest",
    reporters: ["clear-text", "json"],
    jsonReporter: { fileName: reportPath },
    mutate: cell.scope,
    vitest: { related: false },
    disableTypeChecks: false,
    concurrency: cell.conc,
    timeoutMS: 5000,
    ignoreStatic: cell.ignoreStatic,
  };
  if (cell.hitLimit) cfg.hitLimit = cell.hitLimit;
  fs.writeFileSync(cfgPath, JSON.stringify(cfg, null, 2) + "\n");
  const fingerprint = execSync(`sha256sum ${cfgPath}`, { encoding: "utf8" }).split(" ")[0] + "+" + strykerVer;

  requireClean();
  execSync("rm -rf .stryker-tmp", { cwd: REPO });
  const t0 = Date.now();
  const res = spawnSync(
    `/usr/bin/time -v -o ${timePath} timeout ${cell.cap} npx stryker run ${cfgPath}`,
    { cwd: REPO, shell: "/bin/bash", stdio: ["ignore", "pipe", "pipe"], maxBuffer: 1 << 28 }
  );
  const wallS = (Date.now() - t0) / 1000;
  const rc = res.status;
  fs.writeFileSync(logPath, res.stdout ? res.stdout.toString() : "");
  if (res.stderr) fs.appendFileSync(logPath, res.stderr.toString());
  const tm = parseTimeFile(timePath);
  const log = fs.readFileSync(logPath, "utf8");

  let dryRunS = null, dryRunTests = null, reused = null, reuseTotal = null;
  let m = log.match(/Ran (\d+) tests in (\d+) seconds/);
  if (m) { dryRunTests = +m[1]; dryRunS = +m[2]; }
  if (dryRunS == null) {
    m = log.match(/Ran (\d+) tests in (\d+) minutes? and (\d+) seconds/);
    if (m) { dryRunTests = +m[1]; dryRunS = +m[2] * 60 + +m[3]; }
  }
  m = log.match(/Result:\s+(\d+) of (\d+) mutant result/);
  if (m) { reused = +m[1]; reuseTotal = +m[2]; }

  let counts = {}, total = 0, staticCount = 0, score = null;
  try {
    const rep = JSON.parse(fs.readFileSync(reportPath, "utf8"));
    for (const f of Object.values(rep.files)) {
      for (const mu of Object.values(f.mutants)) {
        counts[mu.status] = (counts[mu.status] || 0) + 1;
        total++;
        if (mu.static) staticCount++;
      }
    }
    score = rep.thresholds ? undefined : undefined;
  } catch {}
  const row = {
    cell: cell.id, repo: "showdown", config_fingerprint: fingerprint,
    scope: cell.scope.length === 1 && cell.scope[0].includes("*") ? "full" : cell.scope.length === 1 ? "small" : cell.scope.length === 3 ? "medium" : cell.scope.length === 8 ? "large" : "?",
    mutate: cell.scope, concurrency: cell.conc, ignoreStatic: cell.ignoreStatic, hitLimit: cell.hitLimit || "default",
    exit_code: rc, truncated: rc === 124, wallclock_s: +wallS.toFixed(1),
    time_wall_s: wallToSec(tm.wall), cpu_user_s: tm.user, cpu_sys_s: tm.sys, cpu_s: tm.user != null && tm.sys != null ? +(tm.user + tm.sys).toFixed(1) : null,
    dryRunSeconds: dryRunS, dryRunTests, reusedCount: reused, reuseTotal,
    total_mutants: total, counts_by_state: counts, staticCount,
    cores: envInfo.cores, cpu_model: envInfo.cpu_model, node_ver: envInfo.node_ver, stryker_ver: strykerVer,
    ts: new Date().toISOString(),
  };
  fs.appendFileSync(RUNS, JSON.stringify(row) + "\n");
  console.log(`done ${cell.id}: rc=${rc} wall=${wallS.toFixed(0)}s mutants=${total} killed=${counts.Killed || 0} survived=${counts.Survived || 0} static=${staticCount}${row.truncated ? " TRUNCATED" : ""}`);
  execSync("rm -rf .stryker-tmp", { cwd: REPO });
  requireClean();
}
console.log("MATRIX DRIVER COMPLETE");
