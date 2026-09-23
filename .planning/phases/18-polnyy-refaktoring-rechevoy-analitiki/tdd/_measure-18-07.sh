#!/usr/bin/env bash
set -euo pipefail
cd /c/Users/Professional/WebstormProjects/krasterisk_v4
LEDGER=$(cat "$(git rev-parse --git-dir)/gsd-plan-head-before-18-07")
echo "LEDGER=$LEDGER"
echo "COMMITS=$(git rev-list --count ${LEDGER}..HEAD)"
git log --oneline "${LEDGER}..HEAD"
echo "CHARS=$(git diff --numstat ${LEDGER}..HEAD -- \
  packages/backend/src/modules/speech-analytics/ingest \
  packages/backend/src/modules/speech-analytics/speech-analytics-public.controller.ts \
  packages/backend/src/modules/speech-analytics/speech-analytics-public.controller.spec.ts \
  packages/backend/src/modules/speech-analytics/speech-analytics-jwt.controller.ts \
  packages/backend/src/modules/speech-analytics/speech-analytics.service.ts \
  packages/backend/src/modules/integration-credentials/integration-credentials.service.ts \
  packages/backend/src/modules/integration-credentials/integration-credentials.service.spec.ts \
  | awk '{a+=$1+$2} END{print a+0}')"
