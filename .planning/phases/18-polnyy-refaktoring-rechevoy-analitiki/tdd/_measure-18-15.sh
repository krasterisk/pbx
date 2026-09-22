#!/usr/bin/env bash
set -euo pipefail
cd /c/Users/Professional/WebstormProjects/krasterisk_v4
PLAN_HEAD_BEFORE=$(cat "$(git rev-parse --git-dir)/gsd-plan-head-before-18-15")
echo "PLAN_HEAD_BEFORE=$PLAN_HEAD_BEFORE"
echo "HEAD=$(git rev-parse HEAD)"
echo "COMMITS=$(git rev-list --count ${PLAN_HEAD_BEFORE}..HEAD)"
git log --oneline "${PLAN_HEAD_BEFORE}..HEAD"
# rough chars/4 over owned files
CHARS=$(git diff --numstat "${PLAN_HEAD_BEFORE}"..HEAD -- \
  packages/backend/src/modules/speech-analytics/module-settings.service.ts \
  packages/backend/src/modules/speech-analytics/module-settings.service.spec.ts \
  packages/backend/src/modules/speech-analytics/speech-analytics-ai.adapter.ts \
  packages/backend/src/modules/speech-analytics/speech-analytics-ai.adapter.spec.ts \
  packages/backend/src/skills/speech-analytics/SKILL.md \
  packages/frontend/src/features/speechAnalytics/ui/ModuleSettings/ \
  packages/frontend/src/features/speechAnalytics/api/speechAnalyticsApi.ts \
  | awk '{ add+=$1; del+=$2 } END { print (add+del)*40 }')
echo "ROUGH_TOKENS=$CHARS"
