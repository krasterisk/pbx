# Гибридная разработка Krasterisk: порядок управления

Версия: **1.0**, 2026-09-18. Порядок принят по запросу пользователя. Общий протокол устанавливается в `C:/Users/Professional/.codex/AGENTS.md`; переносимый исходник — [HYBRID-GLOBAL-AGENTS](workflows/HYBRID-GLOBAL-AGENTS.md). Этот файл задаёт конкретные пути и процедуры Krasterisk.

## 1. Режим и вход в работу

Default — **`codex-direct`**. Один координатор управляет назначенным PLAN; GSD используется как формат артефактов и набор явно выбранных процедур. `gsd-workflow` — альтернативный режим с передачей управления.

Обязательный порядок чтения:

1. Текущее поручение пользователя и [AGENTS.md](../AGENTS.md).
2. [CANONICAL_REFS](CANONICAL_REFS.md), обе канонические архитектуры и этот документ.
3. [EXECUTION-REGISTRY](EXECUTION-REGISTRY.md): инициатива и её актуальный EXECUTION.
4. EXECUTION, назначенный PLAN и перечисленные в нём SPEC/ADR/fixtures.
5. Исторические GSD STATE/ROADMAP/UAT — для зависимостей и проверки контекста; они не назначают вторую задачу поверх текущего поручения.

Вопрос пользователя или изменение инструкции не запускает автоматически следующий implementation plan. При запросе «продолжить» восстанавливать незавершённое назначение. При разрешённом поэтапном исполнении координатор может брать следующий готовый план без отдельного подтверждения каждой обычной задачи.

## 2. Канонические источники

| Информация | Источник | Кто меняет |
|---|---|---|
| Архитектурные ограничения | AGENTS + CANONICAL_REFS + назначенные SPEC/ADR | Координатор/назначенный автор |
| Последовательность результатов | ROADMAP инициативы | Координатор |
| Режим, владелец, PLAN, задания, next action | EXECUTION инициативы | Координатор; преемник после handoff |
| Указатели инициатив | EXECUTION-REGISTRY | Координатор своей строки |
| Конкретная работа | Один назначенный PLAN + task IDs | Координатор назначает; исполнитель следует |
| Факт реализации и проверки | SUMMARY/VERIFICATION + команды/логи/diff | Исполнитель готовит; координатор принимает |

Root `.planning/STATE.md` сохраняет назначение существующего GSD workstream. EXECUTION не копирует все его статусы, а хранит mode/ownership/указатели/назначения. При переходе в GSD-workflow записать mapping local phase→runner phase и каноническое местоположение PLAN. Не оставлять два одновременно редактируемых PLAN для одного scope.

## 3. Назначение исполнителю

Шаблон для делегирования или собственного implementation slice. Наличие шаблона не даёт разрешения запускать субагентов.

```text
Assignment ID:
Coordinator identity / task:
Mode: codex-direct | gsd-workflow
Initiative / goal / expected result:
Canonical PLAN path + git revision or content SHA-256:
Task IDs:
Required reads / ADR / SPEC:
Baseline branch / HEAD / relevant dirty files:
Owned paths (exact files/directories):
Shared interfaces owner:
Read-only / excluded paths:
Dependencies and ready evidence:
Required checks / acceptance:
Expected result artifact:
Stop/escalation condition for conflicting ownership:
```

Исполнитель не ищет следующую фазу и не запускает gsd-next/autonomous/execute-manager для расширения scope. Shared DTO/schema меняются через назначенного владельца. Результат содержит файлы/diff, tests/evidence, deviations и pending; завершение задания не означает завершения инициативы.

## 4. Параллельная работа

- Одна область записи — один владелец: особенно migrations, AppModule, registries, shared DTO, manifests/lockfile, локали и routing.
- Параллельны только назначенные независимые задачи с выполненными зависимостями. Worktrees уменьшают file collisions, но не устраняют конфликт контрактов.
- Production/autodial и другие задачи не присваиваются новой инициативой. Проверять diff и, если доступно, статус задач; отсутствие записи в реестре не означает свободные файлы.
- При конфликте останавливаются пересекающиеся изменения. До согласования ownership продолжать независимые задачи/read-only исследование.
- Не commit/stash/reset чужой diff. Перед worktree проверить нужные изменения, ещё не попавшие в HEAD.
- Markdown registry не является атомарным lock. Несколько независимых одновременно запускаемых orchestration processes требуют отдельного проверенного механизма назначения/блокировки либо последовательного запуска. Этот протокол не заявляет реализацию такого механизма.

