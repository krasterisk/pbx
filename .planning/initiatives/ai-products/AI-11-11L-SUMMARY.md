# AI-11 11L — load profile

Status: **implemented + disposable dual-DB load matrix** on 2026-09-20 under [AI-11](AI-11-PLAN.md) 11L. Coordinator `codex-direct`. Docs: [AI-11-11L-LOAD](AI-11-11L-LOAD.md). Evidence: [evidence/11l](evidence/11l/REMOTE-MATRIX.md).

Disposable I1 `analytics-api` clean-install on MySQL 8.4.11 and PostgreSQL 17.11, then admission ladder **1→5→20** via `admitJob` under default caps. Media vs batch fairness and quota fail-closed (`fairness_exhausted`) are measured in-process. Published profile JSON sets `productSlaClaimed: false`. Product runtime stays `not-installed`. No live tenant debit, no autodial/`xray-ui`. 11F fault injection is a separate assignment.
