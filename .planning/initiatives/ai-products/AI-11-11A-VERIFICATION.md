# AI-11 11A verification — 2026-09-20

Status: **implemented; 11R/11M not this slice**. Coordinator `codex-direct`. PLAN [AI-11](AI-11-PLAN.md) SHA-256 `134627CF6136025BB0E1C76A3FD91F8405803E4D2F0F52394EDC1B42A42F5756`.

## Passed

- Eval report helpers: dual pilots, isolation flags, remaining gates local-AI + MET5.
- Docs unit: `npm run test:db:11a` **3/3**.
- Disposable matrix on `root@ipbx.krasterisk.ru`: MySQL TAP **2/2**, PostgreSQL TAP **2/2**, `FAIL=0`. Evidence: [REMOTE-MATRIX](evidence/11a/REMOTE-MATRIX.md). Pilot A+B parallel; A/B cannot cross-read; analytics-only (no `cdr`); `productRuntime: not-installed`.

## Deviations / not this slice

- 11R robots LIVE-UAT, 11M release matrix.
- Real local-AI STT and MET5 30-call holdout remain named open gates.
- No `productRuntime` flip, no live tenant debit, no autodial/`xray-ui`.
