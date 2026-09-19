# C4 current-revision remote matrix

Executed 2026-09-19 on `root@ipbx.krasterisk.ru` with `krasterisk_ipbx_agent`. Local Docker was not used. The existing `xray-ui` container was not modified.

## Narrow fixture

Transferred a **140 803-byte** tarball (`krasterisk-c4-narrow.tgz`) into a new `/tmp/krasterisk-c4.mRZbXv`. Contents: harness CJS, SQL/CJS migrations, compiled `dist-analytics` / `dist-robot`. No TypeScript sources, `.env`, credentials, `node_modules`, `dist-community`, or frontend. Manifest: [MANIFEST.txt](MANIFEST.txt).

Runtime packages were installed on the server (`npm install --omit=dev`, `npm install-scripts approve bcrypt ssh2`). After the first boot attempt, `helmet`, `@nestjs/swagger` and `swagger-ui-express` were added — they are required by the compiled entrypoints and were missing from the stub `package.json`.

## Results

| Check | Result | Log |
|---|---|---|
| MySQL 8.4.11 contracts | 14/14 pass | [logs/mysql-contracts.log](logs/mysql-contracts.log) |
| PostgreSQL 17.11 contracts | 14/14 pass | [logs/postgres-contracts.log](logs/postgres-contracts.log) |
| analytics HTTP boot MySQL | health 200; tenant A/B integrations 200; unentitled create 403; platform admin login 403; PBX/public-robot/dialplan routes 404 | [logs/analytics-boot-mysql.log](logs/analytics-boot-mysql.log) |
| analytics HTTP boot PostgreSQL | same probes | [logs/analytics-boot-postgres.log](logs/analytics-boot-postgres.log) |
| robot HTTP boot MySQL | same probes, `robot-api` | [logs/robot-boot-mysql.log](logs/robot-boot-mysql.log) |
| robot HTTP boot PostgreSQL | same probes, `robot-api` | [logs/robot-boot-postgres.log](logs/robot-boot-postgres.log) |

Node v22.23.2, Sequelize 6.37.8, PostgreSQL 17.11, MySQL 8.4.11. Disposable Testcontainers only.

The tenant matrix on standalone profiles is **deny-closed**: JWT tenants A and B can list their empty principals; neither can mint a key without entitlement; platform admin (`vpbx_user_uid=0`) cannot log in as a product tenant (403). This is not a CLOUD grant/allow live path.

## Cleanup

`/tmp/krasterisk-c4.mRZbXv` was removed after copying logs. Leftover Ryuk containers from the run were removed. `docker ps` afterward showed only the pre-existing `xray-ui`. Local packer temp files were deleted.

This does **not** close AI-01: no browser login against the live disposable API, no v3 public-robot client E2E on full-PBX, no CLOUD entitled-allow cell.
