#!/usr/bin/env bash
set -euo pipefail
PINNED_ROOT='C:/Users/Professional/WebstormProjects/krasterisk_v4'
cd "$PINNED_ROOT"
. ".planning/phases/18-polnyy-refaktoring-rechevoy-analitiki/tdd/_pin-guard-18-07.sh" >/dev/null

# Regression + task verifies
npm run test -w @krasterisk/backend -- \
  --testPathPattern='upload.service|url-download|integration-credentials.service|speech-analytics-public' \
  --no-coverage

GSD="$USERPROFILE/.cursor/gsd-core/bin/gsd-tools.cjs"
node "$GSD" query commit "feat(18-07): implement URL ingest caps and Get analytics

- Incomplete/oversized URL downloads error without SA-CHARGE-RUN
- One URL sync=true waits; open LAN/public download with insecure TLS
- JWT Get analytics uses same asset; pause does not block
" --files \
  packages/backend/src/modules/speech-analytics/ingest/url-download.ts \
  packages/backend/src/modules/speech-analytics/ingest/url-download.spec.ts \
  packages/backend/src/modules/speech-analytics/speech-analytics-jwt.controller.ts \
  packages/backend/src/modules/speech-analytics/speech-analytics-public.controller.ts

git rev-parse --short HEAD
git log -1 --oneline
