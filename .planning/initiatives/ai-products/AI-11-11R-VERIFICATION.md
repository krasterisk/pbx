# AI-11 11R verification — 2026-09-20

Status: **implemented; 11M not this slice**. Coordinator `codex-direct`. PLAN [AI-11](AI-11-PLAN.md) SHA-256 `134627CF6136025BB0E1C76A3FD91F8405803E4D2F0F52394EDC1B42A42F5756`.

## Passed

- Robots eval helpers: SIP/drain/`native_pbx_gated`, remaining gates named.
- Docs unit: `npm run test:db:11r` **3/3**.
- Disposable matrix on `root@ipbx.krasterisk.ru`: MySQL TAP **2/2**, PostgreSQL TAP **2/2**, `FAIL=0`. Evidence: [REMOTE-MATRIX](evidence/11r/REMOTE-MATRIX.md). Drain stops admissions; TLS unsupported stays disabled; host module load not claimed.

## Deviations / not this slice

- 11M CI/UAT release matrix.
- Host unixODBC / Asterisk module load, TLS/SRTP/NAT certification, `liveMcp=true` remain named open.
- No `productRuntime` flip, no live tenant debit, no autodial/`xray-ui`.
