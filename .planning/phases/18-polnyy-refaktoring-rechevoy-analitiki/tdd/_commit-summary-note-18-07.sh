#!/usr/bin/env bash
set -euo pipefail
cd /c/Users/Professional/WebstormProjects/krasterisk_v4
. ".planning/phases/18-polnyy-refaktoring-rechevoy-analitiki/tdd/_pin-guard-18-07.sh" >/dev/null
node "$USERPROFILE/.cursor/gsd-core/bin/gsd-tools.cjs" query commit "docs(18-07): refresh SUMMARY self-check note

- Include docs commit hash in self-check list
" --files .planning/phases/18-polnyy-refaktoring-rechevoy-analitiki/18-07-SUMMARY.md
git log --oneline -7
