# AI-11 11M — CI/UAT release matrix

Aggregated DEP/DBR profile × engine matrix. **Not a product SLA.** Does **not** declare commercial readiness. Default env stays `productRuntime: not-installed`. Pending gates are **named open** (no silent mock pass). No autodial / `xray-ui`. No live tenant debit.

## Profiles × engines

| ID | Profile | Evidence | Engines |
|---|---|---|---|
| DEP-01 | community-core | composition gate | MySQL 8.4.11 / PG 17.11 |
| DEP-02 | SaaS two-tenant | [11a](evidence/11a/REMOTE-MATRIX.md) | both |
| DEP-03 | analytics-only | [11a](evidence/11a/REMOTE-MATRIX.md) | both |
| DEP-04 | robots-only | [11r](evidence/11r/REMOTE-MATRIX.md) | both |
| DEP-05 | offline license | [11o](evidence/11o/REMOTE-MATRIX.md) | both |
| DEP-06 | no undeclared egress | policy (CI shadow) | both |
| DEP-07 | ops drills | [11o](evidence/11o/REMOTE-MATRIX.md) | both |
| DEP-08 | version-skew policy | documented N-1→current; no cross-engine | both |
| DBR-06 | ledger concurrency | [11f](evidence/11f/REMOTE-MATRIX.md) | both |
| DBR-07 | cross-engine refuse | [11o](evidence/11o/REMOTE-MATRIX.md) | both |
| DBR-08 | outbox concurrency | [11f](evidence/11f/REMOTE-MATRIX.md) | both |

Disposable installs in this slice re-confirm `analytics-api` and `robot-api` reach current schema on both engines.

## Named pending (open)

- Host unixODBC / Asterisk module load | **PASS** (verified Running on ipbx; live DSN untouched)
- Lab TLS signalling (`127.0.0.1:15061`) | **PASS** (followup-fe-tls-pilot); SRTP media + NAT still open
- MET5 30-call dual-human holdout
- Real local-AI STT hardware
- Full NAT / SRTP media certification (beyond loopback signalling)
- `liveMcp=true`
- Full frontend vitest suite | **PASS** via chunked Windows runner (`vitest-run-src.cjs`)
- Commercial launch declaration (pilot opt-in only; default `not-installed`)

## Version-skew policy (DEP-08)

Supported: empty→current (I1), N-1→current (I3/11O). Refused: automatic `--rollback`; cross-engine restore (DBR-07). Engines for this matrix: MySQL **8.4.11** and PostgreSQL **17.11**.

## Commands

```bash
npm run test:db:11m
node harness/database/run-11m-matrix.cjs mysql
node harness/database/run-11m-matrix.cjs postgres
```

Remote: `node harness/database/pack-11m-matrix.cjs` then `bash /tmp/run-11m-ipbx.sh` on `root@ipbx.krasterisk.ru`.
