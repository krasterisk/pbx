# AI-11 11A — analytics LIVE-UAT / pilot

LIVE-UAT artifact for standalone analytics. **Not a product SLA.** Wraps AI-10 10A onboarding. Default env stays `productRuntime: not-installed`. `cloud_wallet` off. No I4 / AMI / ARI. No live tenant debit. No autodial / `xray-ui`.

## Commands

```bash
# Offline unit (no Docker)
npm run test:db:11a

# Disposable MySQL / PostgreSQL on ipbx only
node harness/database/run-11a-uat.cjs mysql
node harness/database/run-11a-uat.cjs postgres
```

Remote pack: `node harness/database/pack-11a-uat.cjs` then `bash /tmp/run-11a-ipbx.sh` on `root@ipbx.krasterisk.ru`.

## LIVE-UAT walk

1. I1 `analytics-api` clean-install (no `cdr`)
2. Pilot A: project → publish → integration key → upload → analysis-run → result
3. Isolation: tenant B cannot read A's run
4. Pilot B: entitle + own project/upload/run (parallel data)
5. Cross-check: A's key cannot read B's run
6. OpenAPI tags; PBX routes 404
7. Eval report JSON with named remaining gates: `local_ai_stt_not_claimed`, `met5_30_call_holdout_not_claimed`

## Constraints

- Fake STT does **not** close the real local-AI promise.
- Community PBX is not required for 11A alone.
- 11R robots LIVE-UAT and 11M release matrix are separate.
