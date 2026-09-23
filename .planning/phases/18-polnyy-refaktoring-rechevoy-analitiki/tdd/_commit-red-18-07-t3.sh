#!/usr/bin/env bash
set -euo pipefail
PINNED_ROOT='C:/Users/Professional/WebstormProjects/krasterisk_v4'
cd "$PINNED_ROOT"
. ".planning/phases/18-polnyy-refaktoring-rechevoy-analitiki/tdd/_pin-guard-18-07.sh" >/dev/null

GSD="$USERPROFILE/.cursor/gsd-core/bin/gsd-tools.cjs"
node "$GSD" check tdd-red-evidence \
  .planning/phases/18-polnyy-refaktoring-rechevoy-analitiki/tdd/18-07-t3-red-evidence.json

node "$GSD" query commit "test(18-07): add failing URL download and Get analytics specs

- Assert incomplete/oversized URL downloads error without SA-CHARGE-RUN
- Assert sync wait and Get analytics admission (pause does not block)
- RED stubs intentionally accept incomplete bodies and block on pause
" --files \
  packages/backend/src/modules/speech-analytics/ingest/url-download.ts \
  packages/backend/src/modules/speech-analytics/ingest/url-download.spec.ts \
  .planning/phases/18-polnyy-refaktoring-rechevoy-analitiki/tdd/18-07-t3-red-evidence.json \
  .planning/phases/18-polnyy-refaktoring-rechevoy-analitiki/tdd/18-07-t3-red.txt

git rev-parse --short HEAD
git log -1 --oneline
