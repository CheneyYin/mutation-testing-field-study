#!/usr/bin/env bash
# verify-writer: post-writer mechanical gates + suite-version export.
# Gates:
#   1. insert-only: diff(original, writer) = pure inserted hunks only (no changed/deleted lines).
#      Insertion inside an enclosing describe (before its closing brace) counts as insert-only.
#   2. new/inserted files only inside test dirs (showdown test/, sql-formatter test/).
#   3. suite green 2 consecutive runs in the sandbox (full frozen suite + writer tests).
# Export: data/suites/<writer>/{showdown,sql-formatter} = new + inserted test files.
set -uo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
W="$1"
SB="$ROOT/sandbox/$W"
REF="$ROOT/data/writer-refs/$W"
OUT="$ROOT/data/suites/$W"
rm -rf "$REF" "$OUT"; mkdir -p "$REF" "$OUT"

for repo in showdown sql-formatter; do
  mkdir -p "$REF/$repo"
  ( cd "$ROOT/repos/$repo" && git ls-files -z | tar --null -T - -cf - ) | tar -xf - -C "$REF/$repo"
done

node -e '
const fs=require("fs"),path=require("path"),{execSync}=require("child_process");
const [w,root]=process.argv.slice(1);
const sb=root+"/sandbox/"+w, ref=root+"/data/writer-refs/"+w, out=root+"/data/suites/"+w;
const TESTDIRS={showdown:"test", "sql-formatter":"test"};
// sandbox-side paths allowed to differ from the tracked-file reference:
// generated artifacts (jest coverage, plugin build, regenerated parser) and
// experimenter actions (build script removed .gitignore from sandboxes).
const ALLOWED_UNTRACKED=(f)=>f==="src/parser/grammar.ts"||f.startsWith("coverage/")||f.startsWith(".build/");
const ALLOWED_MISSING=(f)=>[".gitignore",".editorconfig",".gitattributes","eslint.config.mjs","performance.json","performance.log.md"].includes(f);
const notes=[];
const fails=[], exports=[];
for (const repo of Object.keys(TESTDIRS)) {
  const list=(d)=>{const a=[];const walk=(p)=>{for(const e of fs.readdirSync(p,{withFileTypes:true})){const q=p+"/"+e.name;if(e.isDirectory())walk(q);else if(e.isFile())a.push(path.relative(d,q))}};walk(d);return a;};
  const sbFiles=list(sb+"/"+repo), refFiles=list(ref+"/"+repo);
  const refSet=new Set(refFiles);
  for (const f of refFiles) {
    if (!sbFiles.includes(f)) {
      if (ALLOWED_MISSING(f)) { notes.push(`${repo}: missing (experimenter action) ${f}`); continue; }
      fails.push(`${repo}: DELETED ${f}`);
    }
  }
  for (const f of sbFiles) {
    const sbF=sb+"/"+repo+"/"+f, refF=ref+"/"+repo+"/"+f;
    if (!refSet.has(f)) {
      if (ALLOWED_UNTRACKED(f)) continue;
      if (f.startsWith(TESTDIRS[repo]+"/")) exports.push({repo,file:f,kind:"new"});
      else fails.push(`${repo}: NEW FILE OUTSIDE TESTDIR ${f}`);
      continue;
    }
    {
      let d;
      try { d=execSync(`diff "${refF}" "${sbF}"`,{encoding:"utf8",stdio:["pipe","pipe","pipe"]}).trim(); } catch(e) { d=String(e.stdout||"").trim(); }
      if (!d) continue;
      const hasLess = d.split("\n").some((l)=>l.startsWith("<"));
      const hasChangeDel = d.split("\n").some((l)=>/^[0-9]+(,[0-9]+)?[cd]/.test(l));
      if (hasChangeDel || hasLess) { fails.push(`${repo}: MODIFIED (not insert-only) ${f}`); continue; }
      if (f.startsWith(TESTDIRS[repo]+"/")) exports.push({repo,file:f,kind:"inserted"});
      else fails.push(`${repo}: INSERTED OUTSIDE TESTDIR ${f}`);
    }
  }
}
fs.mkdirSync(out,{recursive:true});
for (const e of exports) {
  const dst=out+"/"+e.repo+"/"+e.file;
  fs.mkdirSync(path.dirname(dst),{recursive:true});
  fs.copyFileSync(sb+"/"+e.repo+"/"+e.file, dst);
}
fs.appendFileSync(root+"/data/writers/verified.jsonl", exports.map(e=>JSON.stringify({writer:w,...e})).join("\n")+(exports.length?"\n":""));
console.log("insert-only check:", fails.length? "FAIL":"OK"); notes.forEach(n=>console.log("  note: "+n));
fails.forEach(f=>console.log("  "+f));
console.log("exported test files:", exports.length, "(new "+exports.filter(e=>e.kind==="new").length+", inserted "+exports.filter(e=>e.kind==="inserted").length+")");
if (fails.length) process.exit(1);
' "$W" "$ROOT" || exit 1

green=1
( cd "$SB/showdown" && for i in 1 2; do env CI=true npx vitest run --silent >/dev/null 2>&1 || exit 1; done ) || green=0
if [ $green = 1 ]; then
  ( cd "$SB/sql-formatter" && for i in 1 2; do env CI=true node_modules/.bin/jest --silent >/dev/null 2>&1 || exit 1; done ) || green=0
fi
if [ $green = 1 ]; then echo "GATE_OK(suite): green 2x both repos"; else echo "GATE_FAIL(suite): not green"; exit 1; fi
echo "WRITER $W VERIFIED"
