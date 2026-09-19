# AI-02-D1 verification — 2026-09-19

Status: **D1 closed**. Coordinator `codex-direct`. PLAN [AI-02](../AI-02-PLAN.md) SHA-256 `84BCDFF527CDA7F0205635F157D6ACA460147092467E9EAE51EE6F8AF89B4907`. No production DB/PBX. No local Docker.

## Passed

- Dual-engine additive `0008-ai-jobs-assets.sql` on full-pbx and standalone analytics/robot profiles. Usage/quota/ledger tables are not created.
- State-machine unit tests for asset/job/stage/provider-operation, illegal transitions, duplicate finalize, cancel flag, succeeded immutability, dispatch crash → unknown, ordinal vs worker restart, CAS.
- Shared outbox payload v1 (ids + schema version; secrets/paths rejected).
- Schema inventory 7/7; DB unit 50/50; backend **286 suites / 3032 tests** passed (11 skipped, baseline); frontend **253/1404**; lint **0 errors** (existing warnings).
- Remote MySQL 8.4.11 **15/15** and PostgreSQL 17.11 **15/15**, including upgrade/replay, profile subset, SQL CHECK, tenant FK, unique races, concurrent version CAS, collation/index probe. [REMOTE-MATRIX](evidence/d1/REMOTE-MATRIX.md).

## Not this slice

- Admission HTTP, Redis dispatcher, leases (D2).
- Storage/probe (D3).
- Usage journal (D4).
- Product runtime still `not-installed`.

Rollback: stop applying `0008` on new installs; do not drop already-applied 0008 tables.
