#!/usr/bin/env bash
# gsd-guard=supplied-root-pin (#4254) — run before Edit/Write and every commit.
set -euo pipefail
PINNED_ROOT='C:/Users/Professional/WebstormProjects/krasterisk_v4'
PIN_STAGE=''
PIN_DIAG=''
gsd_pin_fail() {
  echo "FATAL: executor root does not match the orchestrator-supplied PROJECT_ROOT pin (#4254)." >&2
  echo "  Pinned root: ${PINNED_ROOT:-<empty or unexpanded>}" >&2
  echo "  Actual root: ${ACTUAL_ROOT:-<none>}" >&2
  echo "  Guard stage: ${PIN_STAGE:-<unset>}" >&2
  if [ -n "${PIN_DIAG:-}" ]; then echo "  Diagnostic: $PIN_DIAG" >&2; fi
  exit 1
}
BS=$(printf '\134')
if [ -z "$BS" ]; then
  PIN_STAGE=form-gate
  PIN_DIAG='backslash comparator generation failed'
  gsd_pin_fail
fi
case "$PINNED_ROOT" in
  ''|'{PINNED_ROOT}') PIN_STAGE=pin-unbound; gsd_pin_fail ;;
  /*) ;;
  [A-Za-z]:/*|[A-Za-z]:"$BS"*) ;;
  *) PIN_STAGE=form-gate; gsd_pin_fail ;;
esac
cd "$PINNED_ROOT"
ACTUAL_ROOT=$(git rev-parse --show-toplevel 2>/dev/null)
if [ -z "$ACTUAL_ROOT" ]; then
  PIN_STAGE=actual-capture
  gsd_pin_fail
fi
PINNED_TL=$(git -C "$PINNED_ROOT" rev-parse --show-toplevel 2>/dev/null)
if [ -z "$PINNED_TL" ]; then
  PIN_STAGE=pinned-capture
  gsd_pin_fail
fi
if [ "$ACTUAL_ROOT" != "$PINNED_TL" ]; then
  SUPER_TL=$(git rev-parse --show-superproject-working-tree 2>/dev/null || true)
  if [ "$SUPER_TL" != "$PINNED_TL" ]; then
    PIN_STAGE=root-mismatch
    PIN_DIAG="actual=${ACTUAL_ROOT} pinned=${PINNED_TL} superproject=${SUPER_TL:-<none>}"
    gsd_pin_fail
  fi
fi
echo "PIN_OK actual=$ACTUAL_ROOT"
LEDGER="$(git rev-parse --git-dir)/gsd-plan-head-before-18-10"
if [ ! -f "$LEDGER" ]; then
  printf '%s\n' 'ed9b38a1baed1f4e96c5958d2b080e43517dfc15' > "$LEDGER"
fi
echo "LEDGER=$(cat "$LEDGER")"
SAMPLES="${SPEECH_ANALYTICS_SAMPLES_DIR:-/z/temp/speech-analytics-samples}"
if [ -d "$SAMPLES/mono" ] && [ -d "$SAMPLES/stereo" ]; then
  echo "SAMPLES_OK dir=$SAMPLES mono=$(ls "$SAMPLES/mono" 2>/dev/null | wc -l) stereo=$(ls "$SAMPLES/stereo" 2>/dev/null | wc -l)"
else
  echo "SAMPLES_DIR_MISSING_OR_INCOMPLETE dir=$SAMPLES"
fi
