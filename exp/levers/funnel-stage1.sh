#!/usr/bin/env bash
# Stage 1 funnel: GitHub API screen. Gates preregistered in exp/protocol.md.
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
OUT="$ROOT/funnel/stage1.tsv"
echo -e "repo\tlanguage\tlicense\tarchived\tpushed_at\tdays_idle\tstars\tsize_kb\tgate" > "$OUT"
while IFS= read -r repo; do
  [ -z "$repo" ] && continue
  if ! json=$(curl -sf "https://api.github.com/repos/$repo" --max-time 30); then
    printf '%s\t?\t?\t?\t?\t?\t?\t?\tFAIL_FETCH\n' "$repo" >> "$OUT"
    continue
  fi
  printf '%s' "$json" | node -e '
    const j = JSON.parse(require("fs").readFileSync(0, "utf8"));
    const days = Math.round((Date.now() - new Date(j.pushed_at)) / 864e5);
    const lic = (j.license && j.license.spdx_id) || "NONE";
    const lang = j.language || "?";
    const okLang = ["JavaScript", "TypeScript"].includes(lang);
    const okLic = ["MIT", "Apache-2.0", "BSD-2-Clause", "BSD-3-Clause", "ISC", "0BSD"].includes(lic);
    const pass = okLang && okLic && !j.archived && days <= 365 && j.stargazers_count <= 20000;
    const cols = [j.full_name, lang, lic, String(j.archived), j.pushed_at, String(days),
      String(j.stargazers_count), String(j.size), pass ? "PASS" : "FAIL"].join("\t");
    console.log(cols);
  ' >> "$OUT"
  sleep 0.4
done < "$ROOT/levers/candidates.tsv"
echo "stage1 done: $(grep -c PASS "$OUT" || true) pass / $(($(wc -l < "$OUT") - 1)) total"
