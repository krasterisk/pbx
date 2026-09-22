#!/usr/bin/env bash
set -euo pipefail
PINNED_ROOT='C:/Users/Professional/WebstormProjects/krasterisk_v4'
cd "$PINNED_ROOT"
ACTUAL=$(git rev-parse --show-toplevel)
PINNED=$(git -C "$PINNED_ROOT" rev-parse --show-toplevel)
if [ "$ACTUAL" != "$PINNED" ]; then
  echo "FATAL: pin mismatch actual=$ACTUAL pinned=$PINNED" >&2
  exit 1
fi
echo "PIN_OK"
BRANCH=$(git rev-parse --abbrev-ref HEAD)
echo "BRANCH=$BRANCH"
_GSD_LEDGER="$(git rev-parse --git-dir)/gsd-plan-head-before-18-08"
if [ ! -f "$_GSD_LEDGER" ]; then
  git rev-parse HEAD > "$_GSD_LEDGER"
fi
echo "LEDGER=$(cat "$_GSD_LEDGER")"
