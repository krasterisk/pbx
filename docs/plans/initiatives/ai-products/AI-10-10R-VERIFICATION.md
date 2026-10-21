# AI-10 10R verification — 2026-09-20

Status: **implemented; native PBX host module load / TLS-SRTP-NAT lab / AI-11 not this slice**. Coordinator `codex-direct`. PLAN [AI-10](AI-10-PLAN.md) SHA-256 `7D50CE43333E27871882DE59DD7BF09DE899F65B8837FE82B89F23B5DDA3AE4A`.

## Passed

- `robots-onboarding.spec.ts` — robots-only onboarding, unsupported SIP disabled, expiry drain + `admissions_stopped`.
- `ai-voice.spec.ts` drain-on-expiry keeps in-flight sessions.
- `realtime-session.spec.ts` UDP stays draft; TLS is `sip_profile_unsupported`.
- HTTP drain marks tenant `ready` deployments `draining`. SIP create returns `reason` / `ready: false`.
- `/api/ai-voice` and `/api/v1/ai-voice` share the JWT controller. Standalone robot shell lists onboarding without an analytics step.
- Docs unit: `npm run test:db:10r` **2/2**.
- Disposable matrix on `root@ipbx.krasterisk.ru`: MySQL TAP **2/2**, PostgreSQL TAP **2/2**, `FAIL=0`. Evidence: [REMOTE-MATRIX](evidence/10r/REMOTE-MATRIX.md). I1 `robot-api` install, live HTTP onboarding, OpenAPI `/api/docs-json`, tenant B isolation, analytics/PBX routes 404, no `cdr` table.

## Deviations / not this slice

- Native PBX CDR/`queue_log` install (I4 host unixODBC / Asterisk module load).
- TLS/SRTP/NAT certification and `liveMcp=true`.
- MET5 holdout. No autodial/`xray-ui`, no live tenant debit, no `productRuntime` flip.
- AI-11 needs a new PLAN and is not assigned.
