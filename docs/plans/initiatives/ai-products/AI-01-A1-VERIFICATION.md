# AI-01-A / A1 — verification

Date: 2026-09-18. Branch `main`, HEAD `92d342d1398ad7f6b5839f35f12e168741e00d03`; shared dirty worktree, no commit/reset/stash. Local Docker was not used.

| Gate | Result |
|---|---|
| Targeted policy/guard/catalog/HTTP | Final run: 4 suites / 26 tests passed. Includes tenant UID 0 superadmin denial, missing identity 401, expiry/trial, explicit deny, exact tenant grant partition, BOX/OpenSource, unpublished offer, Hub toggle 409 and superadmin-only maintenance. |
| Backend build | Passed after final controller/module registration. |
| Scoped ESLint | Passed after final changes. Full `npm run lint` passed before the final maintenance route and policy test additions; no errors. |
| Full backend suite | Final run passed: 255 suites / 2926 tests, 1 suite / 11 tests skipped. |
| Full frontend suite | 249 files / 1395 tests passed; one pre-existing `ConferenceRoomFormModal.test.tsx:234` assertion expects single-quoted Russian locale text. A1 changed no frontend/locales. Initial sandbox run could not read Vite config; escalated rerun reached the assertion. |
| Real DB catalog | MySQL 8.4.11 and PostgreSQL 17.11 passed on `root@ipbx.krasterisk.ru` using isolated, disposable containers. Actual compiled `ModulesRegistryService` + Sequelize model tested insert/reseed/operator publication/direct offer denial. [Fixture and run details](evidence/a1/REMOTE-MATRIX.md). |
| Cleanup | Remote `/tmp/krasterisk-a1.GDt2ZL` removed after realpath verification; `docker ps -a --filter name=krasterisk-a1` returned no containers. Local transfer archive removed. |

Limits: A2 signed license/activation store is absent, so access remains denied even with a valid cloud grant. New AI checkout is intentionally unreleased. No real payment, production data, PBX or provider traffic was exercised. The full frontend suite has the previously recorded unrelated conference-locale failure; it is not A1 evidence of a frontend regression.
