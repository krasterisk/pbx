# C2 current-revision remote matrix

Executed 2026-09-19 on `root@ipbx.krasterisk.ru` with `krasterisk_ipbx_agent`. Local Docker was not used. The existing `xray-ui` container was not modified.

## Narrow fixture

A previous 2026-09-19 auto-review rejected a wide archive of source, `node_modules` and build artifacts. This run transferred only a **115 554-byte** tarball (`krasterisk-c2-narrow.tgz`) into a new `/tmp/krasterisk-c2.4FNNN2`. Contents are listed in [REMOTE-BUNDLE-MANIFEST.txt](REMOTE-BUNDLE-MANIFEST.txt): harness scripts, SQL/CJS migrations, and compiled `dist-analytics` / `dist-robot` JavaScript. No TypeScript sources, no `.env`, no credentials, no `node_modules`, no `dist-community`, no frontend.

Runtime packages were installed **on the server** from the npm registry (`npm install --omit=dev`, then `npm install-scripts approve bcrypt ssh2` so native addons could build). That is not a second source export.

## Commands

From `/tmp/krasterisk-c2.4FNNN2`:

```text
node harness/database/run-contracts.cjs mysql
node harness/database/run-contracts.cjs postgres
node harness/database/run-analytics-boot.cjs mysql analytics
node harness/database/run-analytics-boot.cjs postgres analytics
node harness/database/run-analytics-boot.cjs mysql robot
node harness/database/run-analytics-boot.cjs postgres robot
```

## Results

| Check | Result | Log |
|---|---|---|
| MySQL 8.4.11 contracts | 14/14 pass; baseline SHA-256 `8c18e47d…9543d`, 114 tables | [mysql-current.log](mysql-current.log) |
| PostgreSQL 17.11 contracts | 14/14 pass; baseline SHA-256 `a7d418f5…1720f`, 123 tables | [postgres-current.log](postgres-current.log) |
| analytics HTTP boot MySQL | health 200; login 200/401; identity/capabilities 200/401; integrations 200/401; PBX routes 404 | [analytics-boot-mysql-current.log](analytics-boot-mysql-current.log) |
| analytics HTTP boot PostgreSQL | same probes | [analytics-boot-postgres-current.log](analytics-boot-postgres-current.log) |
| robot HTTP boot MySQL | same probes, `robot-api` profile | [robot-boot-mysql-current.log](robot-boot-mysql-current.log) |
| robot HTTP boot PostgreSQL | same probes, `robot-api` profile | [robot-boot-postgres-current.log](robot-boot-postgres-current.log) |

Node v22.23.2, Sequelize 6.37.8. Disposable Testcontainers only.

## Cleanup

`/tmp/krasterisk-c2.4FNNN2` was removed after copying logs. An older leftover `/tmp/krasterisk-c2.oQAAL0` from an earlier C2 attempt was also removed. `docker ps -a --filter label=org.testcontainers=true` was empty afterward. The pre-existing `xray-ui` container remained.

This closes the current-revision SQL/boot remote gate for C2. It does not close AI-01, C4, browser-vs-DB login, or full-PBX legacy route remediation.
