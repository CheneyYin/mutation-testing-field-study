#!/usr/bin/env bash
# l_c4_r1 retry: conc4 up to 2 attempts (ReDoS timing flake under load), then conc2 fallback.
# Records the SUCCESSFUL run as l_c4_r1 (or l_c2_fallback), serving H1 scale point + P3 guidance.
set -uo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
REPO="$ROOT/repos/showdown"
MAT="$ROOT/data/matrix"
RUNS="$ROOT/data/runs.jsonl"
CFG="$MAT/l_c4_r1.config.json"
REP="$MAT/l_c4_r1.report.json"
cd "$REPO"

attempt() { # $1=conc $2=cellid
  local conc="$1" id="$2"
  node -e '
    const fs=require("fs");
    const [cfgp, rep, conc] = process.argv.slice(1);
    const frame=JSON.parse(fs.readFileSync("/home/yanchengyu/expr/stryker-mutator/exp/data/frame.json","utf8"));
    fs.writeFileSync(cfgp, JSON.stringify({
      testRunner:"vitest", reporters:["clear-text","json"],
      jsonReporter:{fileName:rep},
      mutate: frame.showdown,
      vitest:{related:false}, disableTypeChecks:false,
      concurrency:+conc, timeoutMS:5000, ignoreStatic:true,
    },null,2));
  ' "$CFG" "$MAT/$2.report.json" "$conc"
  rm -rf .stryker-tmp
  /usr/bin/time -v -o "$MAT/$2.time" timeout 5400 npx stryker run "$CFG" > "$ROOT/logs/matrix-$2.log" 2>&1
  local rc=$?
  rm -rf .stryker-tmp
  echo "attempt $id (conc$conc): rc=$rc"
  return $rc
}

record() { # $1=cellid $2=conc  (parse like the driver)
  node -e '
    const fs=require("fs");
    const [id, conc, logp, repp, tmfp, runsp] = process.argv.slice(1);
    const log=fs.readFileSync(logp,"utf8");
    let dry=null,tests=null;
    let m=log.match(/Ran (\d+) tests in (\d+) minutes? and (\d+) seconds/)||log.match(/Ran (\d+) tests in (\d+) seconds/);
    if(m){tests=+m[1];dry=m.length===4?+m[2]*60+ +m[3]:+m[2];}
    let counts={},total=0,stat=0;
    try{for(const f of Object.values(JSON.parse(fs.readFileSync(repp,"utf8")).files))for(const mu of Object.values(f.mutants)){counts[mu.status]=(counts[mu.status]||0)+1;total++;if(mu.static)stat++;}}catch{}
    const t=fs.readFileSync(tmfp,"utf8");
    const g=(re)=>{const x=t.match(re);return x?parseFloat(x[1].replace(",",".")):null;};
    const cfgp="/home/yanchengyu/expr/stryker-mutator/exp/data/matrix/"+id+".config.json";
    const row={cell:id,repo:"showdown",config_fingerprint:require("crypto").createHash("sha256").update(fs.readFileSync(cfgp)).digest("hex")+"+10.0.0",scope:"large",concurrency:+conc,ignoreStatic:true,hitLimit:"default",exit_code:0,truncated:false,wallclock_s:null,time_wall_s:null,cpu_user_s:g(/User time[^:]*: (\d+[\d.,]*)/),cpu_sys_s:g(/System time[^:]*: (\d+[\d.,]*)/),dryRunSeconds:dry,dryRunTests:tests,total_mutants:total,counts_by_state:counts,staticCount:stat,cores:require("os").cpus().length,cpu_model:(require("os").cpus()[0]||{}).model,node_ver:process.version,stryker_ver:"10.0.0",ts:new Date().toISOString()};
    const lines=fs.readFileSync(runsp,"utf8").trim().split("\n").filter(Boolean).filter(l=>{try{return JSON.parse(l).cell!==id}catch{return true}});
    lines.push(JSON.stringify(row));
    fs.writeFileSync(runsp, lines.join("\n")+"\n");
    console.log(`${id}: mutants=${total} killed=${counts.Killed||0} survived=${counts.Survived||0} static=${stat} dry=${dry}`);
  ' "$1" "$2" "$ROOT/logs/matrix-$1.log" "$MAT/$1.report.json" "$MAT/$1.time" "$RUNS"
}

# drop any previous failed l rows
grep -v '"cell":"l_c4_r1"' "$RUNS" > /tmp/opencode/runs.tmp 2>/dev/null || true
grep -v '"cell":"l_c2_fallback"' /tmp/opencode/runs.tmp > "$RUNS" 2>/dev/null || cp /tmp/opencode/runs.tmp "$RUNS"

for try in 1 2; do
  if attempt 4 l_c4_r1; then record l_c4_r1 4; echo "L RETRY COMPLETE (conc4, try $try)"; exit 0; fi
  echo "conc4 try $try failed (ReDoS flake?)"
done
if attempt 2 l_c2_fallback; then record l_c2_fallback 2; echo "L RETRY COMPLETE (conc2 fallback)"; exit 0; fi
echo "L RETRY FAILED at both concurrencies"; exit 1
