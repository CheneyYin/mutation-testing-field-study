#!/usr/bin/env bash
# Stage 2 funnel: clone each stage1-PASS repo (blob:none), measure, delete.
# Network to github.com is flaky: retry with backoff, resume from stage2.tsv.
set -uo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
IN="$ROOT/funnel/stage1.tsv"
OUT="$ROOT/funnel/stage2.tsv"
LOG="$ROOT/logs/funnel-stage2.log"
SCRATCH="$ROOT/repos/scratch"
[ -f "$OUT" ] || echo -e "repo\trunner\tsrc_loc\tsrc_dir\tfix_total\tfix_730d\tgate" > "$OUT"

clone_repo() {
  # $1 = repo slug. Returns 0 on success with complete checkout in $SCRATCH.
  local repo="$1" attempt
  for attempt in 1 2 3 4; do
    rm -rf "$SCRATCH"
    if timeout 180 git clone --quiet --filter=blob:none "https://github.com/$repo" "$SCRATCH" >>"$LOG" 2>&1; then
      if timeout 120 git -C "$SCRATCH" restore --source=HEAD :/ >>"$LOG" 2>&1; then
        return 0
      fi
    fi
    echo "attempt $attempt failed for $repo" >> "$LOG"
    sleep $((attempt * 10))
  done
  return 1
}

awk -F'\t' 'NR>1 && $9=="PASS"{print $1}' "$IN" | while IFS= read -r repo; do
  if grep -q "^$repo	" "$OUT"; then echo "skip $repo (already measured)"; continue; fi
  if clone_repo "$repo"; then
    (cd "$SCRATCH" && node "$ROOT/levers/stage2-measure.js" "$repo" >> "$OUT") || \
      printf '%s\t?\t?\t?\t?\t?\tFAIL_MEASURE\n' "$repo" >> "$OUT"
    echo "measured $repo"
  else
    printf '%s\t?\t?\t?\t?\t?\tFAIL_CLONE\n' "$repo" >> "$OUT"
    echo "clone failed for $repo"
  fi
  rm -rf "$SCRATCH"
done
echo "stage2 done: $(grep -c PASS "$OUT" || true) pass / $(($(wc -l < "$OUT") - 1)) measured"
