#!/usr/bin/env bash
set -euo pipefail
PINNED_ROOT='C:/Users/Professional/WebstormProjects/krasterisk_v4'
cd "$PINNED_ROOT"
ACTUAL_ROOT=$(git rev-parse --show-toplevel)
PINNED_TL=$(git -C "$PINNED_ROOT" rev-parse --show-toplevel)
[ "$ACTUAL_ROOT" = "$PINNED_TL" ] || { echo FATAL; exit 1; }

HEAD_REF=$(git symbolic-ref --quiet HEAD || echo DETACHED)
ACTUAL_BRANCH=$(git rev-parse --abbrev-ref HEAD)
echo "BRANCH=$ACTUAL_BRANCH HEAD_REF=$HEAD_REF"

GSD="$USERPROFILE/.cursor/gsd-core/bin/gsd-tools.cjs"
node "$GSD" query commit "test(18-04): add failing runAnalysis SA-CHARGE-RUN specs

- Assert success path charges once including amount 0
- Assert score failure skips charge and marks error
- Assert D-38 model resolution and silence fallback
- RED stubs intentionally omit charge and use fakeStt semantics
" --files \
  packages/backend/src/modules/speech-analytics/pipeline/run-analysis.spec.ts \
  packages/backend/src/modules/speech-analytics/pipeline/run-analysis.ts \
  packages/backend/src/modules/speech-analytics/pipeline/stt.ts \
  packages/backend/src/modules/speech-analytics/pipeline/score.ts \
  .planning/phases/18-polnyy-refaktoring-rechevoy-analitiki/tdd/run-analysis-red-evidence.json

git rev-parse --short HEAD
git log -1 --oneline
