#!/usr/bin/env bash
# apply-defect lever: reverse-apply the src-side of a fix commit onto the working tree.
# Usage: apply-defect.sh <fix_sha> [check]
#   check = dry-run conflict check only (git apply --check), no tree mutation.
# Leaves the tree dirty on real application; caller must reset via detect/verify.
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
REPO="${REPO_DIR:-$ROOT/repos/showdown}"
SHA="$1"
MODE="${2:-apply}"
cd "$REPO"
git diff "${SHA}^" "$SHA" -- src/ > /tmp/opencode/defect-$SHA.patch
if [ ! -s /tmp/opencode/defect-$SHA.patch ]; then
  echo "EMPTY_PATCH" >&2
  exit 2
fi
if [ "$MODE" = "check" ]; then
  git apply --reverse --check /tmp/opencode/defect-$SHA.patch
else
  git apply --reverse /tmp/opencode/defect-$SHA.patch
fi
