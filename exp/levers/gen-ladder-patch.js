// gen-ladder-patch: deterministic comment-only edits to heading.js for the incremental ladder.
// Usage: node gen-ladder-patch.js <k>  (k = 1 | 10 | 100 modified lines)
// k=1: rewrite one existing comment line. k=10/100: that + (k-1) inserted comment lines
// spread deterministically through the file. Behavior-preserving by construction.
const fs = require("fs");
const file = process.argv[3] || "/home/yanchengyu/expr/stryker-mutator/exp/repos/showdown/src/subParsers/makehtml/heading.js";
const k = Number(process.argv[2]);
const src = fs.readFileSync(file, "utf8");
const lines = src.split("\n");

let edits = 0;
// 1) rewrite the first comment line containing "parseHeader"
for (let i = 0; i < lines.length && edits < 1; i++) {
  if (lines[i].trim().startsWith("*") && /parseHeader|heading/i.test(lines[i])) {
    lines[i] = lines[i].replace(/(\S).*$/, "$1 ladder-edit anchor comment (deterministic)");
    edits++;
  }
}
// 2) insert k-1 comment lines spread over the file
if (k > 1) {
  const body = lines.length - 2;
  const step = Math.max(1, Math.floor(body / (k - 1)));
  const inserts = [];
  for (let j = 0; j < k - 1; j++) inserts.push(2 + j * step);
  const out = [];
  for (let i = 0; i < lines.length; i++) {
    if (inserts.includes(i)) out.push("  // ladder synthetic change " + (inserts.indexOf(i) + 1) + " of " + (k - 1));
    out.push(lines[i]);
  }
  lines.length = 0;
  lines.push(...out);
  edits += k - 1;
}
fs.writeFileSync(file, lines.join("\n"));
console.log(`applied ${edits} comment-line modifications (k=${k})`);
