# C4 current-revision remote matrix

Executed 2026-09-19 on `root@ipbx.krasterisk.ru` with `krasterisk_ipbx_agent`. Local Docker was not used. The existing `xray-ui` container was not modified.

## Narrow fixture

Transferred a **143 617-byte** tarball (`krasterisk-c4-narrow.tgz`) into a new `/tmp/krasterisk-c4b.OI1NDT`. Contents: harness CJS (including `entitle-cloud-product.cjs`), SQL/CJS migrations, compiled `dist-analytics` / `dist-robot`. No TypeScript sources, `.env`, credentials, `node_modules`, `dist-community`, or frontend.

Runtime packages were installed on the server (`npm install --omit=dev`, `npm install-scripts approve bcrypt ssh2`). Fixture `package.json` already included `helmet`, `@nestjs/swagger` and `swagger-ui-express`.

## Results

| Check | Result | Log |
|---|---|---|
| analytics HTTP boot MySQL | health 200; unentitled create 403; **CLOUD entitled create 201 secret-once**; tenant B 403; platform admin 403; PBX routes 404 | [analytics-boot-mysql.log](analytics-boot-mysql.log) |
| analytics HTTP boot PostgreSQL | same probes | [analytics-boot-postgres.log](analytics-boot-postgres.log) |
| robot HTTP boot MySQL | same probes, `robot-api` | [robot-boot-mysql.log](robot-boot-mysql.log) |
| robot HTTP boot PostgreSQL | same probes, `robot-api` | [robot-boot-postgres.log](robot-boot-postgres.log) |
| KEEP_ALIVE analytics MySQL | used for browser login via SSH tunnel `5011→36951` | keep-alive.log (gitignored; contains a disposable password) |

Node v22.23.2, Sequelize 6.37.8, PostgreSQL 17.11, MySQL 8.4.11. Disposable Testcontainers only.

CLOUD entitle writes `tenant_modules` (status `active`) and `ai_product_activation` (`enabled`) for `ci-tenant-a` after the deny cell. Idempotent create replay returns `token: null`.

## Cleanup

Process `327507` was signaled; leftover Testcontainers were removed. `/tmp/krasterisk-c4b.OI1NDT` was deleted. `docker ps` afterward showed only the pre-existing `xray-ui`.
