# Krasterisk v4 — инструкции для агента

## Проект

- Монорепо: `packages/backend` (NestJS), `packages/frontend` (React FSD), `packages/shared`
- **Архитектура (MUST READ):**
  - `packages/frontend/.idea/ARCHITECTURE.md` (в т.ч. **Optimistic toggles** — Switch с мгновенным PUT через RTK `onQueryStarted` + undo)
  - `packages/backend/.idea/ARCHITECTURE.md`
- Индекс для GSD: `docs/CANONICAL_REFS.md`
- Модули: `.docs/*_MODULE.md` (локально)

## Гибридная разработка: один координатор

- Для многоэтапной работы читать `docs/development/HYBRID-WORKFLOW.md` и `docs/plans/EXECUTION-REGISTRY.md` перед выбором исполняемого плана.
- Default mode — `codex-direct`: один координатор назначает PLAN, задачи, владельцев файлов и проверки; GSD хранит артефакты. `gsd-workflow` — альтернативный режим с явной передачей управления, не вторая параллельная цепочка той же фазы.
- Управляющие GSD workflows не запускать неявно в direct mode. Наличие PLAN, skills или старого STATE не назначает работу. Явный запрос пользователя на skill учитывается с согласованием scope/ownership.
- Исполнитель следует назначенным PLAN/task IDs/owned paths; не выбирает другую фазу и не создаёт собственный orchestrator. Общие migrations/registry/config/DTO имеют одного владельца записи. Делегирование — в пределах разрешений текущей задачи и среды.
- После смены модели/контекста восстановить EXECUTION, baseline, evidence и next action. Смена модели не меняет владельца. Не перезаписывать чужие изменения, общий STATE или чужие назначения.
- AI-продукты: `docs/plans/initiatives/ai-products/EXECUTION.md`; этот scope не присваивает действующие production/autodial задачи.

## GSD Core

Установлен локально: `.cursor/`; фактическую версию проверять в `.cursor/gsd-core/VERSION`. Команды в чате Cursor: `/gsd-*`. Наличие команд не означает автоматический запуск в режиме `codex-direct`.

| Шаг | Команда |
|-----|---------|
| Индекс (после клонирования) | `/gsd-map-codebase` |
| PRD delta MOH | `@.idea/MOH_MODERN_DELTA_PRD.md` |
| Discuss / Plan / Execute / Verify | `/gsd-discuss-phase 1` … `/gsd-verify-work 1` |

Локальная рабочая область GSD: `.planning/` (целиком игнорируется Git); принятые планы и решения — `docs/`. Инструкция: **`GSD_GUIDE.md`**. MOH pipeline: `.docs/GSD_CORE_PIPELINE_MOH.md`.

**Sketch findings:** UI для `/moh` (Phase 2) и Module Hub / shell / marketplace / platform admin (Phase 8) — читать skill `sketch-findings-krasterisk-v4` (`.cursor/skills/sketch-findings-krasterisk-v4/SKILL.md`).

**Spike findings:** телеконференции (Phase 16) — ConfBridge, сетка видео SFU, браузерный клиент, гибрид с SIP-абонентами — читать skill `spike-findings-krasterisk-v4` (`.cursor/skills/spike-findings-krasterisk-v4/SKILL.md`).

## Verify перед «готово»

```bash
npm run lint
npm run test:backend
npm run test:frontend
```

## Хранение документов, инструментов и данных

- Вход в документацию — `docs/CANONICAL_REFS.md`; правила структуры — `docs/development/REPOSITORY-LAYOUT.md`.
- Постоянные требования/архитектура/решения и назначенные PLAN/EXECUTION хранить в `docs/`; текущие инициативы — `docs/plans/`, прежние GSD-фазы — `docs/archive/gsd/`. Не создавать новый документ для каждой команды или неудачной попытки.
- `.planning/` — полностью игнорируемая локальная рабочая область GSD/агентов: черновики, состояние сессий, одноразовые диагностики и приватные данные. Новый clone не должен зависеть от её наличия. Не использовать `git add -f .planning` и не добавлять поимённые исключения/разрешения для её содержимого.
- Поддерживаемые инструменты — `tools/` или `harness/`, с README и явными входами/выходами. Не переносить туда исторические deploy/cleanup/seed/SSH-скрипты автоматически. Изменение структуры не разрешает запуск внешних сценариев.
- Только проверенные синтетические тестовые входы/эталоны — `tests/fixtures/` либо рядом с пакетными тестами. Название `fixture`, `baseline` или `candidate` само по себе не делает файл тестовым входом. Приватный корпус, результаты прогонов и exports не коммитить.
- Новые результаты проверок, сборки, кэши, скриншоты, аудио и архивы писать во внешний `ARTIFACTS_ROOT` через `tools/artifacts/paths.cjs` / `paths.py`, в `runs/<initiative>/<run-id>/`. Сырые результаты не писать в `docs`, `tools`, `harness` или fixtures. Штатные `packages/*/dist` остаются игнорируемым runtime output.
- В итоговом документе сохранять команду, commit/baseline, результат, ограничения и locator внешних доказательств. Исторические manifests/receipts/hashes не переписывать при перемещении; соответствие старых и новых путей хранить отдельно.
- Перед переносом материалов активного владельца согласовать scope; сохранить dirty baseline и данные. При новом запуске GSD выбрать канонический PLAN и согласовать перенос принятых результатов из локальной `.planning`, без второй цепочки координации.
