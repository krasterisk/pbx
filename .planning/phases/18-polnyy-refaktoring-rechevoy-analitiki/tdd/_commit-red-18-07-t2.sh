#!/usr/bin/env bash
set -euo pipefail
PINNED_ROOT='C:/Users/Professional/WebstormProjects/krasterisk_v4'
cd "$PINNED_ROOT"
. ".planning/phases/18-polnyy-refaktoring-rechevoy-analitiki/tdd/_pin-guard-18-07.sh" >/dev/null

HEAD_REF=$(git symbolic-ref --quiet HEAD || echo DETACHED)
ACTUAL_BRANCH=$(git rev-parse --abbrev-ref HEAD)
echo "BRANCH=$ACTUAL_BRANCH HEAD_REF=$HEAD_REF"

_GSD_LEDGER="$(git rev-parse --git-dir)/gsd-plan-head-before-18-07"
[ -f "$_GSD_LEDGER" ] || git rev-parse HEAD > "$_GSD_LEDGER"

GSD="$USERPROFILE/.cursor/gsd-core/bin/gsd-tools.cjs"
node "$GSD" query commit "test(18-07): add failing upload sync and hash-token specs

- Assert API sync=true waits for scored result and stores bytes
- Assert token project binding and hash-only SA token issue/list
- RED stubs intentionally skip sync wait and leak token list
" --files \
  packages/backend/src/modules/speech-analytics/ingest/upload.service.ts \
  packages/backend/src/modules/speech-analytics/ingest/upload.service.spec.ts \
  packages/backend/src/modules/speech-analytics/speech-analytics-public.controller.spec.ts \
  packages/backend/src/modules/integration-credentials/integration-credentials.service.ts \
  packages/backend/src/modules/integration-credentials/integration-credentials.service.spec.ts \
  .planning/phases/18-polnyy-refaktoring-rechevoy-analitiki/tdd/18-07-t2-red-evidence.json \
  .planning/phases/18-polnyy-refaktoring-rechevoy-analitiki/tdd/18-07-t2-red.txt

git rev-parse --short HEAD
git log -1 --oneline
