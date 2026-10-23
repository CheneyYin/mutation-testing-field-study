// analyze: P1/P4 analysis lever. Reads data/runs.jsonl, matrix reports, detections, writers.
// Emits: cost table, H1 fit + held-out validation, H2 ladder table, H3 pair, hitLimit pair,
// killed-set invariance across concurrency, and (when P4 data exists) McNemar A-vs-B + Newcombe.
// Output: data/analysis.md + data/analysis.json
const fs = require("fs");
const path = require("path");
const D = path.join(__dirname, "..", "data");
const MAT = path.join(D, "matrix");

const runs = fs.readFileSync(path.join(D, "runs.jsonl"), "utf8").trim().split("\n").map(JSON.parse);
const byCell = Object.fromEntries(runs.map((r) => [r.cell, r]));
const report = (c) => {
  try { return JSON.parse(fs.readFileSync(path.join(MAT, `${c}.report.json`), "utf8")); } catch { return null; }
};

const out = { cost_table: [], h1: {}, h2: [], h3: {}, hitlimit: {}, invariance: {}, p4: {} };
const lines = [];

// ---- cost table ----
lines.push("# P1 cost table (showdown)", "", "| cell | conc | scope | wall s | cpu s | mutants | killed | survived | static | dry s | truncated |", "|---|---|---|---|---|---|---|---|---|---|---|");
for (const r of runs.filter((r) => r.repo === "showdown" && r.scope !== "ladder")) {
  lines.push(`| ${r.cell} | ${r.concurrency} | ${r.scope} | ${r.wallclock_s} | ${r.cpu_s ?? "?"} | ${r.total_mutants} | ${r.counts_by_state.Killed || 0} | ${r.counts_by_state.Survived || 0} | ${r.staticCount} | ${r.dryRunSeconds ?? "?"} | ${r.truncated} |`);
  out.cost_table.push({ cell: r.cell, conc: r.concurrency, scope: r.scope, wall: r.wallclock_s, cpu: r.cpu_s, mutants: r.total_mutants, killed: r.counts_by_state.Killed || 0, survived: r.counts_by_state.Survived || 0, static: r.staticCount, dry: r.dryRunSeconds, truncated: r.truncated });
}

// ---- H1: per-concurrency linear fit wall ~ dry + slope * ranMutants ----
// ranMutants = total - ignored (ignoreStatic=true cells). Held-out: second repeats.
function ran(r) { return r.total_mutants - (r.counts_by_state.Ignored || 0); }
function fit(cells) {
  // simple least squares on (ranMutants, wall - dryRunSeconds), intercept forced 0 plus overhead term
  const pts = cells.filter((c) => c.dryRunSeconds != null && !c.truncated).map((c) => [ran(c), Math.max(0, c.wallclock_s - c.dryRunSeconds)]);
  if (pts.length < 2) return null;
  const n = pts.length;
  let sxx = 0, sxy = 0;
  for (const [x, y] of pts) { sxx += x * x; sxy += x * y; }
  const slope = sxx ? sxy / sxx : 0;
  let ssr = 0, sst = 0;
  const ybar = pts.reduce((a, [, y]) => a + y, 0) / n;
  for (const [x, y] of pts) { ssr += (y - slope * x) ** 2; sst += (y - ybar) ** 2; }
  return { slope, r2: sst ? 1 - ssr / sst : null, n };
}
const concs = [...new Set(runs.filter((r) => r.scope !== "ladder" && !r.truncated && r.dryRunSeconds != null && r.ignoreStatic && r.hitLimit === "default").map((r) => r.concurrency))];
const fits = {};
for (const c of concs) {
  const cells = runs.filter((r) => r.concurrency === c && r.scope !== "ladder" && !r.truncated && r.dryRunSeconds != null && r.ignoreStatic && r.hitLimit === "default");
  const train = cells.filter((r) => !/_r2$/.test(r.cell));
  const heldout = cells.filter((r) => /_r2$/.test(r.cell));
  const f = fit(train);
  if (f) {
    fits[c] = f;
    let preds = [];
    for (const h of heldout) preds.push({ cell: h.cell, actual: h.wallclock_s, predicted: +(h.dryRunSeconds + f.slope * ran(h)).toFixed(1), err_pct: +(((h.dryRunSeconds + f.slope * ran(h)) - h.wallclock_s) / h.wallclock_s * 100).toFixed(1) });
    fits[c].heldout = preds;
  }
}
if (fits[1] && fits[2] && fits[4]) {
  const p2 = fits[1].slope / fits[2].slope, p4 = fits[1].slope / fits[4].slope;
  out.h1 = { fits, effective_parallelism: { conc2: +p2.toFixed(2), conc4: +p4.toFixed(2) } };
  lines.push("", "## H1", "", `Per-mutant slope by concurrency: c1=${fits[1].slope.toFixed(3)}s c2=${fits[2].slope.toFixed(3)}s c4=${fits[4].slope.toFixed(3)}s (r2: ${fits[1].r2?.toFixed(3)}/${fits[2].r2?.toFixed(3)}/${fits[4].r2?.toFixed(3)})`, `Effective parallelism vs conc1: conc2=${p2.toFixed(2)}, conc4=${p4.toFixed(2)}`, "");
  for (const c of concs) for (const h of (fits[c].heldout || [])) lines.push(`- held-out ${h.cell}: actual ${h.actual}s vs predicted ${h.predicted}s (${h.err_pct}%)`);
}

