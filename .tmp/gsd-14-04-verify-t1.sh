#!/usr/bin/env bash
set -euo pipefail
cd /c/Users/Professional/WebstormProjects/krasterisk_v4
npm run build -w @krasterisk/shared
npm run test -w @krasterisk/shared -- dialplan-walk --no-coverage
npm run test -w @krasterisk/backend -- --testPathPattern="dialplan-dry-run" --no-coverage
