# AI-10 10R — robots onboarding

Status: **implemented locally + disposable dual-DB live API / I1 robots-only smoke** on 2026-09-20 under [AI-10](AI-10-PLAN.md) 10R. Coordinator `codex-direct`. Docs: [AI-10-10R-AI-VOICE](AI-10-10R-AI-VOICE.md). Evidence: [evidence/10r](evidence/10r/REMOTE-MATRIX.md).

Standalone robots walk provider → publish version → browser_test deployment → SIP profile → drain without a `speech_analytics` entitlement. Unsupported SIP (`tls` without lab evidence) stays `disabled` with `sip_profile_unsupported` (persisted as CHECK-allowed `failed`). Expiry/drain denies new admissions (`admissions_stopped`) while `liveSip` stays false. JWT routes are aliased to `/api/v1/ai-voice`. Native PBX remains `native_pbx_gated` until I4 host evidence. AI-11 is not assigned.
