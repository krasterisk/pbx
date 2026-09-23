#!/usr/bin/env bash
set -euo pipefail
PINNED_ROOT='C:/Users/Professional/WebstormProjects/krasterisk_v4'
cd "$PINNED_ROOT"
GSD="$USERPROFILE/.cursor/gsd-core/bin/gsd-tools.cjs"
node "$GSD" query commit "feat(18-04): port energy channel diarize with D-24 maps

- Route left=customer right=operator; upload default left=operator
- API swap inverts upload map; identical L/R is not stereo
- Energy failure assigns LLM roles without a second STT pass
" --files \
  packages/backend/src/modules/speech-analytics/pipeline/channel-diarize.ts

git log -1 --oneline
npm run test -w @krasterisk/backend -- --testPathPattern='run-analysis' --no-coverage 2>&1 | tail -20
npm run test -w @krasterisk/backend -- --testPathPattern='channel-diarize' --no-coverage 2>&1 | tail -20
