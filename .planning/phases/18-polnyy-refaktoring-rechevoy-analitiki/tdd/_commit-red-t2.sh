#!/usr/bin/env bash
set -euo pipefail
PINNED_ROOT='C:/Users/Professional/WebstormProjects/krasterisk_v4'
cd "$PINNED_ROOT"
GSD="$USERPROFILE/.cursor/gsd-core/bin/gsd-tools.cjs"
node "$GSD" check tdd-red-evidence \
  ".planning/phases/18-polnyy-refaktoring-rechevoy-analitiki/tdd/channel-diarize-red-evidence.json"
node "$GSD" query commit "test(18-04): add failing channel-diarize map and energy specs

- Assert D-24 route vs upload maps and API swap
- Assert identical channels are not stereo
- Assert energy failure uses LLM roles without second STT
- Assert dual-stt is not exported
" --files \
  packages/backend/src/modules/speech-analytics/pipeline/channel-diarize.spec.ts \
  packages/backend/src/modules/speech-analytics/pipeline/channel-diarize.ts \
  .planning/phases/18-polnyy-refaktoring-rechevoy-analitiki/tdd/channel-diarize-red-evidence.json
git log -1 --oneline
