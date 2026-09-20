# AI-10 10A — analytics onboarding

Status: **implemented locally (not I1 live smoke)** on 2026-09-20 under [AI-10](AI-10-PLAN.md) 10A. Coordinator `codex-direct`. Docs: [AI-10-10A-PUBLIC-ANALYSIS](AI-10-10A-PUBLIC-ANALYSIS.md).

Standalone analytics walks project → integration key → sample upload → result without robots or PBX fields. SaaS A/B isolation, retention/export/offboarding receipts, and one-time key rotation are covered by the onboarding engine. COM2 billable stays shadow in CI. OpenAPI tag `Speech Analytics Public` plus curl examples match `/api/v1/speech-analytics`. Live disposable-API match and self-hosted installer smoke remain DB-04 I1–I3.
