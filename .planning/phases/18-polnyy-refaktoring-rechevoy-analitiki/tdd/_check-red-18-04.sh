#!/usr/bin/env bash
# gsd-guard + commit for 18-04
set -euo pipefail
PINNED_ROOT='C:/Users/Professional/WebstormProjects/krasterisk_v4'
cd "$PINNED_ROOT"
ACTUAL_ROOT=$(git rev-parse --show-toplevel)
PINNED_TL=$(git -C "$PINNED_ROOT" rev-parse --show-toplevel)
if [ "$ACTUAL_ROOT" != "$PINNED_TL" ]; then
  echo "FATAL pin mismatch"; exit 1
fi
echo "PIN_OK"

GSD="$USERPROFILE/.cursor/gsd-core/bin/gsd-tools.cjs"
node "$GSD" check tdd-red-evidence \
  ".planning/phases/18-polnyy-refaktoring-rechevoy-analitiki/tdd/run-analysis-red-evidence.json"
