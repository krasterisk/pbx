# DB-04 I4 — PBX ODBC installer

Status: **implemented locally + disposable dual-DB evidence** on 2026-09-20 under [DB-04](DB-04-PLAN.md) I4. Coordinator `codex-direct`. Runbook: [DB-04-I4-ODBC](DB-04-I4-ODBC.md).

`odbc-installer.cjs` generates unixODBC DSN, `res_odbc.conf`, `cdr_adaptive_odbc.conf`, optional `cel_odbc.conf`, and `extconfig.conf` from a gitignored operator credentials file. The Asterisk ODBC user must differ from the application DB user. `--apply-live`, `--from-live`, and paths under `/etc/asterisk` or `/etc/odbc.ini` are refused. Disposable apply on ipbx writes CDR/`queue_log`/CEL as role `asterisk_i4` through the portable writer; replay stays unique; the host Adaptive ODBC DSN is not read or replaced. Analytics-only and robots-only standalone installs do not wait for I4. Host unixODBC/Asterisk module load is not claimed. AI-11 is not assigned.