## 5. Переход Codex ↔ GSD

1. Проверить явный запрос на GSD либо назначенный handoff. Чтение skill само по себе не меняет режим.
2. Прекратить назначение новых writers этого scope; дождаться завершения либо подтверждённой остановки текущих и сохранения работы.
3. Записать в EXECUTION `handoff`, PLAN/ревизию, baseline/diff, checks, pending, next action и принимающего координатора/режим.
4. Для GSD проверить runner/version, команды и mapping phase ID. AI-00/DB-01 нельзя подставлять в numeric runner без проверки. GSD config не определяет Codex model и не блокирует другую задачу.
5. Принимающий координатор сверяет состояние/diff и подтверждает приём записью identity/mode/assignment. Старый владелец больше не назначает работу этому scope. До подтверждения — handoff pending, не активное второе исполнение.

Управляющие GSD skills применяются явно в выбранном режиме. Предметные skills (UI/API docs/eval) могут использоваться внутри задания без управления всем roadmap. Если skill создаёт orchestrator или расширяет scope, сначала ограничить назначение либо провести handoff. Явный запрос пользователя на skill имеет приоритет над default mode.

## 6. Возобновление и приёмка

После смены модели/контекста/задачи: прочитать EXECUTION/handoff, сверить branch/diff/writers, продолжить next action. Timestamp не освобождает ownership. Coordinator identity — идентификатор задачи/сессии, не название модели.

Состояние координации: `idle → active → handoff | waiting → active | idle`. Implementation/tests/live/release статусы ведутся отдельно. Ожидание стенда не означает complete; unit tests не закрывают live gate. Not-applicable gate требует обоснования.

Сохраняются обязательные проверки проекта: `npm run lint`, `npm run test:backend`, `npm run test:frontend`. Добавляются проверки PLAN: реальные две СУБД, live Asterisk и т. п. Записывать, что запускалось сейчас, что является историческим baseline. Review не называть независимым без другого reviewer.

При завершении assignment: сопоставить diff с requirements, сохранить SUMMARY/VERIFICATION, снять своё назначение либо передать его; обновлять только собственный scope. Markdown-файл сам по себе не закрывает коммерческий/live/release gate.

## 7. Текущая привязка AI-продуктов

- Mode: `codex-direct`.
- Состояние/следующий план: [ai-products/EXECUTION](initiatives/ai-products/EXECUTION.md).
- Master: [ai-products/ROADMAP](initiatives/ai-products/ROADMAP.md).
- Продуктовые правила/модели: [DELIVERY-WORKFLOW](initiatives/ai-products/DELIVERY-WORKFLOW.md).
- Следующий кандидат — DB-01; независимые AI-00 fixtures могут назначаться параллельно при разрешённом делегировании. Next candidate не равен claim активной реализации.

## Применение и границы

Глобальный Codex AGENTS загружается при начале сессии; project AGENTS добавляет локальные правила. Для гарантированной загрузки нового глобального файла использовать новую сессию; работающим задачам явно перечитать его перед следующим назначением. `.codex/AGENTS.md` не является глобальной настройкой Cursor/Claude Code: там нужен собственный entry point либо ссылка из project instructions. [Official OpenAI documentation](https://learn.chatgpt.com/docs/agent-configuration/agents-md).

Политика skills `allow_implicit_invocation: false` может запретить неявный выбор конкретного skill, но не ручной запуск или второе приложение. В рамках установки этого протокола vendor SKILL/YAML и настройки моделей не меняются: explicit-only закреплён в AGENTS, техническая YAML-политика не заявляется настроенной. [Official OpenAI documentation: skills](https://learn.chatgpt.com/docs/build-skills).
