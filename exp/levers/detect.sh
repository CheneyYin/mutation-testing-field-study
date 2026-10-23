#!/usr/bin/env bash
# detect lever: differential detection of one defect (reverse-applied by caller).
# Usage (inside repo): detect.sh <defect_sha> <suite_version> <round> <out.jsonl-abs>
# Runs vitest with JSON reporter; appends one detection row.
# Caller controls tree state. This script does NOT apply or reset the defect.
set -uo pipefail
SHA="$1"; VER="$2"; ROUND="$3"; OUT="$4"
RUNNER="${DETECT_RUNNER:-vitest}"
JSON_OUT="/tmp/opencode/vitest-$SHA-$ROUND.json"
rm -f "$JSON_OUT"
t0=$(date +%s.%N)
timeout_flag=0
if [ "$RUNNER" = "jest" ]; then
  timeout 300 env CI=true node_modules/.bin/jest --json --outputFile="$JSON_OUT" --silent > /dev/null 2>&1
else
  timeout 300 env CI=true npx vitest run --reporter=json --outputFile="$JSON_OUT" --silent > /dev/null 2>&1
fi
rc=$?
[ $rc -eq 124 ] && timeout_flag=1
t1=$(date +%s.%N)
wall=$(echo "$t1 $t0" | awk '{printf "%.1f", $1-$2}')
node -e '
const fs = require("fs");
const [, sha, ver, round, out, jsonOut, rc, wall, to] = process.argv;
let failing = [];
let exit = Number(rc);
let parse_ok = true;
try {
  const j = JSON.parse(fs.readFileSync(jsonOut, "utf8"));
  for (const tr of j.testResults || []) {
    for (const a of tr.assertionResults || []) {
      if (a.status === "failed") failing.push(a.fullName);
    }
  }
  if (j.numRuntimeErrorTestSuites > 0 || (j.success === false && failing.length === 0 && (j.numFailedTests||0) === 0)) {
    // suite-level runtime error without named failing tests
    failing.push("__RUNTIME_ERROR__");
  }
} catch { parse_ok = false; }
console.log(JSON.stringify({
  defect: sha, suite_version: ver, round: Number(round),
  exit_code: exit, wallclock_s: Number(wall), timeout: Number(to) === 1,
  failing_tests: failing, parse_ok, ts: new Date().toISOString(),
}));
' "$SHA" "$VER" "$ROUND" "$OUT" "$JSON_OUT" "$rc" "$wall" "$timeout_flag" >> "$OUT"