// ---- H3: ignoreStatic pair ----
const h3f = byCell["h3_false"], h3t = byCell["s_c2_r1"];
if (h3f && h3t) {
  const savings = h3f.wallclock_s - h3t.wallclock_s;
  const predStatic = h3t.staticCount * (h3t.dryRunSeconds || 0) / h3t.concurrency;
  out.h3 = { wall_ignoreStatic_true: h3t.wallclock_s, wall_ignoreStatic_false: h3f.wallclock_s, savings, truncated: h3f.truncated, predicted_static_term: +predStatic.toFixed(1) };
  lines.push("", "## H3 (ignoreStatic pair, small scope, conc2)", "", `wall(true)=${h3t.wallclock_s}s wall(false)=${h3f.wallclock_s}${h3f.truncated ? " (TRUNCATED at cap, lower bound)" : ""}s -> savings=${savings.toFixed(0)}s`, `H3 corrected model prediction: staticCount(${h3t.staticCount}) x suiteTime(${h3t.dryRunSeconds}s) / conc(${h3t.concurrency}) = ${predStatic.toFixed(0)}s`);
}

// ---- hitLimit pair ----
const hl = byCell["hl_high"];
if (hl && h3t) {
  out.hitlimit = { default_wall: h3t.wallclock_s, high_wall: hl.wallclock_s, timeouts_default: h3t.counts_by_state.Timeout, timeouts_high: hl.counts_by_state.Timeout };
  lines.push("", "## hitLimit pair (small, conc2)", "", `default: ${h3t.wallclock_s}s (timeouts ${h3t.counts_by_state.Timeout}) vs high: ${hl.wallclock_s}s (timeouts ${hl.counts_by_state.Timeout})`);
}

// ---- H2 ladder ----
const ladder = runs.filter((r) => r.scope === "ladder");
for (const k of [1, 10, 100]) {
  const b = byCell[`ladder_k${k}_base`], rr = byCell[`ladder_k${k}_rerun`];
  if (b && rr) {
    const cpu = (r) => (r.cpu_user_s != null ? +(r.cpu_user_s + (r.cpu_sys_s || 0)).toFixed(0) : null);
    const saving = cpu(b) && cpu(rr) ? (100 - cpu(rr) / cpu(b) * 100).toFixed(0) : null;
    out.h2.push({ k, base_cpu_s: cpu(b), rerun_cpu_s: cpu(rr), cpu_saving_pct: saving, reused: rr.reusedCount, reuse_total: rr.reuseTotal });
    lines.push(`- k=${k}: base ${cpu(b)}s cpu -> rerun ${cpu(rr)}s cpu (${saving}% saved), reused ${rr.reusedCount}/${rr.reuseTotal}`);
  }
}
if (out.h2.length) lines.unshift("", "## H2 incremental ladder (comment-only patches)", "");

// ---- killed-set invariance across concurrency (small scope) ----
function killedSet(c) {
  const rep = report(c);
  if (!rep) return null;
  const s = new Set();
  for (const f of Object.values(rep.files)) for (const [id, mu] of Object.entries(f.mutants)) if (mu.status === "Killed" || mu.status === "Timeout") s.add(id);
  return s;
}
const inv = {};
for (const pair of [["s_c1_r1", "s_c2_r1"], ["s_c2_r1", "s_c4_r1"]]) {
  const [x, y] = pair.map(killedSet);
  if (x && y) {
    const flips = [...x].filter((id) => !y.has(id));
    inv[pair.join("_vs_")] = { flips_count: flips.length, killed_x: x.size, killed_y: y.size };
  }
}
out.invariance = inv;
if (Object.keys(inv).length) {
  lines.push("", "## Killed-set invariance across concurrency (Killed+Timeout ids)", "");
  for (const [k, v] of Object.entries(inv)) lines.push(`- ${k}: ${v.killed_x} vs ${v.killed_y} killed, ${v.flips_count} flips`);
}

