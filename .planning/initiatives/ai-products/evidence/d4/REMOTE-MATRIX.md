# D4 current-revision remote matrix

Executed 2026-09-19 on `root@ipbx.krasterisk.ru` with `krasterisk_ipbx_agent`. Local Docker was not used. The existing `xray-ui` container was not modified. Optional PBX `RedisModule` was not loaded. Live wallet was not charged.

Transferred `krasterisk-d6-foundation.tgz` (91 830 bytes, SHA-256 `f0a978890042bb526ee470b6521e16cd7f4439c7525d3880a1e45375e3659927`) which also carries D4 harness files. Directory `/tmp/krasterisk-d46.work` (removed). Disposable MySQL/PostgreSQL only.

| Check | Result | Log |
|---|---|---|
| MySQL 8.4.11 | **4/4** pass: quota CAS one winner + separate metrics; owner/parent CHECKs + unique owner keys; fake-zero BYOK rejected; unique events/ledger; no wallet table; wrong-tenant job FK fails | [REMOTE-SESSION.log](REMOTE-SESSION.log) (`EXIT mysql-d4 0`) |
| PostgreSQL 17.11 | **4/4** pass; same cells | [REMOTE-SESSION.log](REMOTE-SESSION.log) (`EXIT postgres-d4 0`) |

Node v22.23.2, Sequelize 6.37.8. Disposable Testcontainers only. Per-cell `logs/*.log` were captured in the SSH session transcript after a later cleanup removed `/tmp/krasterisk-d46.work`.

## Cleanup

Remote `/tmp/krasterisk-d46.work` and `/tmp/krasterisk-d6-foundation.tgz` removed. `docker ps` afterward showed only the pre-existing `xray-ui`.
