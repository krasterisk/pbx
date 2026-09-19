# DB-01 — проверки и границы приёмки

Дата: 2026-09-18. Implementation **implemented**, DB-01 automated DB matrix **passed** на выделенном тестовом сервере; [independent review](DB-01-REVIEW.md) **passed**. Coordinator/task: `01a0b2cf-f755-74d0-8a7d-7e65ee34fc65`. PLAN SHA-256 `FF6FAF0304E13ABF79D88A0EDBC44034A3BDE92605FC1237D121EB2696A7FF37`.

## Команды и факты

| Проверка | Результат | Evidence |
|---|---|---|
| `npm run test:db:unit` | PASS: 43 tests, 0 skipped after review fixes; config/CLI/history/error lifecycle plus mysql2/pg effective TLS/password regressions. Original 39-test run remains in saved log; final rerun was independently observed. | [unit-final.log](evidence/db-01/unit-final.log), [review](DB-01-REVIEW.md) |
| `npx tsc --noEmit -p packages/backend/tsconfig.build.json` | PASS, exit 0; повтор после финального изменения AppModule formatting | [typecheck.log](evidence/db-01/typecheck.log) |
| `npm run build -w @krasterisk/shared` и `npm run build -w @krasterisk/backend` | PASS, exit 0; dist/database/database-config.cjs byte-equal source | [build.log](evidence/db-01/build.log) |
| `npm ls pg pg-hstore mysql2 sequelize --depth=1` | PASS: pg 8.23.0, pg-hstore 2.3.4, mysql2 3.20.0, Sequelize 6.37.8 | [dependencies.txt](evidence/db-01/dependencies.txt) |
| `node harness/database/run-contracts.cjs mysql` на `root@ipbx.krasterisk.ru` | PASS: 8 cases + parent = 9 tests; current baseline 114 tables, replay no-op; SHA-256 unchanged | [mysql-remote.log](evidence/db-01/mysql-remote.log) |
| `node harness/database/run-contracts.cjs postgres` на том же сервере | PASS: 7 cases + parent = 8 tests; реальный PostgreSQL 17.11 | [postgres-remote.log](evidence/db-01/postgres-remote.log) |
| `npm run test:db:contracts` на рабочем Windows host, исторический результат до указания пользователя | FAIL/UNAVAILABLE: локальный Docker engine отсутствовал; после нового указания локальный Docker не использовался | [contracts.log](evidence/db-01/contracts.log) |
| `npm run test:db:contracts -- postgres "--postgres-bin=C:\Program Files\PostgreSQL\14\bin"` | PASS: реальный новый PG cluster; 7 cases + parent, 8 passed | [postgres-local.log](evidence/db-01/postgres-local.log) |
| `npm run lint` | PASS: 0 errors; backend 99 warnings / frontend 83 warnings | [lint.log](evidence/db-01/lint.log) |
| `npm run test:backend` | PASS: 248 suites, 2873 tests; 1 suite / 9 tests skipped; 161.299 s | [backend.log](evidence/db-01/backend.log) |
| `npm run test:frontend` | FAIL: 245 files / 1388 tests passed; 1 file / 1 test failed; 678.18 s | [frontend.log](evidence/db-01/frontend.log) |
| Baseline SQL SHA-256 и scoped `git diff --check` | PASS: hash неизменён, SQL diff отсутствует; whitespace errors отсутствуют | [before](evidence/db-01/mysql-baseline-checksum.txt), [after](evidence/db-01/mysql-baseline-checksum-after.txt) |

Node local: 24.19.0; test server/CI: Node 22.23.2 / Node 22. PostgreSQL supplemental local binary: **14.0**, Visual C++ build 1914, 64-bit; этот прогон был до указания использовать тестовый сервер и не запускал Docker. Dedicated test server Docker: 29.7.2. Реальные образы: MySQL 8.4.11 `mysql@sha256:85b9bf2e29cf836ecb8c2a15a935d4ba0c606631dff1dd79531a11983c638f2a`, PostgreSQL 17.11-bookworm `postgres@sha256:051f7b7b3abdd564d5d1bd1e8c4b9c1b6e77087d1dd22020ede611c096a272e0` ([digest evidence](evidence/db-01/remote-image-digests.txt)). CI workflow создан, удалённый CI run не запускался.

## Выделенный тестовый сервер

Пользователь указал `root@ipbx.krasterisk.ru` и ключ `krasterisk_ipbx_agent`; SSH host key уже находился в known_hosts. В `/tmp/krasterisk-db01.v5QajG` передан минимальный bundle (только harness, config, runner/adapters, immutable MySQL baseline и зафиксированные npm dependencies), а не весь рабочий проект или credentials. Установлен локальный к bundle `npm ci --ignore-scripts`; обе команды запускались из этого каталога. Контейнеры и БД создавались с generated passwords/test names, без bind mounts и без использования существующего контейнера. `org.testcontainers=true` после тестов: **0 контейнеров**. Remote logs скопированы в local evidence; временный каталог `/tmp/krasterisk-db01.v5QajG` удалён после проверки результата. Локальная копия transfer bundle и archive также удалена; источник проверок остаётся в `harness/database` и `packages/backend/database`.

