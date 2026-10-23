// compute-frame: deterministic stimulus/mutation frame (amendment 10/11).
// Frame = src files of the 7 headroom defects + alphabetical fill to 8 files per repo.
// Rationale: budget-feasible, identical frame for both arms (fair A-vs-B contrast),
// includes defect files so the contrast has a chance of measurable headroom.
// Excludes generated code (sql-formatter grammar.ts) and non-mutatable assets.
const fs = require("fs");
const path = require("path");
const { execSync } = require("child_process");
const ROOT = path.join(__dirname, "..");

const head = JSON.parse(fs.readFileSync(path.join(ROOT, "data", "headroom.json"), "utf8"));
const MUTATABLE = (f) => !/grammar\.ne$|grammar\.ts$/.test(f); // .ne is grammar source (not runtime), .ts is generated
const pick = (repo) => [...new Set(head.filter((h) => h.repo === repo).flatMap((h) => h.src_paths).filter(MUTATABLE))];
const frame = { showdown: pick("showdown"), "sql-formatter": pick("sql-formatter") };

const fill = (repo, listCmd, filter) => {
  const all = execSync(listCmd, { cwd: path.join(ROOT, "repos", repo), encoding: "utf8" })
    .split("\n").map((s) => s.trim()).filter(Boolean).filter(filter).sort();
  for (const f of all) {
    if (frame[repo].length >= 8) break;
    if (!frame[repo].includes(f)) frame[repo].push(f);
  }
};
fill("showdown", "find src -name '*.js' -type f", (f) => !/\/(cli)\//.test(f));
fill("sql-formatter", "find src -name '*.ts' -type f", (f) => !/grammar\.ts$|grammar\.ne$|__tests__/.test(f));

fs.writeFileSync(path.join(ROOT, "data", "frame.json"), JSON.stringify(frame, null, 1));
console.log(JSON.stringify(frame, null, 1));
