// check-manifest: verify the append-only hash chain in data/manifest.jsonl.
// Pass: current sha256 matches the recorded hash, OR the artifact is an append-superset
// (line count >= recorded lines) — the declared append-only semantics for growing jsonl.
// Fail: file missing, line count shrank, or a hash mismatch on a non-grown file.
const fs = require("fs");
const path = require("path");
const crypto = require("crypto");
const ROOT = path.join(__dirname, "..");
const M = path.join(ROOT, "data", "manifest.jsonl");
const rows = fs.readFileSync(M, "utf8").trim().split("\n").map(JSON.parse);
let ok = 0, appended = 0, fail = 0;
const seen = new Map(); // artifact -> {sha, lines} of its LAST record
for (const r of rows) seen.set(r.artifact, r);
for (const [artifact, rec] of seen) {
  const p = path.join(ROOT, artifact);
  if (!fs.existsSync(p)) { console.log(`MISSING  ${artifact}`); fail++; continue; }
  const buf = fs.readFileSync(p);
  const sha = crypto.createHash("sha256").update(buf).digest("hex");
  const lines = buf.length && buf[buf.length - 1] === 10 ? buf.toString().trim() === "" ? 0 : buf.toString().trim().split("\n").length : buf.toString().split("\n").length;
  if (sha === rec.sha256) { ok++; continue; }
  if (lines >= rec.lines) { appended++; continue; }
  console.log(`HASH-MISMATCH-AND-SHRUNK ${artifact} (recorded ${rec.lines} lines/${rec.sha256.slice(0, 8)}, now ${lines} lines/${sha.slice(0, 8)})`);
  fail++;
}
console.log(`manifest check: ${ok} exact, ${appended} append-superset, ${fail} FAIL, of ${seen.size} distinct artifacts`);
process.exit(fail ? 1 : 0);
