#!/usr/bin/env bash
set -euo pipefail
cd /c/Users/Professional/WebstormProjects/krasterisk_v4
GSD_TOOLS=".cursor/gsd-core/bin/gsd-tools.cjs"
gsd_run() { node "$GSD_TOOLS" "$@"; }

gsd_run query commit "docs(14-04): complete dry-run walker and DialplanDryRunService plan" --files \
  .planning/phases/14-visual-route-builder-and-automation/14-04-SUMMARY.md \
  .planning/STATE.md \
  .planning/ROADMAP.md \
  .planning/REQUIREMENTS.md
