# A1 remote catalog matrix

Executed 2026-09-18 on the designated `root@ipbx.krasterisk.ru` test host with the existing `krasterisk_ipbx_agent` SSH key. The bundle contained only [catalog-golden.cjs](catalog-golden.cjs), its pinned [package.json](package.json), and the compiled `cloud-admin` directory from the local backend build. No `.env`, production credentials or application DB connection was copied.

`catalog-golden.cjs` used a random password, unique `krasterisk-a1-*` container name and Docker `--rm` with label `org.testcontainers=true`. For each engine it built only `modules_registry` with the real Sequelize model, ran the real `ModulesRegistryService.onApplicationBootstrap()` twice, then asserted:

1. `ai_voice_robots` and `speech_analytics` insert with `is_published=false`;
2. an existing published `voice_robot` is initially published;
3. operator changes to publication survive the second startup;
4. a draft AI code cannot be purchased via `resolvePurchaseOffer`.

Observed output: `PASS mysql: insert/reseed/publication/offer (25 rows)` and `PASS postgres: insert/reseed/publication/offer (25 rows)`. Both exited 0. The script removed each owned container; subsequent name-filtered `docker ps -a` was empty. The exact resolved temp directory `/tmp/krasterisk-a1.GDt2ZL` was deleted. This is a catalog fixture, not a full AppModule/AI runtime test.
