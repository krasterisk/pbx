# Krasterisk v4 — инструкции для агента

## Проект

- Монорепо: `packages/backend` (NestJS), `packages/frontend` (React FSD), `packages/shared`
- **Архитектура (MUST READ):**
  - `packages/frontend/.idea/ARCHITECTURE.md` (в т.ч. **Optimistic toggles** — Switch с мгновенным PUT через RTK `onQueryStarted` + undo)
  - `packages/backend/.idea/ARCHITECTURE.md`
- Индекс для GSD: `.planning/CANONICAL_REFS.md`
- Модули: `.docs/*_MODULE.md` (локально)

## Гибридная разработка: один координатор

- Для многоэтапной работы читать `.planning/HYBRID-WORKFLOW.md` и `.planning/EXECUTION-REGISTRY.md` перед выбором исполняемого плана.
- Default mode — `codex-direct`: один координатор назначает PLAN, задачи, владельцев файлов и проверки; GSD хранит артефакты. `gsd-workflow` — альтернативный режим с явной передачей управления, не вторая параллельная цепочка той же фазы.
- Управляющие GSD workflows не запускать неявно в direct mode. Наличие PLAN, skills или старого STATE не назначает работу. Явный запрос пользователя на skill учитывается с согласованием scope/ownership.
- Исполнитель следует назначенным PLAN/task IDs/owned paths; не выбирает другую фазу и не создаёт собственный orchestrator. Общие migrations/registry/config/DTO имеют одного владельца записи. Делегирование — в пределах разрешений текущей задачи и среды.
- После смены модели/контекста восстановить EXECUTION, baseline, evidence и next action. Смена модели не меняет владельца. Не перезаписывать чужие изменения, общий STATE или чужие назначения.
- AI-продукты: `.planning/initiatives/ai-products/EXECUTION.md`; этот scope не присваивает действующие production/autodial задачи.

## GSD Core

Установлен локально: `.cursor/`; фактическую версию проверять в `.cursor/gsd-core/VERSION`. Команды в чате Cursor: `/gsd-*`. Наличие команд не означает автоматический запуск в режиме `codex-direct`.

| Шаг | Команда |
|-----|---------|
| Индекс (после клонирования) | `/gsd-map-codebase` |
| PRD delta MOH | `@.idea/MOH_MODERN_DELTA_PRD.md` |
| Discuss / Plan / Execute / Verify | `/gsd-discuss-phase 1` … `/gsd-verify-work 1` |

Артефакты: `.planning/`. Инструкция: **`GSD_GUIDE.md`**. MOH pipeline: `.docs/GSD_CORE_PIPELINE_MOH.md`.

**Sketch findings:** UI для `/moh` (Phase 2) и Module Hub / shell / marketplace / platform admin (Phase 8) — читать skill `sketch-findings-krasterisk-v4` (`.cursor/skills/sketch-findings-krasterisk-v4/SKILL.md`).

**Spike findings:** телеконференции (Phase 16) — ConfBridge, сетка видео SFU, браузерный клиент, гибрид с SIP-абонентами — читать skill `spike-findings-krasterisk-v4` (`.cursor/skills/spike-findings-krasterisk-v4/SKILL.md`).

## Verify перед «готово»

```bash
npm run lint
npm run test:backend
npm run test:frontend
```

## Cursor Cloud specific instructions

Окружение — Node 22 + npm workspaces. Стандартные команды не дублируем: они в корневом
`package.json` (`dev:backend`, `dev:frontend`, `build`, `lint`, `test:backend`, `test:frontend`).
Update-скрипт при старте сессии: `npm ci` (ставит все воркспейсы; `@krasterisk/shared`
собирается через `prepare`).

- **Backend требует MySQL/MariaDB на старте.** `SequelizeModule.forRoot` аутентифицируется
  при boot, поэтому без доступной БД `npm run dev:backend` падает на `app.listen()`.
  Redis — опционален: без `REDIS_HOST` подключается null-заглушка (см. `modules/redis`).
- **Схема БД намеренно вне репозитория.** `**/migrations/` в `.gitignore` («managed
  separately»), а `db:migrate` ссылается на отсутствующий `migrations/run-migrations.js`.
  `synchronize: false` — авто-создания таблиц нет. Поэтому полноценный логин и
  table-backed эндпоинты **невоспроизводимы из одного репозитория**: backend поднимается
  и коннектится к MySQL, но запросы к таблицам дают `Table '...' doesn't exist`, пока
  внешняя схема не загружена. Это же причина, по которой CI `e2e.yml` стабильно красный.
- **Локальный запуск backend:** поднять MariaDB, создать БД/пользователя `krasterisk`,
  создать `/workspace/.env` (шаблон — `.env.example`; приложение читает `.env` из корня
  репозитория) с `DB_*`, `JWT_SECRET`, затем `npm run dev:backend`. `.env` в `.gitignore`
  и пересоздаётся на каждом свежем checkout.
- **Frontend dev-сервер работает всегда:** `npm run dev:frontend` (Vite, порт 3010) не
  делает typecheck, поэтому UI поднимается даже при том, что `npm run build` сейчас падает
  на предсуществующих ошибках TypeScript.
- **Порты:** backend 5010 (`/api`, Swagger `/api/docs`), frontend 3010.
- **Предсуществующие красные проверки на `main` (НЕ следствие окружения):** `npm run lint`
  даёт 1 error, часть тестов backend/frontend падает, `tsc -b` во frontend не проходит.
  Не считать это регрессом своих изменений.
- Логи `AriConnectionService` / AMI WebSocket errors в backend — норма без живого
  Asterisk-сервера (внешняя интеграция, в dev недоступна).
