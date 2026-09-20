# AI-10 10R — robots onboarding

Status: **implemented locally (not I1 live smoke, not I4 native PBX)** on 2026-09-20 under [AI-10](AI-10-PLAN.md) 10R. Coordinator `codex-direct`. Docs: [AI-10-10R-AI-VOICE](AI-10-10R-AI-VOICE.md).

Standalone robots walk provider → prompt → test → SIP profile → publish without a `speech_analytics` entitlement. Unsupported SIP (`tls` without lab evidence) stays `disabled` with reason, not ready. Expiry drains ready deployments and denies new admissions while keeping in-flight sessions. JWT routes are aliased to `/api/v1/ai-voice`. Native PBX remains `native_pbx_gated` until I4 evidence.
