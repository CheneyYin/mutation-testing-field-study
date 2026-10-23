#!/usr/bin/env bash
# Incremental change ladder (H2): for k in 1 10 100:
#   fresh incremental base run -> apply k-line comment patch -> incremental rerun -> revert + hash verify.
# Records both runs into runs.jsonl (cell ids ladder_k<k>_base / ladder_k<k>_rerun).
set -uo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
REPO="$ROOT/repos/showdown"
MAT="$ROOT/data/matrix"
RUNS="$ROOT/data/runs.jsonl"
cd "$REPO"

run_cell() { # $1=cellid $2=incrementalFile
  local id="$1" incf="$2" cfg="$MAT/$1.config.json" rep="$MAT/$1.report.json" log="$ROOT/logs/matrix-$1.log" tmf="$MAT/$1.time"
  cat > "$cfg" <<EOF
{
  "testRunner": "vitest",
  "reporters": ["clear-text", "json"],
  "jsonReporter": { "fileName": "$rep" },
  "mutate": ["src/subParsers/makehtml/heading.js"],
  "vitest": { "related": false },
  "disableTypeChecks": false,
  "concurrency": 2,
  "timeoutMS": 5000,
  "ignoreStatic": true,
  "incremental": true,
  "incrementalFile": "$incf"
}
EOF
  rm -rf .stryker-tmp
  local ok=0 t rc
  for t in 1 2 3 4; do
    if taskset -c 4-7 /usr/bin/time -v -o "$tmf" timeout 2700 npx stryker run "$cfg" > "$log" 2>&1; then ok=1; break; fi
    rc=$?
    echo "cell $id try $t failed (rc=$rc)" >&2
    rm -rf .stryker-tmp
    sleep 30
  done
  [ $ok -eq 1 ] || { echo "cell $id ALL TRIES FAILED (no row recorded; resumable)" >&2; return 1; }
  rc=0
  node -e '
    const fs=require("fs");
    const [id, logp, repp, tmfp, rcp, runsp, cfgp] = process.argv.slice(1);
    const log=fs.readFileSync(logp,"utf8");
    let dry=null,tests=null,reused=null,total2=null;
    let m=log.match(/Ran (\d+) tests in (\d+) minutes? and (\d+) seconds?/)||log.match(/Ran (\d+) tests in (\d+) seconds/); if(m){tests=+m[1];dry=m.length===4?+m[2]*60+ +m[3]:+m[2];}
    m=log.match(/Result:\s+(\d+) of (\d+) mutant result/); if(m){reused=+m[1];total2=+m[2];}
    let counts={},total=0,stat=0;
    try{ for(const f of Object.values(JSON.parse(fs.readFileSync(repp,"utf8")).files)) for(const mu of Object.values(f.mutants)){counts[mu.status]=(counts[mu.status]||0)+1;total++;if(mu.static)stat++;} }catch{}
    const t=fs.readFileSync(tmfp,"utf8");
    const g=(re)=>{const x=t.match(re);return x?parseFloat(x[1].replace(",",".")):null;};
    const row={cell:id,repo:"showdown",config_fingerprint:require("crypto").createHash("sha256").update(fs.readFileSync(cfgp)).digest("hex").slice(0,16),scope:"ladder",concurrency:2,ignoreStatic:true,hitLimit:"default",exit_code:+rcp,truncated:+rcp===124,wallclock_s:null,time_wall_s:null,cpu_user_s:g(/User time[^:]*: (\d+[\d.,]*)/),cpu_sys_s:g(/System time[^:]*: (\d+[\d.,]*)/),dryRunSeconds:dry,dryRunTests:tests,reusedCount:reused,reuseTotal:total2,total_mutants:total,counts_by_state:counts,staticCount:stat,cores:require("os").cpus().length,node_ver:process.version,ts:new Date().toISOString()};
    fs.appendFileSync(runsp, JSON.stringify(row)+"\n");
    console.log(`${id}: rc=${rcp} mutants=${total} reused=${reused}/${total2} dry=${dry}s`);
  ' "$id" "$log" "$rep" "$tmf" "$rc" "$RUNS" "$cfg"
  rm -rf .stryker-tmp
}

for k in 1 10 100; do
  if grep -q "\"cell\":\"ladder_k${k}_rerun\"" "$RUNS" 2>/dev/null; then echo "skip k=$k"; continue; fi
  INC="$MAT/incremental-k$k.json"
  rm -f "$INC"
  git checkout -- src/ && git clean -fdq
  [ -z "$(git status --porcelain)" ] || { echo "tree dirty, abort"; exit 1; }
  BASEHASH=$(sha256sum src/subParsers/makehtml/heading.js | cut -d" " -f1)
  run_cell "ladder_k${k}_base" "$INC" || { echo "k=$k base failed, skipping k"; continue; }
  node "$ROOT/levers/gen-ladder-patch.js" $k
  PATCHHASH=$(sha256sum src/subParsers/makehtml/heading.js | cut -d" " -f1)
  [ "$BASEHASH" != "$PATCHHASH" ] || { echo "patch k=$k changed nothing, abort"; git checkout -- src/; exit 1; }
  if run_cell "ladder_k${k}_rerun" "$INC"; then
    git checkout -- src/
    REVERTHASH=$(sha256sum src/subParsers/makehtml/heading.js | cut -d" " -f1)
    [ "$BASEHASH" = "$REVERTHASH" ] || { echo "revert hash mismatch for k=$k, abort"; exit 1; }
    echo "k=$k ladder complete (patch verified, reverted, hash-identical)"
  else
    git checkout -- src/
    echo "k=$k rerun failed; reverted; k resumable"
  fi
done
echo "LADDER COMPLETE (failed ks are resumable)"
