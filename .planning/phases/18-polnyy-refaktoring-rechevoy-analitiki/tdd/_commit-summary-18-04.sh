#!/usr/bin/env bash
set -euo pipefail
PINNED_ROOT='C:/Users/Professional/WebstormProjects/krasterisk_v4'
cd "$PINNED_ROOT"
ACTUAL_ROOT=$(git rev-parse --show-toplevel)
PINNED_TL=$(git -C "$PINNED_ROOT" rev-parse --show-toplevel)
[ "$ACTUAL_ROOT" = "$PINNED_TL" ] || { echo FATAL; exit 1; }

# Self-check
for f in \
  packages/backend/src/modules/speech-analytics/pipeline/run-analysis.ts \
  packages/backend/src/modules/speech-analytics/pipeline/channel-diarize.ts \
  .planning/phases/18-polnyy-refaktoring-rechevoy-analitiki/18-04-SUMMARY.md
do
  [ -f "$f" ] && echo "FOUND: $f" || echo "MISSING: $f"
done
for h in 10a4ba09 6f4cf1ee 2bac2162 65431cfe; do
  git log --oneline --all | grep -q "$h" && echo "FOUND: $h" || echo "MISSING: $h"
done

GSD="$USERPROFILE/.cursor/gsd-core/bin/gsd-tools.cjs"
# best-effort windows ledger for known stubs
node "$GSD" windows append \
  --kind stub \
  --phase "18" \
  --file "packages/backend/src/modules/speech-analytics/pipeline/stt.ts" \
  --description "transcribeAudio is a thin provider port; Nest STT wiring is later" \
  2>/dev/null || true

node "$GSD" query commit "docs(18-04): complete runAnalysis and channel-diarize plan" --files \
  .planning/phases/18-polnyy-refaktoring-rechevoy-analitiki/18-04-SUMMARY.md

PLAN_HEAD_BEFORE=$(cat "$(git rev-parse --git-dir)/gsd-plan-head-before-18-04")
echo "COMMITS_FINAL=$(git rev-list --count ${PLAN_HEAD_BEFORE}..HEAD)"
git log --oneline "${PLAN_HEAD_BEFORE}..HEAD"
