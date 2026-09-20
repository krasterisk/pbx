# AI-10 10R verification — 2026-09-20

Status: **implemented locally; I1 installer / I4 native PBX not this slice**. Coordinator `codex-direct`. PLAN [AI-10](AI-10-PLAN.md) SHA-256 `7D50CE43333E27871882DE59DD7BF09DE899F65B8837FE82B89F23B5DDA3AE4A`.

## Passed

- `robots-onboarding.spec.ts` — robots-only onboarding, unsupported SIP disabled, expiry drain + `admissions_stopped`.
- `ai-voice.spec.ts` drain-on-expiry keeps in-flight sessions.
- `realtime-session.spec.ts` UDP stays draft; TLS is `sip_profile_unsupported`.
- HTTP drain marks tenant `ready` deployments `draining`. SIP create returns `reason` / `ready: false`.
- `/api/ai-voice` and `/api/v1/ai-voice` share the JWT controller. Standalone robot shell lists onboarding without an analytics step.

## Deviations / not this slice

- Self-hosted robots-only installer smoke (DEP-04 / I1–I3).
- Native PBX CDR/queue_log install (I4).
- TLS/SRTP/NAT certification and `liveMcp=true`.
- MET5 holdout. No autodial/`xray-ui`, no live tenant debit.
