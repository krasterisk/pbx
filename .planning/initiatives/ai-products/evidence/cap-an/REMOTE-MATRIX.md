# Live SQL matrix — AI-03 CAP1 / AI-04 AN1–AN4

Executed 2026-09-19 on `root@ipbx.krasterisk.ru` with `krasterisk_ipbx_agent`. Local Docker was not used. The existing `xray-ui` container was not modified. Optional PBX `RedisModule` was not loaded. No live wallet charge. Production PBX dialplan was not rewritten. Native MixMonitor on the live PBX was not executed.

Transferred `krasterisk-cap-an.tgz` (97 466 bytes, SHA-256 `908700b678efc6bda667cb564e39ec5cb1d00a974e953561c8071c62eeb4072d`). Directory `/tmp/krasterisk-cap-an.work` (removed). Disposable MySQL 8.4.11 and PostgreSQL 17.11.

| Case | Engine | Script | Result | Log |
|---|---|---|---|---|
| Capture uniqueness / foreign asset | MySQL 8.4.11 | `run-cap1-capture.cjs mysql` | **2/2** pass (`EXIT mysql-cap1 0`) | [mysql-cap1.log](mysql-cap1.log) |
| Capture uniqueness / foreign asset | PostgreSQL 17.11 | `run-cap1-capture.cjs postgres` | **2/2** pass (`EXIT postgres-cap1 0`) | [postgres-cap1.log](postgres-cap1.log) |
| Projects, business key, run uniqueness, HTTPS webhook | MySQL 8.4.11 | `run-an-analytics.cjs mysql` (profile `analytics-api`) | **3/3** pass (`EXIT mysql-an 0`) | [mysql-an.log](mysql-an.log) |
| Projects, business key, run uniqueness, HTTPS webhook | PostgreSQL 17.11 | `run-an-analytics.cjs postgres` (profile `analytics-api`) | **3/3** pass (`EXIT postgres-an 0`) | [postgres-an.log](postgres-an.log) |

Pack: `node harness/database/pack-cap-an.cjs`. Remote: `bash harness/database/run-cap-an-remote.sh`. `FAIL=0`. Session: [REMOTE-SESSION.log](REMOTE-SESSION.log).

Node v22.23.2, Sequelize 6.37.8. After cleanup `docker ps` showed only pre-existing `xray-ui`.
