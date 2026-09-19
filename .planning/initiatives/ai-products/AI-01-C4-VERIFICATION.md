# AI-01-C4 verification — 2026-09-19

Status: **C4 gates closed**. Product runtime remains `not-installed`. AI-00 live Asterisk spike and BOX license-import UI are outside this slice. No production DB/PBX. No local Docker.

## Passed

- Isolated OSS/composition trees: analytics 51, robot 51, community 636 files. [OSS-TREE](evidence/c4/OSS-TREE.md).
- `npm run lint`: 0 errors (existing warnings).
- Backend Jest: public-robot HTTP 401/200 on unchanged `/api/public/voice-robots`, plus a live **curl** client (async, same URL, `x-api-key`) 401 without a key / 200 with the key.
- Frontend full suite: **253 files / 1404 tests passed**, including `ConferenceRoomFormModal` locale rename-guard (`empty: "Нет встреч"` / `"No meetings"`). Windows hang at `RUN` with zero files is gone (`pool: forks`, `maxWorkers: 1`, `fileParallelism: false`).
- Remote MySQL 8.4.11 and PostgreSQL 17.11 analytics+robot boots: identity/capabilities, tenant A/B list 200, unentitled create 403, **CLOUD entitled create 201 secret-once** (replay `token: null`), tenant B stays 403, platform admin 403, PBX/public-robot/dialplan routes 404. [REMOTE-MATRIX](evidence/c4/REMOTE-MATRIX.md).
- Browser vs live disposable analytics API (SSH tunnel to KEEP_ALIVE MySQL boot): standalone `/analytics.html` login as `ci-tenant-a` → session for tenant 2, API online, runtime not installed. Hub landings `/speech-analytics` and `/ai-robots` at **1440 and 360** px. Connections copy states the secret is shown once; minting is proven on the live CLOUD 201 cell (Hub connections remain license-gated when hub-catalog is absent from the analytics composition). Boot logs: [REMOTE-MATRIX](evidence/c4/REMOTE-MATRIX.md).

## Still not this product

- AI product runtime package is not installed (`productRuntime: not-installed`, `usable: false` even when entitled).
- BOX/BYOK offline license import UI.
- Full AppModule/community-pbx live CURL (community dist pulls native ML/ONNX). v3 URLs and fail-closed key are covered by the HTTP+curl spec against the real controller/guard.

Rollback remains: drop new Hub descriptors/entrypoints; keep full-pbx data. Minimal installs must not fall back to `AppModule`.
