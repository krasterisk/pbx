#!/usr/bin/env bash
set -euo pipefail
cd /c/Users/Professional/WebstormProjects/krasterisk_v4
PLAN_HEAD_BEFORE=$(cat "$(git rev-parse --git-dir)/gsd-plan-head-before-18-04")
echo "PLAN_HEAD_BEFORE=$PLAN_HEAD_BEFORE"
echo "COMMITS=$(git rev-list --count ${PLAN_HEAD_BEFORE}..HEAD)"
git log --oneline "${PLAN_HEAD_BEFORE}..HEAD"
echo "---"
chars=0
for f in \
  packages/backend/src/modules/speech-analytics/pipeline/run-analysis.ts \
  packages/backend/src/modules/speech-analytics/pipeline/run-analysis.spec.ts \
  packages/backend/src/modules/speech-analytics/pipeline/stt.ts \
  packages/backend/src/modules/speech-analytics/pipeline/score.ts \
  packages/backend/src/modules/speech-analytics/pipeline/channel-diarize.ts \
  packages/backend/src/modules/speech-analytics/pipeline/channel-diarize.spec.ts \
  packages/backend/src/modules/speech-analytics/pipeline.ts \
  packages/backend/src/modules/speech-analytics/jobs/sa-analysis.worker.ts
do
  c=$(wc -c < "$f" | tr -d ' ')
  chars=$((chars + c))
done
echo "chars=$chars tokens=$((chars / 4))"
