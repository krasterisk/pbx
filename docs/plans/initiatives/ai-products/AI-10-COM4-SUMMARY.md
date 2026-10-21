# AI-10 COM4 — packaging overlap with DB-04

Status: **implemented locally (docs + preflight; not I1)** on 2026-09-20 under [AI-10](AI-10-PLAN.md) COM4. Coordinator `codex-direct`. Checklist: [AI-10-COM4-PREFLIGHT](AI-10-COM4-PREFLIGHT.md).

Community composition stays without commercial `speech-analytics` / `ai-voice` runtime modules. Commercial boot already refuses a mismatched `DB_SCHEMA_PROFILE`. Preflight checks dialect, profile, customer data key, worker flag, offline heartbeat and publisher-private-key absence. MIT license is unchanged. Installer/restore/upgrade remain DB-04 I1–I3.
