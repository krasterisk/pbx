# AI-10 10A verification — 2026-09-20

Status: **implemented; robots-only live smoke / native PBX / AI-11 not this slice**. Coordinator `codex-direct`. PLAN [AI-10](AI-10-PLAN.md) SHA-256 `7D50CE43333E27871882DE59DD7BF09DE899F65B8837FE82B89F23B5DDA3AE4A`.

## Passed

- `analytics-onboarding.spec.ts` — project→key→upload→result, A/B isolation, retention/ACL fail-closed, secret-once, CI shadow billable.
- Standalone analytics shell lists onboarding steps and omits AMI/ARI/PBX/CDR.
- Public analysis docs and OpenAPI tag point at `/api/v1/speech-analytics` and `/api/v1/integrations`. Publish + `analytics:upload`/`analytics:read` grants are in the curl walk.
- PBX fields are stripped for `analytics-api` / `robot-api` profiles.
- Docs unit: `npm run test:db:10a` **2/2**.
- Disposable matrix on `root@ipbx.krasterisk.ru`: MySQL TAP **2/2**, PostgreSQL TAP **2/2**, `FAIL=0`. Evidence: [REMOTE-MATRIX](evidence/10a/REMOTE-MATRIX.md). I1 `analytics-api` install, live HTTP onboarding, OpenAPI `/api/docs-json`, tenant B isolation, PBX routes 404, no `cdr` table.

## Deviations / not this slice

- Robots-only installer smoke (10R).
- Native PBX CDR/`queue_log` install (I4 host module load).
- No `productRuntime` flip, no live tenant debit, no autodial/`xray-ui`.
