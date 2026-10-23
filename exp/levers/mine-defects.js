#!/usr/bin/env node
// mine-defects lever: mine bugfix candidates from frozen repo history.
// Output: exp/data/defects.raw.jsonl (one row per candidate, manual_confirmed=0).
// Classification:
//   src_paths   = changed paths under src/
//   test_paths  = changed paths under test/
//   other_paths = everything else (docs, build, etc.)
// Include candidate if src_paths non-empty.
// Test-only commits (no src changes) are mined separately into exp/data/testonly.jsonl.
// Self-proof: rerun on same HEAD must byte-reproduce defects.raw.jsonl (deterministic git log).
const { execSync } = require("child_process");
const fs = require("fs");
const path = require("path");

const repo = process.argv[2] || path.join(__dirname, "..", "repos", "showdown");
const prefix = process.argv[3] || "";
const outDir = path.join(__dirname, "..", "data");
const sh = (cmd) => execSync(cmd, { cwd: repo, encoding: "utf8", maxBuffer: 1 << 28 }).trim();

const greps = ["fix", "bug", "correct", "handle", "patch"].map((g) => `--grep=${g}`).join(" ");
const logFmt = "%H%x1f%P%x1f%ct%x1f%s";
const commits = sh(`git log --regexp-ignore-case ${greps} --format="${logFmt}"`).split("\n").filter(Boolean);

const rows = [];
const testOnly = [];
for (const line of commits) {
  const [sha, parents, ct, subject] = line.split("\x1f");
  const files = sh(`git diff-tree --no-commit-id --name-only -r ${sha}`).split("\n").filter(Boolean);
  if (files.length === 0) continue;
  const src = files.filter((f) => f.startsWith("src/"));
  const test = files.filter((f) => f.startsWith("test/"));
  const other = files.filter((f) => !f.startsWith("src/") && !f.startsWith("test/"));
  if (src.length === 0) {
    if (test.length > 0 && other.length === 0 && /^(test|spec)/i.test(subject)) {
      testOnly.push({ sha, subject, test_paths: test });
    }
    continue;
  }
  const isMerge = parents.split(" ").length > 1;
  rows.push({
    fix_sha: sha,
    parent_sha: parents.split(" ")[0],
    commit_ts: Number(ct),
    msg: subject,
    is_merge: isMerge,
    src_paths: src,
    test_paths: test,
    other_paths: other,
    manual_confirmed: false,
    excluded_reason: null,
    contaminated_by_test_commit: null,
  });
}

fs.mkdirSync(outDir, { recursive: true });
fs.writeFileSync(path.join(outDir, `${prefix}defects.raw.jsonl`), rows.map((r) => JSON.stringify(r)).join("\n") + "\n");
fs.writeFileSync(path.join(outDir, `${prefix}testonly.jsonl`), testOnly.map((r) => JSON.stringify(r)).join("\n") + "\n");
console.log(`candidates: ${rows.length} (merges: ${rows.filter((r) => r.is_merge).length}), test-only commits: ${testOnly.length}`);
