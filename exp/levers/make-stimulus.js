// make-stimulus: build frozen per-arm stimulus files (stimulus.jsonl) for P3.
// Arm A: survived mutants (status=Survived ONLY) from full-repo Stryker JSON reports.
// Arm B: uncovered executable lines from coverage extraction.
// Selection rule (amendment 9): stratified round-robin across files in path order,
// within-file items in line order, until N items per arm. Deterministic.
// Usage: node make-stimulus.js
const fs = require("fs");
const path = require("path");
const D = path.join(__dirname, "..", "data");
const N = 30;
const FRAME = JSON.parse(fs.readFileSync(path.join(D, "frame.json"), "utf8"));
const frameFiles = (repo) => new Set(FRAME[repo]);

function strykerSurvived(reportPath, repo) {
  const rep = JSON.parse(fs.readFileSync(reportPath, "utf8"));
  const byFile = new Map();
  for (const [file, f] of Object.entries(rep.files)) {
    if (!frameFiles(repo).has(file)) continue; // amendment 10: frame-restricted, both arms
    for (const mu of Object.values(f.mutants)) {
      if (mu.status !== "Survived") continue;
      if (/grammar\.ts$/.test(file)) continue; // generated parser tables
      if (!byFile.has(file)) byFile.set(file, []);
      byFile.get(file).push(mu);
    }
  }
  for (const arr of byFile.values()) arr.sort((a, b) => a.location.start.line - b.location.start.line);
  return [...byFile.entries()].sort((a, b) => (a[0] < b[0] ? -1 : 1)).map(([file, arr]) => ({ repo, file, arr }));
}

function uncoveredByFile(jsonlPath, repo) {
  const rows = fs.readFileSync(jsonlPath, "utf8").trim().split("\n").map(JSON.parse)
    .filter((r) => frameFiles(repo).has(r.file)); // amendment 10: frame-restricted, both arms
  const byFile = new Map();
  for (const r of rows) {
    if (/grammar\.ts$/.test(r.file)) continue;
    if (!byFile.has(r.file)) byFile.set(r.file, []);
    byFile.get(r.file).push(r.line);
  }
  return [...byFile.entries()].sort((a, b) => (a[0] < b[0] ? -1 : 1)).map(([file, lines]) => ({ repo, file, arr: lines }));
}

function roundRobin(buckets, toItem) {
  const items = [];
  let pass = 0;
  let added = true;
  while (items.length < N && added) {
    added = false;
    for (const b of buckets) {
      if (items.length >= N) break;
      if (pass < b.arr.length) { items.push(toItem(b, b.arr[pass])); added = true; }
    }
    pass++;
  }
  return items;
}

const sdSurv = strykerSurvived(path.join(D, "sd-guide.report.json"), "showdown");
const sqfSurv = strykerSurvived(path.join(D, "sqf-full.report.json"), "sql-formatter");
const sdUnc = uncoveredByFile(path.join(D, "sd-uncovered.jsonl"), "showdown");
const sqfUnc = uncoveredByFile(path.join(D, "sqf-uncovered.jsonl"), "sql-formatter");

const stimulusA = roundRobin([...sdSurv, ...sqfSurv], (b, mu) => ({
  arm: "A", repo: b.repo, file: b.file, line: mu.location.start.line,
  kind: "survived-mutant", mutator: mu.mutatorName,
  original: mu.original ? String(mu.original).slice(0, 120) : null,
  replacement: mu.replacement ? String(mu.replacement).slice(0, 120) : null,
}));
const stimulusB = roundRobin([...sdUnc, ...sqfUnc], (b, line) => ({
  arm: "B", repo: b.repo, file: b.file, line, kind: "uncovered-line",
}));

fs.writeFileSync(path.join(D, "stimulus-A.jsonl"), stimulusA.map((r) => JSON.stringify(r)).join("\n") + "\n");
fs.writeFileSync(path.join(D, "stimulus-B.jsonl"), stimulusB.map((r) => JSON.stringify(r)).join("\n") + "\n");
const cnt = (repo, arr) => arr.filter((x) => x.repo === repo).length;
console.log(`A: ${stimulusA.length} items (showdown ${cnt("showdown", stimulusA)}, sqf ${cnt("sql-formatter", stimulusA)}); files=${new Set(stimulusA.map((x) => x.repo + x.file)).size}`);
console.log(`B: ${stimulusB.length} items (showdown ${cnt("showdown", stimulusB)}, sqf ${cnt("sql-formatter", stimulusB)}); files=${new Set(stimulusB.map((x) => x.repo + x.file)).size}`);
