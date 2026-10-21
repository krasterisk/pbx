# AI-11 11L — load profile

Published measurement profile for disposable admission load. **Not a product SLA.** Ladder **1→5→20** concurrent admits records latency/error/queue depth. Default env stays `productRuntime: not-installed`. `cloud_wallet` off. No live tenant debit. No autodial / `xray-ui`.

## Commands

```bash
# Offline unit (no Docker)
npm run test:db:11l

# Disposable MySQL / PostgreSQL on ipbx only
node harness/database/run-11l-load.cjs mysql
node harness/database/run-11l-load.cjs postgres
```

Remote pack: `node harness/database/pack-11l-load.cjs` then `bash /tmp/run-11l-ipbx.sh` on `root@ipbx.krasterisk.ru`.

## What is measured

| Step | Expectation |
|---|---|
| I1 `analytics-api` clean-install | schema current; `ai_jobs` present; no `cdr` |
| Admission ladder 1→5→20 | all admits under default caps (`runningCap` 8 / `queueCap` 32); p50/p95 logged |
| Media vs batch | batch queue filled to cap → `fairness_exhausted`; separate media store still admits |
| Quota fail-closed | overflow admit → `fairness_exhausted` |

Profile JSON is written to `evidence/11l/profile-{mysql|postgres}.json` with `productSlaClaimed: false`.

## Constraints

- Local Docker is not used for acceptance.
- Host unixODBC / Asterisk module load is not this slice (11R native).
- 11F fault injection and 11O ops drills are separate assignments.
