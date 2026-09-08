#!/usr/bin/env bash
set -euo pipefail
cd /c/Users/Professional/WebstormProjects/krasterisk_v4
GSD_TOOLS=".cursor/gsd-core/bin/gsd-tools.cjs"
gsd_run() { node "$GSD_TOOLS" "$@"; }

echo "GSD_IDENTITY=$(gsd_run runtime-identity --raw 2>/dev/null || true)"
echo "---INIT---"
gsd_run query init.execute-phase "14"
echo "---STATE---"
gsd_run query state.load 2>/dev/null || true
echo "---AUTO---"
echo "AUTO_CHAIN=$(gsd_run query config-get workflow._auto_chain_active --raw 2>/dev/null || echo false)"
echo "AUTO_CFG=$(gsd_run query config-get workflow.auto_advance --raw 2>/dev/null || echo false)"
echo "HUMAN_VERIFY_MODE=$(gsd_run query config-get workflow.human_verify_mode --default end-of-phase --raw 2>/dev/null || echo end-of-phase)"
echo "---AGENT_SKILLS---"
gsd_run query agent-skills gsd-executor 2>/dev/null || true
echo "---TIME---"
echo "PLAN_START_TIME=$(date -u +"%Y-%m-%dT%H:%M:%SZ")"
echo "PLAN_START_EPOCH=$(date +%s)"
echo "---WORKTREE---"
if [ -f .git ]; then
  echo "GSD_WORKTREE_PATH=$(git rev-parse --show-toplevel)"
  echo "GSD_WORKTREE_BRANCH=$(git rev-parse --abbrev-ref HEAD)"
  echo "GSD_WORKTREE_EXPECTED_BASE=$(git rev-parse HEAD)"
else
  echo "NOT_A_WORKTREE"
  echo "GIT_DIR=$(git rev-parse --git-dir)"
  echo "TOPLEVEL=$(git rev-parse --show-toplevel)"
  echo "BRANCH=$(git rev-parse --abbrev-ref HEAD)"
  echo "HEAD=$(git rev-parse HEAD)"
fi
echo "---CHECKPOINTS---"
grep -n 'type="checkpoint' ".planning/phases/14-visual-route-builder-and-automation/14-04-PLAN.md" || echo "NO_CHECKPOINTS"
