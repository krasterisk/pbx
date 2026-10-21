# DB-04 I4 verification — 2026-09-20

Status: **implemented; host Asterisk module load / live Adaptive DSN / AI-11 not this slice**. Coordinator `codex-direct`. PLAN [DB-04](DB-04-PLAN.md) SHA-256 `83F520D6B208EE6177C0ADD77D380DBA1CC01A28BA2B5EECCDAA9345305FF085`.

## Passed

- Offline unit: `node --test harness/database/odbc-installer.test.cjs` **3/3**.
- Disposable matrix on `root@ipbx.krasterisk.ru`: MySQL TAP **2/2**, PostgreSQL TAP **2/2**, `FAIL=0`. Evidence: [REMOTE-MATRIX](evidence/i4/REMOTE-MATRIX.md).
- Generated configs keep `alias uniqueid => uniqueid`, `linkedid`, `recordingfile => record`, and `queue_log => odbc,asterisk,queue_log`. Manifest `analyticsOnlyIndependent: true`, `liveAdaptiveOdbcUntouched: true`.
- Asterisk ODBC user `asterisk_i4` ≠ app DB user. Writer as that role: CDR/`queue_log`/CEL insert then unique replay for golden uniqueid `1760000000.41`. App-user SELECT sees one row each.
- Same-user credentials, `/etc/asterisk`, `/etc/odbc.ini`, `--apply-live`, and `--from-live` refused.
- Analytics-only and robots-only standalone installs do not wait for I4. No production DB, `xray-ui` untouched, no live tenant debit.

## Deviations / not this slice

- Host unixODBC driver install / Asterisk `res_odbc` module load / `module reload` on the test PBX.
- Dump or overwrite of the live Adaptive ODBC DSN.
- Cross-engine data transfer.
- AI-11 release/pilot.
- No `productRuntime` flip, no autodial.
