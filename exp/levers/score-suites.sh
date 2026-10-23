#!/usr/bin/env bash
# post-arm mutation scores: score each writer suite at the pinned config
# (4-file frame, ignoreStatic=true, conc 2 amendment) IN THE FROZEN REPO with
# overlay-then-restore (P4 battle-tested pattern; guarantees a real node_modules —
# Stryker's sandbox turns a symlinked node_modules into an empty dir, breaking the suite).
# Usage: bash score-suites.sh
set -uo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
REPO="$ROOT/repos/showdown"
OUT="$ROOT/data/scores.jsonl"

overlay_suite() { # $1=ver or "base"
  local ver="$1"
  git checkout -- . 2>/dev/null; git clean -fdq
  if [ "$ver" != base ] && [ -d "$ROOT/data/suites/$ver/showdown" ]; then
    ( cd "$ROOT/data/suites/$ver/showdown" && find . -type f ) | while read -r f; do
      rel="${f#./}"
      cp "$ROOT/data/suites/$ver/showdown/$rel" "$REPO/$rel"
    done
  fi
}

score_one() { # $1=ver
  local ver="$1"
  if grep -q "\"suite\":\"$ver\"" "$OUT" 2>/dev/null; then echo "skip $ver"; return; fi
  [ -z "$(git -C "$REPO" status --porcelain)" ] || { echo "frozen repo dirty, abort"; return 1; }
  local cfg="$ROOT/data/score-$ver.config.json"
  node -e '
    const fs=require("fs");
    const [cfgp, rep] = process.argv.slice(1);
    fs.writeFileSync(cfgp, JSON.stringify({
      testRunner: "vitest", reporters: ["json"],
      jsonReporter: { fileName: rep },
      mutate: ["src/helpers/misc.js","src/helpers/url.js","src/helpers/regexes.js","src/subParsers/makehtml/htmlBlock.js"],
      vitest: { related: false }, disableTypeChecks: false,
      concurrency: 2, timeoutMS: 5000, ignoreStatic: true,
    }, null, 2));
  ' "$cfg" "$ROOT/data/score-$ver.report.json"
  # amendment: conc 2 (not 4) for all 7 score runs — internally consistent A-vs-B contrast,
  # less self-inflicted contention under external load (ReDoS timing tests).
  # Runs in the frozen repo: overlay writer tests, run, restore (verified-clean before+after).
  local ok=0 t
  cd "$REPO"
  for t in 1 2 3 4 5 6; do
    overlay_suite "$ver"
    rm -rf .stryker-tmp
    if taskset -c 4-7 timeout 2700 npx stryker run "$cfg" > "$ROOT/logs/score-$ver.log" 2>&1; then ok=1; break; fi
    echo "score $ver try $t failed" >&2
    git checkout -- . 2>/dev/null; git clean -fdq; rm -rf .stryker-tmp
    sleep 60
  done
  git checkout -- . 2>/dev/null; git clean -fdq; rm -rf .stryker-tmp
  if [ $ok -ne 1 ]; then echo "score $ver: ALL TRIES FAILED (no row; resumable)" >&2; cd "$ROOT"; return 1; fi
  if [ -n "$(git status --porcelain)" ]; then echo "score $ver: TREE DIRTY AFTER RUN, abort" >&2; cd "$ROOT"; return 1; fi
  node -e '
    const fs=require("fs");
    const [ver, rep, out] = process.argv.slice(1);
    let counts={}, total=0;
    try { for (const f of Object.values(JSON.parse(fs.readFileSync(rep,"utf8")).files)) for (const mu of Object.values(f.mutants)) { counts[mu.status]=(counts[mu.status]||0)+1; total++; } } catch {}
    if (!total) { console.error("no mutants parsed for "+ver+"; report missing"); process.exit(1); }
    const killed=(counts.Killed||0)+(counts.Timeout||0);
    const score=total-(counts.Ignored||0)>0 ? (killed/(total-(counts.Ignored||0)-(counts.NoCoverage||0)||1)*100).toFixed(1) : "n/a";
    fs.appendFileSync(out, JSON.stringify({ suite: ver, exit_code: 0, total_mutants: total, counts_by_state: counts, score_pct_covered: score, ts: new Date().toISOString() })+"\n");
    console.log(`${ver}: mutants=${total} killed=${killed} survived=${counts.Survived||0}`);
  ' "$ver" "$ROOT/data/score-$ver.report.json" "$OUT" || { cd "$ROOT"; return 1; }
  cd "$ROOT"
}

for ver in ${SCORE_ONLY:-base a1 a2 a3 b1 b2 b3}; do score_one "$ver"; done
echo "SCORING COMPLETE"
