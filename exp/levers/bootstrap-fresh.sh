#!/usr/bin/env bash
# bootstrap-fresh.sh: rebuild the runtime environment on a new machine.
# Clones both upstream repos at their frozen SHAs, installs dependencies,
# wires StrykerJS 10 into each (the in-repo recipes the experiment validated:
# pnpm must run from a neutral dir because npm 11 devEngines blocks in-project
# npx; sql-formatter needs the stryker jest-runner merged into its pnpm tree
# and jest-environment-node hoisted to a top-level symlink).
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/../.." && pwd)"   # repo root (contains exp/)
REPOS="$ROOT/exp/repos"
SHOWDOWN_SHA=d1a8d16344b855ea2f37677ee8a9e0cc2c597ea4
SQF_SHA=223a6ce243fa4f502f1152061f128ef3e652b52d

clone_retry() { # $1=url $2=dest
  local i
  for i in 1 2 3 4 5; do
    rm -rf "$2"
    if timeout 300 git clone --quiet "$1" "$2"; then
      [ -z "$(git -C "$2" status --porcelain 2>/dev/null | head -1)" ] && return 0
    fi
    echo "clone attempt $i failed: $1" >&2
    sleep $((i * 15))
  done
  return 1
}

# ---- showdown (vitest runner) ----
if [ ! -d "$REPOS/showdown/.git" ]; then
  clone_retry https://github.com/showdownjs/showdown "$REPOS/showdown"
fi
git -C "$REPOS/showdown" checkout --quiet "$SHOWDOWN_SHA"
if [ ! -x "$REPOS/showdown/node_modules/.bin/stryker" ]; then
  ( cd "$REPOS/showdown" \
    && npm ci --no-audit --no-fund \
    && npm install --no-save --no-audit --no-fund \
       @stryker-mutator/core @stryker-mutator/vitest-runner @vitest/coverage-v8@4.1.11 )
fi
echo "showdown: green gate (expect 3174 tests passing)"
( cd "$REPOS/showdown" && env CI=true npx vitest run --silent >/dev/null && echo "  ok" )

# ---- sql-formatter (jest runner, pnpm-managed) ----
if [ ! -d "$REPOS/sql-formatter/.git" ]; then
  clone_retry https://github.com/sql-formatter-org/sql-formatter "$REPOS/sql-formatter"
fi
git -C "$REPOS/sql-formatter" checkout --quiet "$SQF_SHA"
if [ ! -e "$REPOS/sql-formatter/node_modules/.pnpm" ]; then
  ( cd /tmp && npx --yes pnpm@11.9.0 install --frozen-lockfile -C "$REPOS/sql-formatter" )
fi
# grammar.ts is gitignored and generated: rebuild from the frozen grammar.ne
( cd "$REPOS/sql-formatter" && node_modules/.bin/nearleyc src/parser/grammar.ne -o src/parser/grammar.ts )
if [ ! -x "$REPOS/sql-formatter/node_modules/.bin/stryker" ]; then
  NEUTRAL="$(mktemp -d)"
  ( cd "$NEUTRAL" && npm install --no-audit --no-fund --prefer-offline \
     @stryker-mutator/core@10 @stryker-mutator/jest-runner@10 )
  cp -r "$NEUTRAL/node_modules/." "$REPOS/sql-formatter/node_modules/"
  ( cd "$REPOS/sql-formatter/node_modules/.bin" \
    && ln -sfn ../@stryker-mutator/core/bin/stryker stryker )
  rm -rf "$NEUTRAL"
fi
if [ ! -e "$REPOS/sql-formatter/node_modules/jest-environment-node" ]; then
  JE="$(ls -d "$REPOS"/sql-formatter/node_modules/.pnpm/jest-environment-node@*/node_modules/jest-environment-node | head -1)"
  ln -sfn "$JE" "$REPOS/sql-formatter/node_modules/jest-environment-node"
fi
echo "sql-formatter: green gate (expect 5885 tests passing)"
( cd "$REPOS/sql-formatter" && env CI=true node_modules/.bin/jest --silent >/dev/null && echo "  ok" )

echo "BOOTSTRAP COMPLETE"
echo "next: node exp/levers/check-manifest.js   # evidence hash chain"
echo "      node exp/levers/analyze.js          # recompute all tables"
echo "writer-refs (gitignored) rebuild automatically inside verify-writer.sh runs."
