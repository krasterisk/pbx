#!/usr/bin/env bash
set -euo pipefail
cd /c/Users/Professional/WebstormProjects/krasterisk_v4
fail=0
for f in \
  packages/shared/src/utils/dialplan-walk/walkDialplanGraph.ts \
  packages/shared/src/utils/dialplan-walk/exactRouteResolver.ts \
  packages/backend/src/modules/dialplan-dry-run/dialplan-dry-run.service.ts \
  packages/backend/src/modules/dialplan-dry-run/dialplan-dry-run.controller.ts \
  packages/backend/src/modules/dialplan-dry-run/dialplan-dry-run.module.ts \
  packages/backend/src/modules/dialplan-dry-run/dto/dry-run.dto.ts \
  packages/backend/src/modules/dialplan-dry-run/dialplan-dry-run-ai.adapter.ts \
  packages/frontend/src/shared/api/endpoints/dryRunApi.ts \
  .planning/phases/14-visual-route-builder-and-automation/14-04-SUMMARY.md
do
  if [ -f "$f" ]; then echo "FOUND: $f"; else echo "MISSING: $f"; fail=1; fi
done
for h in 014f316 2a80abc a770473; do
  if git log --oneline --all | grep -q "$h"; then echo "FOUND: $h"; else echo "MISSING: $h"; fail=1; fi
done
exit $fail
