#!/usr/bin/env bash
# run-p4: final differential detection across suite versions (base + writers) x headroom defects.
# Usage: bash run-p4.sh
# For each (suite_version, defect): reset+verify clean, overlay writer tests, apply defect,
# detect 2 rounds, reset. Env: DETECT_RUNNER per repo. Output: data/detections-p4.jsonl
set -uo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
OUT="$ROOT/data/detections-p4.jsonl"
[ -f "$OUT" ] || touch "$OUT"

run_repo() { # $1=repo  $2=runner  $3=suite_version  $4=suite_dir(or NONE)
  local repo="$1" runner="$2" ver="$3" sdir="$4"
  local R="$ROOT/repos/$repo"
  export DETECT_RUNNER="$runner"
  cd "$R"
  node -e '
    const fs=require("fs");
    const det=fs.readFileSync(process.env.OUT,"utf8").trim().split("\n").filter(Boolean).map(JSON.parse)
      .filter(d=>d.suite_version===process.env.VER);
    const done=new Set();
    for (const d of det) if (det.filter(x=>x.defect===d.defect&&x.suite_version===d.suite_version).length>=2) done.add(d.defect);
    const head=JSON.parse(fs.readFileSync(process.env.HEAD).trim()||"[]");
    for (const h of head) if (h.repo===process.env.REPO_TAG && !done.has(h.fix_sha)) console.log(h.fix_sha);
  ' || true
}

for repo in showdown sql-formatter; do
  runner=$([ "$repo" = showdown ] && echo vitest || echo jest)
  R="$ROOT/repos/$repo"
  for ver in base a1 a2 a3 b1 b2 b3; do
    sdir="$ROOT/data/suites/$ver/$repo"
    [ -d "$sdir" ] || [ "$ver" = base ] || continue
    cd "$R"
    git checkout -- . 2>/dev/null; git clean -fdq 2>/dev/null
    [ -z "$(git status --porcelain)" ] || { echo "ABORT: $repo tree dirty"; exit 1; }
    # count pending defects for this (repo, ver)
    export OUT="$OUT" VER="$ver" REPO_TAG="$repo" HEAD="$ROOT/data/headroom.json"
    pend=$(node -e '
      const fs=require("fs");
      let det=[]; try{det=fs.readFileSync(process.env.OUT,"utf8").trim().split("\n").filter(Boolean).map(JSON.parse).filter(d=>d.suite_version===process.env.VER);}catch{}
      const done=new Set();
      for (const d of det) if (det.filter(x=>x.defect===d.defect).length>=2) done.add(d.defect);
      const head=JSON.parse(fs.readFileSync(process.env.HEAD));
      console.log(head.filter(h=>h.repo===process.env.REPO_TAG&&!done.has(h.fix_sha)).map(h=>h.fix_sha).join("\n"));
    ')
    [ -z "$pend" ] && { echo "skip $repo/$ver (done)"; continue; }
    echo "=== $repo / suite $ver"
    if [ "$ver" != base ]; then
      ( cd "$sdir" && find . -type f ) | while read -r f; do
        rel="${f#./}"
        mkdir -p "$R/$(dirname "$rel")"
        cp "$sdir/$rel" "$R/$rel"
      done
    fi
    printf '%s\n' "$pend" | while IFS= read -r sha; do
      git checkout -- . 2>/dev/null; git clean -fdq 2>/dev/null
      if [ "$ver" != base ]; then
        ( cd "$sdir" && find . -type f ) | while read -r f; do
          rel="${f#./}"
          cp "$sdir/$rel" "$R/$rel"
        done
      fi
      REPO_DIR="$R" bash "$ROOT/levers/apply-defect.sh" "$sha" apply || { echo "APPLY FAIL $sha"; continue; }
      for round in 1 2; do
        bash "$ROOT/levers/detect.sh" "$sha" "$ver" "$round" "$OUT"
      done
      git checkout -- . 2>/dev/null; git clean -fdq 2>/dev/null
      [ -z "$(git status --porcelain)" ] && echo "detected $sha ($ver)" || echo "WARNING: dirty after $sha ($ver)"
    done
  done
done
echo "P4 DETECTIONS: $(wc -l < "$OUT") rows"
