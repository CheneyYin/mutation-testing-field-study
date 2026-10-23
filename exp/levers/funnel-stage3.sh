#!/usr/bin/env bash
# Stage 3 funnel: install + green gate (2 consecutive green suite runs < 120s each).
# One candidate on disk at a time. Resumable: skips repos with a recorded verdict.
set -uo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
OUT="$ROOT/funnel/stage3.tsv"
LOG="$ROOT/logs/funnel-stage3.log"
SCRATCH="$ROOT/repos/scratch"
mkdir -p "$ROOT/funnel/stage3"
[ -f "$OUT" ] || echo -e "repo\trun1_s\texit1\trun2_s\texit2\tgate" > "$OUT"

clone_repo() {
  local repo="$1" attempt
  for attempt in 1 2 3 4; do
    rm -rf "$SCRATCH"
    if timeout 180 git clone --quiet --filter=blob:none "https://github.com/$repo" "$SCRATCH" >>"$LOG" 2>&1 \
       && timeout 120 git -C "$SCRATCH" restore --source=HEAD :/ >>"$LOG" 2>&1; then
      if [ -n "$(git -C "$SCRATCH" status --porcelain 2>/dev/null)" ]; then
        echo "attempt $attempt: dirty worktree for $repo" >> "$LOG"
        sleep $((attempt * 10))
        continue
      fi
      timeout 300 git -C "$SCRATCH" submodule update --init --recursive --depth 1 >>"$LOG" 2>&1 || true
      return 0
    fi
    echo "attempt $attempt failed for $repo" >> "$LOG"
    sleep $((attempt * 10))
  done
  return 1
}

install_deps() {
  # Runs with cwd = project dir. pnpm must be invoked from a neutral dir
  # (npm 11 devEngines blocks project-context npx for pnpm-managed repos).
  local attempt pm pver proj
  proj=$(pwd)
  for attempt in 1 2 3; do
    if [ -f pnpm-lock.yaml ]; then
      pm=$(node -e "try{const p=require('./package.json');console.log((p.packageManager||'').split('+')[0])}catch(e){console.log('')}")
      if [[ "$pm" == pnpm@* ]]; then pver="$pm"; else pver="pnpm@9"; fi
      if (cd /tmp/opencode && timeout 600 npx --yes "$pver" install --frozen-lockfile -C "$proj" >>"$LOG" 2>&1); then return 0; fi
    else
      if timeout 600 npm ci --no-audit --no-fund >>"$LOG" 2>&1; then return 0; fi
      if timeout 600 npm install --no-audit --no-fund >>"$LOG" 2>&1; then return 0; fi
      if timeout 600 npm install --no-audit --no-fund --legacy-peer-deps >>"$LOG" 2>&1; then return 0; fi
    fi
    echo "install attempt $attempt failed" >> "$LOG"
    sleep 5
  done
  return 1
}

run_suite() { # $1 = label. stdout captured by caller via files.
  local t0 t1
  t0=$(date +%s.%N)
  timeout 300 env CI=true npm test > "$ROOT/funnel/stage3/$1.log" 2>&1
  local rc=$?
  t1=$(date +%s.%N)
  printf '%s\t%s\n' "$(echo "$t1 $t0" | awk '{printf "%.1f", $1-$2}')" "$rc"
}

for repo in showdownjs/showdown sql-formatter-org/sql-formatter react-component/table eemeli/yaml; do
  name=$(printf '%s' "$repo" | tr '/' '_')
  if grep -q "^$repo	" "$OUT"; then echo "skip $repo (verdict recorded)"; continue; fi
  echo "=== stage3: $repo"
  if ! clone_repo "$repo"; then
    printf '%s\t?\t?\t?\t?\tFAIL_CLONE\n' "$repo" >> "$OUT"; echo "$repo clone failed"; continue
  fi
  if ! (cd "$SCRATCH" && install_deps); then
    printf '%s\t?\t?\t?\t?\tFAIL_INSTALL\n' "$repo" >> "$OUT"; rm -rf "$SCRATCH"; echo "$repo install failed"; continue
  fi
  ( cd "$SCRATCH"
    r1=$(run_suite "${name}_run1"); s1=$(printf '%s' "$r1" | cut -f1); e1=$(printf '%s' "$r1" | cut -f2)
    r2=$(run_suite "${name}_run2"); s2=$(printf '%s' "$r2" | cut -f1); e2=$(printf '%s' "$r2" | cut -f2)
    if [ "$e1" = "0" ] && [ "$e2" = "0" ] && awk -v a="$s1" -v b="$s2" 'BEGIN{exit !(a<120 && b<120)}'; then
      printf '%s\t%s\t%s\t%s\t%s\tPASS\n' "$repo" "$s1" "$e1" "$s2" "$e2" >> "$OUT"
      echo "$repo PASS ($s1 s / $s2 s)"
    else
      printf '%s\t%s\t%s\t%s\t%s\tFAIL\n' "$repo" "$s1" "$e1" "$s2" "$e2" >> "$OUT"
      echo "$repo FAIL (exit $e1/$e2, ${s1}s/${s2}s)"
    fi
  )
  rm -rf "$SCRATCH"
  df -h / | tail -1
done
echo "stage3 done"
