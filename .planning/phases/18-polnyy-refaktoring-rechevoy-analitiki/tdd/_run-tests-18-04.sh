#!/usr/bin/env bash
set -euo pipefail
cd /c/Users/Professional/WebstormProjects/krasterisk_v4
npm run test -w @krasterisk/backend -- --testPathPattern="run-analysis" --no-coverage 2>&1 | tee /tmp/run-analysis-red.txt
echo EXIT:$?
