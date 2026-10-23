#!/usr/bin/env bash
# run-detections: for each confirmed clean-applying defect, apply, detect (2 rounds), reset, verify.
# Usage: run-detections.sh <repo_dir> <suite_version> [sha-filter]
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
REPO="$1"; VER="$2"; FILTER="${3:-}"
OUT="$ROOT/data/detections.jsonl"
LEV="$ROOT/levers"
CLEAN_REF="$ROOT/data/clean-HEAD.jsonl"
DEFILE="${DEFILE:-$ROOT/data/defects.jsonl}"
REPO_TAG="${REPO_TAG:-showdown}"
case "$1" in /*) REPO="$1" ;; *) REPO="$PWD/$1" ;; esac
export REPO_DIR="$REPO"
cd "$REPO"

require_clean() {
  [ -z "$(git status --porcelain)" ] || { echo "TREE NOT CLEAN, aborting" >&2; git status --porcelain | head -5 >&2; exit 1; }
}

# one-time clean-HEAD reference run with the JSON reporter (detection-path equivalence)
if [ ! -f "$CLEAN_REF" ]; then
  require_clean
  t0=$(date +%s)
  timeout 300 env CI=true npx vitest run --reporter=json --outputFile=/tmp/opencode/clean-head.json --silent >/dev/null 2>&1
  rc=$?
  node -e '
    const fs=require("fs");
    const j=JSON.parse(fs.readFileSync("/tmp/opencode/clean-head.json","utf8"));
    console.log(JSON.stringify({suite_version: process.argv[1], exit_code: Number(process.argv[2]), total: j.numTotalTests, passed: j.numPassedTests, failed: j.numFailedTests, ts: new Date().toISOString()}));
  ' "$VER" "$rc" >> "$CLEAN_REF"
fi

node -e '
const fs=require("fs");
const rows=fs.readFileSync(process.env.DEFILE,"utf8").trim().split("\n").map(JSON.parse)
  .filter(r=>r.manual_confirmed && r.apply_check==="clean" && (r.repo||"showdown")===process.env.REPO_TAG);
let done=new Set();
try {
  const det=fs.readFileSync(process.env.OUT,"utf8").trim().split("\n").map(JSON.parse)
    .filter(d=>d.suite_version===process.env.VER);
  for (const d of det) { if (det.filter(x=>x.defect===d.defect).length>=2) done.add(d.defect); }
} catch {}
for (const r of rows) if (!done.has(r.fix_sha) && (!process.env.SHA_FILTER || r.fix_sha.startsWith(process.env.SHA_FILTER))) console.log(r.fix_sha);
' | while IFS= read -r sha; do
  require_clean
  if ! bash "$LEV/apply-defect.sh" "$sha" apply; then
    echo "APPLY FAILED $sha" >&2; continue
  fi
  for round in 1 2; do
    bash "$LEV/detect.sh" "$sha" "$VER" "$round" "$OUT"
  done
  git checkout -- src/ 2>/dev/null || true
  git clean -fdq 2>/dev/null || true
  require_clean
  echo "detected $sha"
done
echo "detections now: $(wc -l < "$OUT") rows"
