# Krasterisk v4 — инструкции для агента

## Проект

- Монорепо: `packages/backend` (NestJS), `packages/frontend` (React FSD), `packages/shared`
- **Архитектура (MUST READ):**
  - `packages/frontend/.idea/ARCHITECTURE.md` (в т.ч. **Optimistic toggles** — Switch с мгновенным PUT через RTK `onQueryStarted` + undo)
  - `packages/backend/.idea/ARCHITECTURE.md`
- Индекс для GSD: `.planning/CANONICAL_REFS.md`
- Модули: `.docs/*_MODULE.md` (локально)

## GSD Core

Установлен локально: `.cursor/` (v1.8.0). Команды в чате Cursor: `/gsd-*`.

| Шаг | Команда |
|-----|---------|
| Индекс (после клонирования) | `/gsd-map-codebase` |
| PRD delta MOH | `@.idea/MOH_MODERN_DELTA_PRD.md` |
| Discuss / Plan / Execute / Verify | `/gsd-discuss-phase 1` … `/gsd-verify-work 1` |

Артефакты: `.planning/`. Инструкция: **`GSD_GUIDE.md`**. MOH pipeline: `.docs/GSD_CORE_PIPELINE_MOH.md`.

**Sketch findings:** UI для `/moh` (Phase 2) и Module Hub / shell / marketplace / platform admin (Phase 8) — читать skill `sketch-findings-krasterisk-v4` (`.cursor/skills/sketch-findings-krasterisk-v4/SKILL.md`).

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
