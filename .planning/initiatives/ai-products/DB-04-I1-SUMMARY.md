# DB-04 I1 — clean install

Status: **implemented locally + disposable dual-DB evidence** on 2026-09-20 under [DB-04](DB-04-PLAN.md) I1. Coordinator `codex-direct`. Runbook: [DB-04-I1-INSTALL](DB-04-I1-INSTALL.md).

`clean-install.cjs` wraps `db:migrate` / `seed-ci` with commercial preflight, binary/profile matching, 0019-only-on-full-pbx, and forbidden `--rollback`. Empty installs of `full-pbx`, `analytics-api`, and `robot-api` reach `0020-ai-sku-catalog.sql` on MySQL 8.4.11 and PostgreSQL 17.11, seed tenants 0/A/B without overwrite, and refuse dirty journals and profile mismatch. Community composition still does not import `speech-analytics` / `ai-voice`. Sequelize `synchronize`/`alter` stay false. I2–I4 remain gated.
