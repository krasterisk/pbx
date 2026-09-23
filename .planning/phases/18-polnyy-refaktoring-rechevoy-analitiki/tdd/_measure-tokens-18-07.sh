#!/usr/bin/env bash
set -euo pipefail
cd /c/Users/Professional/WebstormProjects/krasterisk_v4
LEDGER=$(cat "$(git rev-parse --git-dir)/gsd-plan-head-before-18-07")
DIFF_CHARS=$(git diff ${LEDGER}..HEAD -- \
  packages/backend/src/modules/speech-analytics/ingest \
  packages/backend/src/modules/speech-analytics/speech-analytics-public.controller.ts \
  packages/backend/src/modules/speech-analytics/speech-analytics-public.controller.spec.ts \
  packages/backend/src/modules/speech-analytics/speech-analytics-jwt.controller.ts \
  packages/backend/src/modules/speech-analytics/speech-analytics.service.ts \
  packages/backend/src/modules/integration-credentials/integration-credentials.service.ts \
  packages/backend/src/modules/integration-credentials/integration-credentials.service.spec.ts \
  | wc -c)
echo "DIFF_CHARS=$DIFF_CHARS"
echo "TOKENS=$((DIFF_CHARS / 4))"
