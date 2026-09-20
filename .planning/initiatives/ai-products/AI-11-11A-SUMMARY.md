# AI-11 11A — analytics LIVE-UAT

Status: **implemented + disposable dual-DB LIVE-UAT** on 2026-09-20 under [AI-11](AI-11-PLAN.md) 11A. Coordinator `codex-direct`. Docs: [AI-11-11A-UAT](AI-11-11A-UAT.md). Evidence: [evidence/11a](evidence/11a/REMOTE-MATRIX.md).

Wraps 10A analytics onboarding on MySQL 8.4.11 and PostgreSQL 17.11: pilot A project→key→upload→run, tenant B isolation, pilot B parallel entitled project/upload/run, cross-tenant deny both ways, OpenAPI tags, PBX routes 404. Eval report names remaining gates `local_ai_stt_not_claimed` and `met5_30_call_holdout_not_claimed`. Product runtime stays `not-installed`. No I4/AMI/ARI, no live tenant debit, no autodial/`xray-ui`. 11R robots LIVE-UAT is a separate assignment.
