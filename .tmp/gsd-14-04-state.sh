#!/usr/bin/env bash
set -euo pipefail
cd /c/Users/Professional/WebstormProjects/krasterisk_v4
GSD_TOOLS=".cursor/gsd-core/bin/gsd-tools.cjs"
gsd_run() { node "$GSD_TOOLS" "$@"; }

gsd_run query state.advance-plan
gsd_run query state.update-progress
gsd_run query state.record-metric \
  --phase "14-visual-route-builder-and-automation" --plan "04" --duration "26" \
  --tasks "3" --files "15"
gsd_run query state.add-decision --summary "14-04: walker is sync; service preloads tenant IVRs/routes/contexts then injects resolve callbacks"
gsd_run query state.add-decision --summary "14-04: toivr uses IvrsService.findAll plus RouteReferencesService.findReferences with JWT uid"
gsd_run query state.add-decision --summary "14-04: Task 1 files landed in sibling 014f316; Task 2/3 are 2a80abc and a770473"
gsd_run query state.record-session \
  --stopped-at "Completed 14-04-PLAN.md" --resume-file "None"
gsd_run query roadmap.update-plan-progress "14"
gsd_run query requirements.mark-complete D-29 D-30 D-32 D-43 D-44 D-45 D-46 D-47 D-48 D-38
