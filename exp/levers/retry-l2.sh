#!/usr/bin/env bash
# retry-l2: persistent retry loop for the guidance/large cell.
# Dry-run ReDoS flakes under external load cost ~25s per failed attempt; keep trying.
# conc4 up to 8 attempts, then conc2 up to 8. Cap 5400s per attempt.
set -uo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
REPO="$ROOT/repos/showdown"
MAT="$ROOT/data/matrix"
RUNS="$ROOT/data/runs.jsonl"
cd "$REPO"

run_attempt() { # $1=conc $2=cellid
  local conc="$1" id="$2" cap
  cap=$([ "$conc" = 4 ] && echo 7200 || echo 10800)
  local cfg="$MAT/$id.config.json"
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
  ' "$cfg" "$MAT/$id.report.json" "$conc"
  rm -rf .stryker-tmp
  /usr/bin/time -v -o "$MAT/$id.time" timeout $cap npx stryker run "$cfg" > "$ROOT/logs/matrix-$id.log" 2>&1
  local rc=$?
  rm -rf .stryker-tmp
  return $rc
}

record() { # $1=cellid $2=conc $3=ext_load_note
  node -e '
    const fs=require("fs");
    const [id, conc, note, logp, repp, tmfp, runsp] = process.argv.slice(1);
    const log=fs.readFileSync(logp,"utf8");
    let dry=null,tests=null;
    let m=log.match(/Ran (\d+) tests in (\d+) minutes? and (\d+) seconds/)||log.match(/Ran (\d+) tests in (\d+) seconds/);
    if(m){tests=+m[1];dry=m.length===4?+m[2]*60+ +m[3]:+m[2];}
    let counts={},total=0,stat=0;
    try{for(const f of Object.values(JSON.parse(fs.readFileSync(repp,"utf8")).files))for(const mu of Object.values(f.mutants)){counts[mu.status]=(counts[mu.status]||0)+1;total++;if(mu.static)stat++;}}catch{}
    const t=fs.readFileSync(tmfp,"utf8");
    const g=(re)=>{const x=t.match(re);return x?parseFloat(x[1].replace(",",".")):null;};
    const cfgp="/home/yanchengyu/expr/stryker-mutator/exp/data/matrix/"+id+".config.json";
    const row={cell:id,repo:"showdown",config_fingerprint:require("crypto").createHash("sha256").update(fs.readFileSync(cfgp)).digest("hex")+"+10.0.0",scope:"large",concurrency:+conc,ignoreStatic:true,hitLimit:"default",exit_code:0,truncated:false,wallclock_s:null,time_wall_s:null,cpu_user_s:g(/User time[^:]*: (\d+[\d.,]*)/),cpu_sys_s:g(/System time[^:]*: (\d+[\d.,]*)/),dryRunSeconds:dry,dryRunTests:tests,total_mutants:total,counts_by_state:counts,staticCount:stat,ext_load_note:note,cores:require("os").cpus().length,cpu_model:(require("os").cpus()[0]||{}).model,node_ver:process.version,stryker_ver:"10.0.0",ts:new Date().toISOString()};
    const lines=fs.readFileSync(runsp,"utf8").trim().split("\n").filter(Boolean).filter(l=>{try{return JSON.parse(l).cell!==id}catch{return true}});
    lines.push(JSON.stringify(row));
    fs.writeFileSync(runsp, lines.join("\n")+"\n");
    console.log(`${id}: mutants=${total} killed=${counts.Killed||0} survived=${counts.Survived||0} static=${stat} dry=${dry}`);
  ' "$1" "$2" "$3" "$ROOT/logs/matrix-$1.log" "$MAT/$1.report.json" "$MAT/$1.time" "$RUNS"
}

for conc in 4 2; do
  id="l_c${conc}_guide"
  for try in $(seq 1 16); do
    echo "[$(date +%H:%M:%S)] attempt $id conc$conc try $try"
    if run_attempt "$conc" "$id"; then
      record "$id" "$conc" "external-load-window; wall inflated, guidance-quality run"
      echo "GUIDANCE CELL COMPLETE: $id"
      exit 0
    fi
    sleep 90
  done
done
echo "GUIDANCE CELL FAILED after all retries"; exit 1
