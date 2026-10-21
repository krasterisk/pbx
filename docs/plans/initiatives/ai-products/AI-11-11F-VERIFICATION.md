# AI-11 11F verification — 2026-09-20

Status: **implemented; 11O/11A/11R/11M not this slice**. Coordinator `codex-direct`. PLAN [AI-11](AI-11-PLAN.md) SHA-256 `134627CF6136025BB0E1C76A3FD91F8405803E4D2F0F52394EDC1B42A42F5756`.

## Passed

- Named fault helpers: 14/14 pure faults including idempotent replay → one shadow debit.
- Docs unit: `npm run test:db:11f` **4/4**.
- Disposable matrix on `root@ipbx.krasterisk.ru`: MySQL+Redis TAP **3/3**, PostgreSQL+Redis TAP **3/3**, `FAIL=0`. Evidence: [REMOTE-MATRIX](evidence/11f/REMOTE-MATRIX.md). Live: Redis unreachable keeps SQL job; kill-after-enqueue mark-once; duplicate delivery CAS; Redis restart rehydrate from undelivered outbox. Matrix JSON `productSlaClaimed: false`, `shadowDebitOnly: true`.

## Deviations / not this slice

- 11O ops drills (I2/I3 wrap), 11A/11R LIVE-UAT, 11M release matrix.
- Packet jitter/loss lab and `liveMcp=true` not claimed.
- No `productRuntime` flip, no live tenant debit, no autodial/`xray-ui`.