Первая MySQL попытка завершилась `PROTOCOL_CONNECTION_LOST`: image сообщил ready до доступности root account. Это зафиксировано в [initial log](evidence/db-01/mysql-remote-initial.log). Harness получил bounded readiness retry (максимум 60 секунд только для fresh fixture), затем MySQL прошёл: 60 попыток подключения; 9/9 tests pass. PostgreSQL после одного подключения прошёл 8/8. В MySQL исходная production baseline создала **114 таблиц**, повторный запуск — no-op, hash `8c18e47d94da3c3aeca3807eb44dbd0280433c1dedf96bef36470203d699543d`. Отдельные failure/checksum/concurrency/dirty-marker проверки прошли для обоих engines.

## Что действительно проверил PostgreSQL

Отдельный `initdb` cluster с generated SCRAM password, random loopback port и новым TEMP data directory; installed service не использовалась. Все семь cases прошли:

1. Read-only status не создаёт таблиц; apply/replay сохраняют journal rows и данные Unicode/JSON/DECIMAL/tenant 0.
2. Реальный Sequelize 6 CRUD с тем же resolver, отдельным tenant и JSON.
3. Изменение checksum, wrong engine и unversioned data отвергаются.
4. Два concurrent runners применяют artifact один раз; второй получает no-op.
5. Timeout bounded; закрытие lock owner без explicit unlock освобождает lock.
6. Mid-file SQL error откатывает PG DDL, не создаёт success journal, сохраняет dirty marker и блокирует restart.
7. Legacy completed journal получает metadata без изменения applied rows/timestamps.

Cleanup успешно завершён; после теста TEMP `krasterisk-db01-pg-*` отсутствуют. Windows helper processes запускались с hidden window. Это supplemental evidence; pinned matrix остаётся обязательной.

## Непройденные / неприменимые gates

| Gate | Состояние | Что закрывает |
|---|---|---|
| Pinned MySQL 8.4.11 contracts + original baseline smoke | **PASSED** на выделенном сервере | 9/9 tests; 114 tables; replay no-op; log/digest сохранены |
| Pinned PostgreSQL 17.11 container contracts | **PASSED** на выделенном сервере | 8/8 tests; log/digest сохранены |
| Independent implementation review | **PASSED**: no open P0/P1/P2 after fixes | [review](DB-01-REVIEW.md): secrets, target selection, immutable history, state adoption, lock lifetime, failure/cleanup, dialect normalization |
| Полностью зелёный repository frontend suite | **BASELINE FAILURE** | Отдельная задача владельца conferences/locales; не DB-01 regression |
| Full PostgreSQL AppModule/schema/auth/query parity | **NOT IN DB-01** | DB-02 slices; текущий production runner явно не готов |
| Live Asterisk/ODBC | **NOT IN DB-01** | DB-03 |

Исторически до уточнения пользователя локальный Docker Desktop был запущен, но engine named pipe отсутствовал; harness вернул ненулевой код. После указания пользователя Docker на этом компьютере не использовался; реальные matrix tests прошли на `root@ipbx.krasterisk.ru`. Зависшая старая диагностика `wsl --status` завершалась адресно; WSL services/config не менялись.

Frontend failure: `src/features/conferences/ui/ConferenceRoomFormModal/ConferenceRoomFormModal.test.tsx:234`, `does not rename conferences.history.empty`, ожидание `empty: 'Нет встреч'` (следующая assertion EN `No meetings`). Такое же падение зафиксировано до DB-01 в [HYBRID-VERIFICATION](../../workflows/HYBRID-VERIFICATION.md). DB-01 не редактировал frontend/locales. Suite запускался с доступом вне sandbox из-за ранее подтверждённого esbuild config access failure.

## Integrity / review notes

- Original SQL SHA-256: `8c18e47d94da3c3aeca3807eb44dbd0280433c1dedf96bef36470203d699543d`; новый engine не меняет старый artifact или journal.
- MySQL state/journal используют InnoDB; native metadata discovery проверяет engine. MySQL lock key сохраняется для прежних допустимых имён, длинные имена используют SHA-256. Основной MySQL path/lock/failure/baseline доказан реальным тестом; long-name lock остаётся unit/design case, не отдельным integration fixture.
- Recovery intentionally fails closed. Автоматического стирания dirty marker, повторного выполнения partial SQL или обещания DDL rollback на MySQL нет.
- Native driver errors не печатают SQL/password; выводится безопасный error code. Resolver import не загружает dotenv/drivers/fs и не логирует.
- PostgreSQL production list/status/apply guard проверен unit на фиктивном unreachable host; нет обходного production fixture flag.
- PostgreSQL migrations используют public и собственную transaction boundary; reviewed artifacts не должны содержать COMMIT/ROLLBACK/nontransactional DDL.
- `.env.example` имел невалидный UTF-8 byte вне DB section; DB section изменён с сохранением исходных байтов остального файла, без перекодирования локальных legacy символов.
- Shared working tree содержит продолжающиеся изменения autodial/ARI/frontend другой задачи. Тесты относятся к состоянию дерева во время запуска, не к изолированному commit. Чужой diff не reset/stash/commit, live databases не затрагивались.
