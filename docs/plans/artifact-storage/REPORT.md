# Внешнее хранение артефактов — результат

Статус: implemented / local-filesystem-verified. Координатор /root chat01a15cc9, codex-direct; PLAN r4.

Перенесено **79,334 файлов**, **1,289,421,062 байт** (1.201 GiB) в `C:/Users/Professional/Documents/DevArtifacts/krasterisk_v4`. SHA-256 каждого перемещённого файла совпал до и после переноса. В полном каталоге release дополнительно сохранены 28 служебных файлов вложенного Git-репозитория cloudapi: они входят в журнал целого разрешённого каталога, но не в первоначальную file-only инвентаризацию.

Созданы 83 directory junction и 2 398 файловых symlink для совместимости прежних путей. `.artifacts` указывает на внешний корень. Правила закреплены в `.gitignore`, временный дублирующий блок `.git/info/exclude` удалён. Данные по возрасту не удалялись.

Документы `.planning`, исходники, конфигурации и authored fixtures сохранены. В CDR сверены 751 хешей сохранённых входов и сохранены 13 UI/source-snapshot деревьев. Обновлено 189 ссылок/путей в 55 документах; все 167 обновлённых физических целей доступны.

Два активных файла оставлены в checkout без остановки сервисов:

- `.planning/cdr-reports-ux/r7o5-frontend-error.log`
- `.planning/cdr-reports-ux/r7o5-frontend.log`

Они исключены из переноса и из перенаправления входных путей. Для их переноса позже потребуется остановить/перенастроить соответствующий owned frontend процесс; в этой задаче этого не делали.

Общий Node/Python/PowerShell API — `tools/artifacts`. На resolver переведены 145 Node и 102 Python генераторов. Из них 238 legacy-скриптов прошли AST-сравнение с удалением только path wrappers/загрузки helper: прочая структура совпадает. Для пяти переданных CDR генераторов отдельно совпали сеть/SQL/remote/container/source-collection AST. Автономные удалённые копии без helper сохраняют прежние удалённые пути. Сами SQL/SSH/API/call генераторы для проверки не запускались.

Пути Playwright/Vitest/JUnit/aggregate reporters harness направлены во внешний корень и проверены синтетическим локальным прогоном. Обычные `packages/*/dist` и работающие сервисы оставлены как runtime baseline.

## Проверки

- Artifact tests: **9/9 PASS**, включая Node/Python parity, вложенные вызовы, Windows 8.3 TEMP, защиту корня и CDR fixtures.
- Синтаксис всех 247 изменённых генераторов и PowerShell инструментов: PASS.
- Синтетическая интеграция конфигов harness/JUnit merge/reporters: PASS.
- `npm run lint`: PASS (0 errors; существующие warnings).
- `npm run test:backend`: PASS, 4 980 passed / 27 skipped.
- `npm run test:frontend`: FAIL, 2630 passed / 8 failed, 481 passed files / 1 failed file. Все падения — `src/features/callcenter/lib/useWebRTCPhone.consultation.test.tsx`, TypeError `Web.defaultSessionDescriptionHandlerFactory is not a function`. Product files в этой задаче не менялись; дерево имеет независимые изменения CDR.
- Harness TypeScript: 32 ошибки baseline и 32 после; **новых ошибок 0**.
- Проверка изменённых ссылок, доступности документов/fixtures и целостности переносов: PASS.
- `git diff --check` собственных общих файлов: PASS.
- Последняя проверка процессов: Git 0. Нет commit/push/deploy и нет release claim.

## Ранее отсутствовавшие артефакты

Следующие девять целей отсутствовали уже в исходной file-only инвентаризации и не обнаружены в перемещённом каталоге. Их ссылки не подменялись выдуманными данными и оставлены в исходном виде:

- `artifacts/aichat-capabilities.json`
- `artifacts/context-defaults-form.png`
- `artifacts/context-includes-live.json`
- `artifacts/design-refresh-dark.jpg`
- `artifacts/design-refresh-muted-buttons.jpg`
- `artifacts/mobile-routes-r5.png`
- `artifacts/routes-dialplan-tooltip.png`
- `artifacts/routes-mobile-dialplan-info.png`
- `artifacts/selection-toolbar-mobile-r6.png`

## Доказательства и следующее действие

- [Журналы проверок](../../../.artifacts/checks/artifact-storage-20261021/results.json).
- [Каталоги: основной перенос](../../../.artifacts/migration/directory-move-summary.json), [файлы](../../../.artifacts/migration/file-move-summary.json).
- [Каталоги CDR](../../../.artifacts/migration/cdr-directory-move-summary.json), [файлы CDR / активные исключения](../../../.artifacts/migration/cdr-file-move-summary.json).
- [Машинная верификация](../../../.planning/artifact-storage/VERIFICATION.json).
- Правила и API: `tools/artifacts/README.md`.

Миграция хранения завершена в разрешённом scope. Следующие генераторы использовать с `ARTIFACTS_ROOT` и `outputPath/output_path`; результаты держать во внешнем `runs/<initiative>/<run-id>`. Активные логи, девять исторических отсутствующих файлов и продуктовый frontend regression остаются отдельными follow-up, не расширяют владение этой задачи. Владение пятью CDR скриптами возвращается продуктовому координатору после этого handoff.
