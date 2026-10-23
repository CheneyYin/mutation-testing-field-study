// extract-uncovered: parse a coverage-final.json (istanbul/v8 json format) into uncovered.jsonl.
// Usage: node extract-uncovered.js <coverage-final.json> <repo-root-src-prefix> <out.jsonl>
// Emits one row per uncovered executable line: {file, line} for files under the src prefix.
const fs = require("fs");
const [covPath, prefix, outPath] = process.argv.slice(2);
const cov = JSON.parse(fs.readFileSync(covPath, "utf8"));
const rows = [];
for (const [absFile, data] of Object.entries(cov)) {
  const norm = absFile.replace(/\\/g, "/");
  const idx = norm.indexOf(prefix);
  if (idx === -1) continue;
  const rel = norm.slice(idx).replace(/^\/+/, "");
  if (/(^|\/)(node_modules|\.stryker-tmp|test|dist|coverage)\//.test(norm)) continue;
  const sm = data.statementMap || {};
  for (const [sid, count] of Object.entries(data.s || {})) {
    if (count === 0) {
      const loc = sm[sid];
      if (!loc) continue;
      for (let l = loc.start.line; l <= loc.end.line; l++) rows.push({ file: rel, line: l });
    }
  }
}
rows.sort((a, b) => (a.file === b.file ? a.line - b.line : a.file < b.file ? -1 : 1));
const dedup = rows.filter((r, i) => i === 0 || !(r.file === rows[i - 1].file && r.line === rows[i - 1].line));
fs.writeFileSync(outPath, dedup.map((r) => JSON.stringify(r)).join("\n") + "\n");
console.log(`uncovered lines: ${dedup.length} across ${new Set(dedup.map((r) => r.file)).size} files`);
