#!/usr/bin/env bash
set -euo pipefail
cd /c/Users/Professional/WebstormProjects/krasterisk_v4
npm run test -w @krasterisk/backend -- --testPathPattern='channel-diarize' --no-coverage 2>&1
echo EXIT:$?
