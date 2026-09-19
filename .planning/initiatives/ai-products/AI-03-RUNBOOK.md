# AI-03 capture runbook

1. Keep `DURABLE_CAPTURE=0` on production. Existing MixMonitor/ffmpeg paths stay in use.
2. Capture SQL is additive (0010). Replay is safe; there is no down migration.
3. Recording-node helper needs `CAPTURE_SPOOL_DIR` and must not import AppModule.
4. Live SQL matrix: pack `harness/database/pack-cap-an.cjs`, copy to `root@ipbx.krasterisk.ru`, run `harness/database/run-cap-an-remote.sh`.
5. Do not retune the existing PBX or delete v3 public-robot URLs.
