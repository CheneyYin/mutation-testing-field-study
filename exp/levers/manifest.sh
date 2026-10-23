#!/usr/bin/env bash
# Append hash-chain manifest entries. Usage: manifest.sh <phase> <artifact-rel-or-abs>...
# Artifacts recorded with sha256, line count (jsonl/tsv) and schema version.
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
M="$ROOT/data/manifest.jsonl"
PHASE="$1"; shift
for f in "$@"; do
  if [[ "$f" = /* ]]; then p="$f"; else p="$ROOT/$f"; fi
  [ -f "$p" ] || { echo "missing artifact $p" >&2; exit 1; }
  sha=$(sha256sum "$p" | cut -d' ' -f1)
  lines=$(wc -l < "$p")
  node -e '
    const [phase, p, sha, lines] = process.argv.slice(1);
    const rel = p.startsWith("/") ? p.split("/exp/")[1] || p : p;
    console.log(JSON.stringify({ phase, artifact: rel, sha256: sha, lines: Number(lines), schema_ver: "2", ts: new Date().toISOString() }));
  ' "$PHASE" "$p" "$sha" "$lines" >> "$M"
done
echo "manifest now $(wc -l < "$M") entries"
