# AI-11 11R — robots LIVE-UAT / pilot

LIVE-UAT artifact for robots-only. **Not a product SLA.** Wraps AI-10 10R onboarding. Default env stays `productRuntime: not-installed`. `cloud_wallet` off. No analytics entitlement. No live Adaptive DSN overwrite. No autodial / `xray-ui`.

## Commands

```bash
# Offline unit (no Docker)
npm run test:db:11r

# Disposable MySQL / PostgreSQL on ipbx only
node harness/database/run-11r-uat.cjs mysql
node harness/database/run-11r-uat.cjs postgres
```

Remote pack: `node harness/database/pack-11r-uat.cjs` then `bash /tmp/run-11r-ipbx.sh` on `root@ipbx.krasterisk.ru`.

## LIVE-UAT walk

1. I1 `robot-api` clean-install (no `cdr`)
2. Provider → publish → browser_test → SIP UDP draft
3. SIP TLS → `disabled` / `sip_profile_unsupported`
4. `evaluateSipProfile({ nativePbx: true, i4Evidence: false })` → `native_pbx_gated` (host module load **not** claimed)
5. Drain → `admissions_stopped`; new admit 409
6. Tenant B isolation; analytics routes 404
7. Eval report with remaining gates: host unixODBC/module, TLS/SRTP/NAT, `liveMcp=true`

## Constraints

- Native PBX CDR/`queue_log` remains gated without host unixODBC evidence.
- TLS/SRTP/NAT and `liveMcp=true` are **not** closed by this slice.
- 11M release matrix is separate.
