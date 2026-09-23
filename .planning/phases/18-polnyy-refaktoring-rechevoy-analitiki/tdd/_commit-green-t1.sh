#!/usr/bin/env bash
set -euo pipefail
PINNED_ROOT='C:/Users/Professional/WebstormProjects/krasterisk_v4'
cd "$PINNED_ROOT"
ACTUAL_ROOT=$(git rev-parse --show-toplevel)
PINNED_TL=$(git -C "$PINNED_ROOT" rev-parse --show-toplevel)
[ "$ACTUAL_ROOT" = "$PINNED_TL" ] || { echo FATAL; exit 1; }

GSD="$USERPROFILE/.cursor/gsd-core/bin/gsd-tools.cjs"
node "$GSD" query commit "feat(18-04): implement runAnalysis with SA-CHARGE-RUN

- Resolve STT/score models per D-38 allowlist with one silence fallback
- Persist success then invokeSaChargeRun once including amount 0
- Wire worker to prefer runAnalysis; keep wait + legacy handoff
- Document runPipeline/fakeStt as eval-only, unused by worker
" --files \
  packages/backend/src/modules/speech-analytics/pipeline/run-analysis.ts \
  packages/backend/src/modules/speech-analytics/pipeline/stt.ts \
  packages/backend/src/modules/speech-analytics/pipeline/score.ts \
  packages/backend/src/modules/speech-analytics/pipeline.ts \
  packages/backend/src/modules/speech-analytics/jobs/sa-analysis.worker.ts

git log -1 --oneline
