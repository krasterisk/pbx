# AI-11 11O — ops drills

Status: **implemented + disposable dual-DB named AI-11 ops drills** on 2026-09-20 under [AI-11](AI-11-PLAN.md) 11O. Coordinator `codex-direct`. Docs: [AI-11-11O-OPS](AI-11-11O-OPS.md). Evidence: [evidence/11o](evidence/11o/REMOTE-MATRIX.md).

Named drill wrapping DB-04 I2 backup/restore and I3 N-1 upgrade on MySQL 8.4.11 and PostgreSQL 17.11: backup→restore→upgrade→schema readiness→worker drain→admit, missing-key fail-closed, DBR-07 dialect refuse, `--rollback` refused, key rotation rehearsal (`liveProductionRotated: false`). Product runtime stays `not-installed`. No live tenant debit, no autodial/`xray-ui`. 11A/11R LIVE-UAT are separate assignments.
