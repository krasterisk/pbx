# AI-10 10A — analytics onboarding

Status: **implemented locally + disposable dual-DB live API / I1 analytics-only smoke** on 2026-09-20 under [AI-10](AI-10-PLAN.md) 10A. Coordinator `codex-direct`. Docs: [AI-10-10A-PUBLIC-ANALYSIS](AI-10-10A-PUBLIC-ANALYSIS.md). Evidence: [evidence/10a](evidence/10a/REMOTE-MATRIX.md).

Standalone analytics walks project → publish → integration key (`analytics:upload` + `analytics:read`) → sample upload → analysis-run 202 → result without robots or PBX fields. SaaS A/B isolation, retention/export/offboarding receipts, and one-time key rotation stay in the onboarding engine. COM2 billable stays shadow in CI. OpenAPI tag `Speech Analytics Public` plus curl examples match `/api/v1/speech-analytics`. Analytics-only installs do not wait for I4. Robots-only live smoke is 10R. AI-11 is not assigned.
