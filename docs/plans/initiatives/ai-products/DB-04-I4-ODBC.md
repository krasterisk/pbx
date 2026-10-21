# DB-04 I4 — PBX ODBC installer

Generates unixODBC DSN, `res_odbc.conf`, `cdr_adaptive_odbc.conf`, optional `cel_odbc.conf`, and `extconfig.conf` from an operator credentials file. SQL writer ownership stays `asterisk-odbc-writer.cjs`. This does **not** dump or overwrite the live Adaptive ODBC DSN on the test host.

**Analytics-only and robots-only standalone installs do not wait for I4.** Native PBX CDR/`queue_log` claims do.

## Credentials

Copy `packages/backend/src/modules/asterisk-odbc/examples/asterisk-odbc.credentials.example.json` to a gitignored `asterisk-odbc.credentials.json`. The Asterisk ODBC user **must** differ from the application DB user. Do not paste live DSN passwords into the repo.

```sh
node harness/database/odbc-installer.cjs \
  --generate /tmp/krasterisk-i4-asterisk \
  --credentials /path/asterisk-odbc.credentials.json
```

`--apply-live` and `--from-live` are refused. Output under `/etc/asterisk` or `/etc/odbc.ini` is refused.

## Disposable apply

On `root@ipbx.krasterisk.ru` only (no local Docker): create a disposable full-pbx schema, create a dedicated Asterisk writer role, generate configs into a temp directory, and insert CDR/`queue_log`/CEL rows with the portable writer as that role. Replay is unique. The host Adaptive ODBC DSN is not read or replaced. `xray-ui` is not modified. Host unixODBC driver load and Asterisk module reload are not this installer.

```sh
node harness/database/pack-d1-contracts.cjs
# scp archive + run-i4-ipbx.sh, then:
node harness/database/run-i4-odbc.cjs mysql
node harness/database/run-i4-odbc.cjs postgres
```

Generated configs keep `alias uniqueid => uniqueid`, `linkedid`, `recordingfile => record`, and `queue_log => odbc,asterisk,queue_log`.

2026-09-20 evidence: MySQL TAP **2/2** + PostgreSQL TAP **2/2**, `FAIL=0`. [REMOTE-MATRIX](evidence/i4/REMOTE-MATRIX.md).
