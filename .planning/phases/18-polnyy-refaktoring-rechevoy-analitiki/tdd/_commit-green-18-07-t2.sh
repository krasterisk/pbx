#!/usr/bin/env bash
set -euo pipefail
PINNED_ROOT='C:/Users/Professional/WebstormProjects/krasterisk_v4'
cd "$PINNED_ROOT"
. ".planning/phases/18-polnyy-refaktoring-rechevoy-analitiki/tdd/_pin-guard-18-07.sh" >/dev/null

GSD="$USERPROFILE/.cursor/gsd-core/bin/gsd-tools.cjs"
node "$GSD" query commit "feat(18-07): implement sync upload and hash-only SA tokens

- API sync=true waits for scored result; cabinet always accepts batch
- Token project binding rejects body override; digest-only storage
- putUploadContent persists bytes; issuers ADMIN and SUPERADMIN only
" --files \
  packages/backend/src/modules/speech-analytics/ingest/upload.service.ts \
  packages/backend/src/modules/speech-analytics/ingest/upload.service.spec.ts \
  packages/backend/src/modules/speech-analytics/speech-analytics-public.controller.ts \
  packages/backend/src/modules/integration-credentials/integration-credentials.service.ts \
  packages/backend/src/modules/integration-credentials/integration-credentials.service.spec.ts \
  packages/backend/src/modules/speech-analytics/speech-analytics.service.ts

git rev-parse --short HEAD
git log -1 --oneline
