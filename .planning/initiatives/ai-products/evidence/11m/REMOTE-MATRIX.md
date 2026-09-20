# Live 11M release matrix

Executed 2026-09-20 on `root@ipbx.krasterisk.ru` with `krasterisk_ipbx_agent`. Local Docker was not used. The existing `xray-ui` container was not modified. No production database, no productRuntime flip, no commercial readiness claim, no live wallet charge, no autodial.

Pack `krasterisk-11m-matrix.tgz` (104 340 bytes, SHA-256 `295fb48b67fcc0d63b68a96d5cd6dd57a01e0340aab3a7c031116ca8fce35a32`). Remote directory `/tmp/krasterisk-11m.ZJ3qrX` (removed after log copy). Disposable MySQL **8.4.11** and PostgreSQL **17.11**. Matrix JSON `productSlaClaimed: false`, `commercialReadinessDeclared: false`, pending gates named open.

| Case | Engine | Script | Result | Log / matrix |
|---|---|---|---|---|
| Aggregate DEP/DBR evidence + install `analytics-api` + `robot-api` to current schema | MySQL 8.4.11 | `run-11m-matrix.cjs mysql` | TAP **3/3** pass (`EXIT mysql-11m 0`) | [mysql-11m.log](mysql-11m.log), [matrix-mysql.json](matrix-mysql.json) |
| same | PostgreSQL 17.11 | `run-11m-matrix.cjs postgres` | TAP **3/3** pass (`EXIT postgres-11m 0`) | [postgres-11m.log](postgres-11m.log), [matrix-postgres.json](matrix-postgres.json) |

`FAIL=0`. Prior slice REMOTE-MATRIX present for 11L/11F/11O/11A/11R. Pending: MET5, local-AI hardware, host ODBC/module, TLS/SRTP/NAT, `liveMcp`, productRuntime still `not-installed`, commercial readiness not declared.
