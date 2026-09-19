# AI-00 Task 1 — baseline and ownership

**Status:** complete for the documentation-only Task 1 assignment. **Plan:** [AI-00-PLAN](AI-00-PLAN.md), Task 1. **Coordinator:** Codex task `01a0b2cf-f755-74d0-8a7d-7e65ee34fc65`, mode `codex-direct`.

## Snapshot

- Checked 2026-09-18 at HEAD `92d342d1398ad7f6b5839f35f12e168741e00d03`.
- The shared tree is dirty. It contains the separate autodial refactor, DB portability work, ARI work and frontend changes. This task neither resets nor stages any of them.
- `packages/backend/src/modules/autodial/**`, `packages/frontend/src/features/autodial/**`, `packages/shared/src/types/autodial.types.ts`, migrations, routes and shared DTOs are explicitly read-only. The user confirmed that autodial is a neighbouring, separate task.
- DB-01 is complete. DB-02 is a partial dual-engine foundation: D1/D3 and runtime evidence exist, while D2 belongs solely to the autodial task. It is not an AI-00 dependency to be acquired or changed here.

## Scope of this task

The evidence-backed compatibility matrix for scripted robots, existing AI-agent drafts, PBX assistant, analytics-only, robot-only and BOX/CLOUD profiles is recorded in [AI-00-COMPATIBILITY-MATRIX.md](AI-00-COMPATIBILITY-MATRIX.md). It confirms tenant ownership and deployment/entitlement assumptions from the canonical architecture and current source, without editing application behavior.

## Constraints

- PostgreSQL and MySQL remain installation choices; Sequelize is retained.
- SaaS, self-hosted and OpenSource-base requirements apply to both new products.
- No package installation, production access, PBX operation, remote test-server use or paid provider call is authorised by this documentation-only task.
- A later ARI/media fixture or recording spike requires its own exact assignment and owned paths.
