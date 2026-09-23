#!/usr/bin/env bash
set -euo pipefail
cd /c/Users/Professional/WebstormProjects/krasterisk_v4
npm run test -w @krasterisk/backend -- --testPathPattern='sa-analysis.worker' --no-coverage 2>&1 | tail -40
