# AI-11 11F — fault injection

Named fault matrix over outbox/jobs/admission. **Not a product SLA.** Default env stays `productRuntime: not-installed`. Shadow debit path only: idempotent replay → **zero second debit**. `cloud_wallet` off. No live tenant debit. No autodial / `xray-ui`.

## Commands

```bash
# Offline unit (no Docker)
npm run test:db:11f

# Disposable MySQL / PostgreSQL + Redis on ipbx only
node harness/database/run-11f-fault.cjs mysql
node harness/database/run-11f-fault.cjs postgres
```

Remote pack: `node harness/database/pack-11f-fault.cjs` then `bash /tmp/run-11f-ipbx.sh` on `root@ipbx.krasterisk.ru`.

## Named faults

| Fault | Expectation |
|---|---|
| API crash before/after commit | rollback empty / job kept |
| Worker restart ordinal | same ordinal; new call increments |
| Redis enqueue failure | admitted job kept undelivered |
| Duplicate outbox delivery | first apply, second skip |
| Stale fence / CAS claim | reject stale; one winner |
| Forged queue tenant | fail-closed |
| Provider rate-limit | transient; DLQ after 3 |
| Long tool timeout | provider `unknown` (no blind second dispatch) |
| Clock/timezone lease | leaseUntil absolute UTC |
| Storage unavailable | fail-closed `storage_unavailable` |
| Idempotent replay | one shadow debit only |
| DB deadlock stub | retry then succeed |

Live disposable layer also covers Redis unreachable job kept, kill-after-enqueue mark-once, duplicate delivery CAS, Redis restart rehydrate.

## Constraints

- Local Docker is not used for acceptance.
- Wraps AI-02 D2 contracts; does not rewrite production Redis/DSN.
- 11O ops drills and 11A/11R LIVE-UAT are separate assignments.
