# Установка и проверка протокола гибридной разработки

Дата: 2026-09-18. Scope: глобальная инструкция Codex, project entry points и порядок координации. Реализация DB-01/AI-продуктов этим изменением не запускается.

## Установлено

- Global: `C:/Users/Professional/.codex/AGENTS.md` (11514 bytes), создан через CreateNew без перезаписи существующего файла. До установки AGENTS/AGENTS.override отсутствовали, CODEX_HOME не задан; использован стандартный каталог `.codex`.
- Переносимый исходник: [HYBRID-GLOBAL-AGENTS](HYBRID-GLOBAL-AGENTS.md). Source и installed file совпадают по SHA-256: `D6F9724598E3259300954D9838C7E2CB3CC9A28D868C6C2FC245126937205289`.
- Project [AGENTS](../../AGENTS.md) подключает [HYBRID-WORKFLOW](../HYBRID-WORKFLOW.md) и [EXECUTION-REGISTRY](../EXECUTION-REGISTRY.md). Canonical index, README и DELIVERY-WORKFLOW инициативы ссылаются на тот же протокол.
- [AI-products EXECUTION](../initiatives/ai-products/EXECUTION.md): mode codex-direct, coordination idle, next candidate DB-01; ложного active implementation claim нет.
- Root GSD STATE, настройки моделей, vendor skills/YAML и production code не менялись этой работой. Переносимый исходник хранится для повторного применения; при его правке установленную копию обновлять явно с проверкой расхождений, а не считать автоматически синхронизированной.

## Проверка документов

Проверены 8 entry point/protocol документов, 52 относительные ссылки: отсутствующих целей и trailing whitespace нет. Global+project AGENTS суммарно 15290 bytes, меньше default 32 KiB budget; override project_doc_max_bytes в проверенном config.toml не найден. `git diff --check` для AGENTS/CANONICAL_REFS проходит, только LF/CRLF warnings.

Проверка сценариев выполнена автором по тексту правил; это **не независимое ревью и не live тест нескольких агентов**:

| Сценарий | Предписанное поведение |
|---|---|
| Старый GSD STATE предлагает другую фазу | Исполняется текущее назначение пользователя/координатора; старый STATE — контекст |
| Найден управляющий skill в codex-direct | Не запускать неявно; документ не расширяет scope |
| Пользователь явно просит GSD execute | Учесть запрос, сверить ownership, выполнить handoff, использовать один workflow |
| Модель меняется с Astra на Sol | Сохранить identity координатора/PLAN, восстановить state/diff/next action |
| Другой writer затрагивает schema/shared DTO | Остановить пересечение, сверить владельца; продолжить независимую работу |
| Active owner имеет старый timestamp | Не считать автоматически свободным, проверить статус/связь |
| Часть live gates pending | Не объявлять полный success; продолжать независимые задачи |
| Задан вопрос о планах или обновлении инструкций | Не запускать implementation phase только из-за найденного PLAN |
| Требуется параллельная работа | Явные assignments/owned paths; делегирование только при разрешении среды/задачи |

## Обязательные repository checks

Изменены только инструкции и документация. Команды запущены по Verify из project AGENTS на текущем рабочем дереве; результаты относятся к этому snapshot, не к изолированной release-ветке.

| Команда | Результат | Evidence |
|---|---|---|
| npm run lint | Exit 0; 100 backend и 84 frontend warnings, ошибок нет | [lint](evidence/hybrid-lint.log) |
| npm run test:backend | Exit 0; 245 suites passed, 1 skipped; 2857 tests passed, 9 skipped. Есть warning о принудительном завершении worker из-за возможного teardown leak | [backend](evidence/hybrid-test-backend.log) |
| npm run test:frontend | Первый запуск: esbuild Access is denied до тестов. Повтор той же команды с разрешённым расширением среды: exit 1; 245 files passed, 1 failed; 1388 tests passed, 1 failed; 837.37 s | [первый запуск](evidence/hybrid-test-frontend.log), [повтор](evidence/hybrid-test-frontend-retry.log) |

Единственный failed test: `packages/frontend/src/features/conferences/ui/ConferenceRoomFormModal/ConferenceRoomFormModal.test.tsx`, `does not rename conferences.history.empty`, assertion строки RU locale `empty: 'Нет встреч'` (строка 234 на момент чтения). Файл теста уже находится в текущем рабочем diff; ни он, ни locale/application code этой задачей не изменялись. Это незелёный baseline текущей копии, а не закрытый дефект: следующая implementation-задача должна отделить его от собственных регрессий. Внеплановое исправление конференций здесь не выполнялось.

## Практические ограничения

Протокол задаёт обязательные инструкции и ownership, но не является OS lock/распределённым scheduler. Автоматическое поведение другой независимой IDE/process этим не проверено. Неявный вызов GSD запрещён инструкцией; `allow_implicit_invocation` в installed skills не изменён и техническая блокировка не заявляется.

Глобальный файл предназначен для Codex. Project AGENTS передаёт порядок другим агентам, которые читают этот файл; это не установка глобальных правил Cursor/Claude Code. Полная загрузка новой global instruction chain проверяется новой сессией; в текущей сессии текст прочитан при подготовке. [Official OpenAI documentation](https://learn.chatgpt.com/docs/agent-configuration/agents-md).
