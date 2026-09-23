#!/usr/bin/env bash
set -euo pipefail
cd /c/Users/Professional/WebstormProjects/krasterisk_v4
PATTERN='url-download'
OUT='.planning/phases/18-polnyy-refaktoring-rechevoy-analitiki/tdd/18-07-t3-red.txt'
npm run test -w @krasterisk/backend -- --testPathPattern="$PATTERN" --no-coverage > "$OUT" 2>&1 || true
tail -n 100 "$OUT"
echo "EXIT_CAPTURED"
