#!/usr/bin/env bash
# build-sandboxes: git-archive exports (no .git) + node_modules symlinks + frozen targets.json
# for the 6 writers. Usage: bash build-sandboxes.sh
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
SB="$ROOT/sandbox"
mkdir -p "$SB"

build_one() { # $1=writer id, $2=stimulus file (A or B)
  local w="$1" arm="$2"
  for repo in showdown sql-formatter; do
    local dst="$SB/$w/$repo"
    rm -rf "$dst"; mkdir -p "$dst"
    git -C "$ROOT/repos/$repo" archive HEAD | tar -x -C "$dst"
    rm -rf "$dst/.git" "$dst/.gitignore" 2>/dev/null || true
    ln -s "$ROOT/repos/$repo/node_modules" "$dst/node_modules"
    # grammar.ts is gitignored+generated: copy the frozen validated artifact so the suite runs
    if [ "$repo" = sql-formatter ]; then
      cp "$ROOT/repos/sql-formatter/src/parser/grammar.ts" "$dst/src/parser/grammar.ts"
    fi
  done
  cp "$ROOT/data/stimulus-$arm.jsonl" "$SB/$w/targets.jsonl"
  echo "$w: $(wc -l < "$SB/$w/targets.jsonl") targets"
}

for i in 1 2 3; do build_one "a$i" A; done
for i in 1 2 3; do build_one "b$i" B; done
echo "SANDBOXES READY"
