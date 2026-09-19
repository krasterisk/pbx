# AI-01-C4 verification — 2026-09-19

Status: **partial**. C4 gates below ran under [AI-01-C](AI-01-C-COMPOSITION-UI-PLAN.md). AI-01 is not closed. No production DB/PBX. No local Docker.

## Passed

- Isolated OSS/composition trees: analytics 51, robot 51, community 636 files. Commercial `ai-agents` absent from community; PBX modules absent from analytics/robot. [OSS-TREE](evidence/c4/OSS-TREE.md).
- `npm run lint`: 0 errors (existing warnings). [lint.log](evidence/c4/lint.log) is gitignored.
- Backend Jest: 282 passed / 1 skipped suites, 3020 passed / 11 skipped tests, including public-robot HTTP 401/200 on unchanged `/api/public/voice-robots`.
- Frontend targeted: 13 files / 65 tests (landing, connections, agents, Hub/modules, standalone shell). Full frontend suite hung after `RUN` with no files (same pre-existing stall); `ConferenceRoomFormModal` locale assertion remains a known failure and was not re-run to completion.
- Remote MySQL 8.4.11 and PostgreSQL 17.11 contracts 14/14. Analytics and robot boots on both engines: identity/capabilities, tenant A/B integration list 200, unentitled create 403, platform admin 403, missing PBX/public-robot/dialplan routes 404. [REMOTE-MATRIX](evidence/c4/REMOTE-MATRIX.md).

## Open (blocks C4/AI-01 closure)

- Browser login vs live disposable DB (360/1440 Hub landing, secret-once dialog).
- Live v3 client against full-PBX `VoiceRobotsPublicController` (unit/HTTP tests keep the URL and require a key; no Asterisk CURL client was driven).
- SaaS CLOUD entitled-allow × integration-key success cell (current live matrix is fail-closed without a license).
- Frontend full suite completion (hang) and BOX/BYOK offline license import UI.

Rollback remains: drop new Hub descriptors/entrypoints; keep full-pbx data. Minimal installs must not fall back to `AppModule`.
