#!/usr/bin/env bash
set -euo pipefail
PINNED_ROOT='C:/Users/Professional/WebstormProjects/krasterisk_v4'
cd "$PINNED_ROOT"
. ".planning/phases/18-polnyy-refaktoring-rechevoy-analitiki/tdd/_pin-guard-18-07.sh" >/dev/null

for f in \
  packages/backend/src/modules/speech-analytics/ingest/upload.service.ts \
  packages/backend/src/modules/speech-analytics/ingest/url-download.ts \
  .planning/phases/18-polnyy-refaktoring-rechevoy-analitiki/18-07-SUMMARY.md
do
  [ -f "$f" ] && echo "FOUND: $f" || echo "MISSING: $f"
done

for h in b5fe95c8 8cec8c8f e64cdfe2 31af444c; do
  git log --oneline --all | grep -q "$h" && echo "FOUND: $h" || echo "MISSING: $h"
done

GSD="$USERPROFILE/.cursor/gsd-core/bin/gsd-tools.cjs"
node "$GSD" query commit "docs(18-07): complete upload URL tokens and Get analytics plan

- Summarize hash-only tokens, sync upload, URL caps, Get analytics
" --files \
  .planning/phases/18-polnyy-refaktoring-rechevoy-analitiki/18-07-SUMMARY.md

git rev-parse --short HEAD
git log -1 --oneline
git status --short -- .planning/phases/18-polnyy-refaktoring-rechevoy-analitiki/18-07-SUMMARY.md
