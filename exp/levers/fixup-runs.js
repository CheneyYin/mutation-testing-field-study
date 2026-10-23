// fixup-runs: retro-parse dry-run seconds (minute-format aware) from cell logs into runs.jsonl.
const fs = require("fs");
const path = require("path");
const ROOT = path.join(__dirname, "..");
const RUNS = path.join(ROOT, "data", "runs.jsonl");
const rows = fs.readFileSync(RUNS, "utf8").trim().split("\n").map(JSON.parse);
for (const r of rows) {
  if (r.dryRunSeconds != null || r.repo !== "showdown") continue;
  const log = path.join(ROOT, "logs", `matrix-${r.cell}.log`);
  if (!fs.existsSync(log)) continue;
  const t = fs.readFileSync(log, "utf8");
  let m = t.match(/Ran (\d+) tests in (\d+) minutes? and (\d+) seconds/) || t.match(/Ran (\d+) tests in (\d+) seconds/);
  if (m) {
    r.dryRunSeconds = m.length === 4 ? +m[2] * 60 + +m[3] : +m[2];
    r.dryRunTests = +m[1];
    console.log(`${r.cell}: dryRunSeconds=${r.dryRunSeconds} (tests ${r.dryRunTests})`);
  } else console.log(`${r.cell}: no dry-run line found`);
}
fs.writeFileSync(RUNS, rows.map((r) => JSON.stringify(r)).join("\n") + "\n");