// ---- P4 (filled when data exists) ----
try {
  const det = fs.readFileSync(path.join(D, "detections-p4.jsonl"), "utf8").trim().split("\n").map(JSON.parse);
  const headroom = JSON.parse(fs.readFileSync(path.join(D, "headroom.json"), "utf8"));
  const arms = { A: ["a1", "a2", "a3"], B: ["b1", "b2", "b3"], C: ["base"] };
  const detect = (ver, defect) => {
    const rows = det.filter((d) => d.suite_version === ver && d.defect === defect);
    if (!rows.length) return null;
    return rows.some((r) => r.failing_tests.some((t) => t && t !== "__RUNTIME_ERROR__"));
  };
  // writer-aggregate suites: arm detected if ANY writer suite detects
  const armDetect = (arm, defect) => arms[arm].some((ver) => detect(ver, defect));
  let b = 0, c = 0;
  for (const d of headroom) {
    const a = armDetect("A", d.fix_sha), bb = armDetect("B", d.fix_sha);
    if (a && !bb) b++; else if (bb && !a) c++;
  }
  const n = headroom.length;
  const p = (i) => (i === 0 ? 1 : Array.from({ length: i }, (_, j) => j + 1).reduce((acc, j) => acc * (n - j + 1) / (n + j), 1 / 2 ** n * comb(n, i)));
  function comb(nn, kk) { let r = 1; for (let i = 0; i < kk; i++) r = (r * (nn - i)) / (i + 1); return r; }
  function mcnemarP(b, c) {
    if (b + c === 0) return 1;
    let p = 0;
    for (let i = 0; i <= Math.min(b, c); i++) p += comb(b + c, i) / 2 ** (b + c);
    return Math.min(1, 2 * p);
  }
  const mP = mcnemarP(b, c);
  out.p4 = { n_headroom: n, discordant_A_only: b, discordant_B_only: c, mcnemar_exact_p: +mP.toFixed(4) };
  lines.push("", "## P4 quality (A vs B, writer-aggregate, headroom defects)", "", `n=${n}, A-only detections=${b}, B-only=${c}, exact McNemar p=${mP.toFixed(4)}`);
  for (const arm of ["A", "B", "C"]) {
    const det_n = headroom.filter((d) => (arm === "C" ? detect("base", d.fix_sha) : armDetect(arm, d.fix_sha))).length;
    lines.push(`- arm ${arm}: ${det_n}/${n} detected (${(det_n / n * 100).toFixed(0)}%)`);
    out.p4[`arm_${arm}_detected`] = det_n;
  }
} catch {}

// ---- post-arm mutation scores (4-file frame, pinned config) ----
try {
  const scores = fs.readFileSync(path.join(D, "scores.jsonl"), "utf8").trim().split("\n").map(JSON.parse);
  if (scores.length) {
    lines.push("", "## Post-arm mutation scores (4-file frame, ignoreStatic=true, conc2 amendment, pinned)", "", "| suite | mutants | killed | survived | covered-kill % |", "|---|---|---|---|---|");
    const armOf = (s) => (s === "base" ? "C" : s[0] === "a" ? "A" : "B");
    const armRates = { A: [], B: [] };
    for (const s of scores) {
      if (!s.total_mutants) continue;
      const killed = (s.counts_by_state.Killed || 0) + (s.counts_by_state.Timeout || 0);
      const cov = s.total_mutants - (s.counts_by_state.NoCoverage || 0) - (s.counts_by_state.Ignored || 0);
      const pct = cov > 0 ? (killed / cov * 100).toFixed(1) : "n/a";
      lines.push(`| ${s.suite} | ${s.total_mutants} | ${killed} | ${s.counts_by_state.Survived || 0} | ${pct} |`);
      const arm = armOf(s.suite);
      if (arm !== "C" && cov > 0) armRates[arm].push(killed / cov);
    }
    const mean = (a) => (a.length ? (a.reduce((x, y) => x + y, 0) / a.length * 100).toFixed(1) : null);
    out.post_arm_scores = { suites: scores.length, arm_A_kill_pct_mean: mean(armRates.A), arm_B_kill_pct_mean: mean(armRates.B) };
    lines.push("", `Arm mean covered-kill rate: A=${mean(armRates.A)}% (n=${armRates.A.length}), B=${mean(armRates.B)}% (n=${armRates.B.length})`);
  }
} catch {}

lines.push("", "## Environment", "", `cores=${runs[0]?.cores} cpu=${runs[0]?.cpu_model} node=${runs[0]?.node_ver} stryker=${runs[0]?.stryker_ver}`);
fs.writeFileSync(path.join(D, "analysis.md"), lines.join("\n") + "\n");
fs.writeFileSync(path.join(D, "analysis.json"), JSON.stringify(out, null, 2));
console.log(lines.join("\n"));
