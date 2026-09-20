# AI-10 10A verification — 2026-09-20

Status: **implemented locally; I1 installer / live disposable API not this slice**. Coordinator `codex-direct`. PLAN [AI-10](AI-10-PLAN.md) SHA-256 `7D50CE43333E27871882DE59DD7BF09DE899F65B8837FE82B89F23B5DDA3AE4A`.

## Passed

- `analytics-onboarding.spec.ts` — project→key→upload→result, A/B isolation, retention/ACL fail-closed, secret-once, CI shadow billable.
- Standalone analytics shell lists onboarding steps and omits AMI/ARI/PBX/CDR.
- Public analysis docs and OpenAPI tag point at `/api/v1/speech-analytics` and `/api/v1/integrations`.
- PBX fields are stripped for `analytics-api` / `robot-api` profiles.

## Deviations / not this slice

- Live disposable public API match.
- Self-hosted analytics-only installer smoke (DEP-03 / DB-04 I1–I3).
- No `productRuntime` flip, no live tenant debit, no autodial/`xray-ui`.
