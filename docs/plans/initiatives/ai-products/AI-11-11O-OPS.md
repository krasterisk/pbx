# AI-11 11O — ops drills

Named AI-11 evidence wrapping DB-04 **I2** restore and **I3** upgrade. **Not a product SLA.** Does not rewrite SQL runner ownership. Automatic `--rollback` is refused; recovery is restore-from-backup or forward repair. Default env stays `productRuntime: not-installed`. No live tenant debit. No autodial / `xray-ui`.

## Drill sequence

1. **Backup** — I2 same-engine pack + `encryption.key` sidecar  
2. **Restore** — onto same-engine schema at current version  
3. **Upgrade** — I3 N-1 → current (analytics-api)  
4. **Schema readiness** — journal current; dirty refuses  
5. **Worker drain** — stop new admissions  
6. **Admit traffic** — only after ready + drained + workers configured  

## Commands

```bash
# Offline unit (no Docker)
npm run test:db:11o

# Disposable MySQL / PostgreSQL on ipbx only
node harness/database/run-11o-ops.cjs mysql
node harness/database/run-11o-ops.cjs postgres
```

Remote pack: `node harness/database/pack-11o-ops.cjs` then `bash /tmp/run-11o-ipbx.sh` on `root@ipbx.krasterisk.ru`.

## Probes

| Probe | Expectation |
|---|---|
| Missing encryption key | `AI_PROVIDER_KEY_UNAVAILABLE` fail-closed |
| Dialect switch | DBR-07 refuse (not a migration) |
| `--rollback` | refused on backup-restore and upgrade |
| Key rotation rehearsal | mint new sidecar; steps documented; `liveProductionRotated: false` |
| Drain before admit | blocked until drained |

## Constraints

- Local Docker is not used for acceptance.
- This is **named AI-11 evidence**, not a re-claim that “I2/I3 already covered it”.
- 11A/11R LIVE-UAT and 11M release matrix are separate assignments.
