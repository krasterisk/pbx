# Как работать с GSD Core в Krasterisk v4

Краткая инструкция для разработчиков. Проект использует **GSD Core** (Git. Ship. Done.) в **Cursor**: spec-driven разработка, subagents, артефакты в `.planning/`.

Установка GSD лежит в `.cursor/` (в gitignore). Команды вызываются **в чате агента Cursor** через `/gsd-...`.

---

## 1. Первый запуск (один раз на машине)

### Установка

```powershell
cd C:\Users\Professional\WebstormProjects\krasterisk_v4
npx @opengsd/gsd-core@latest --cursor --local
```

Выбрать **Cursor** и **local** (папка `.cursor/` в репозитории).

### После установки

1. **Перезапустить Cursor** — иначе slash-команды не появятся.
2. Открыть корень монорепо `krasterisk_v4` как workspace.
3. Проверить: в чате набрать `/gsd-help` или `/gsd-progress`.

### Обновление GSD

```powershell
npx @opengsd/gsd-core@latest --cursor --local
```

Установка идемпотентна (можно запускать повторно).

---

## 2. Главный цикл (фаза = кусок фичи)

```text
map-codebase → new-project → discuss → plan → execute → verify → ship
```

| # | Команда | Что делает |
|---|---------|------------|
| 0 | `/gsd-map-codebase` | Индексирует код (brownfield). Результат: `.planning/intel/` |
| 1 | `/gsd-new-project` | Вопросы → требования → roadmap → `PROJECT.md`, `ROADMAP.md` |
| 2 | `/gsd-discuss-phase N` | Ваши решения до планирования (API, UX, edge cases) |
| 3 | `/gsd-plan-phase N` | Research + планы по файлам + проверка планов |
| 4 | `/gsd-execute-phase N` | Реализация subagent’ами, атомарные коммиты |
| 5 | `/gsd-verify-work N` | Приёмка: тесты + ручные проверки |
| 6 | `/gsd-ship N` | PR с описанием по шаблону GSD |

**Совет:** после тяжёлого шага делайте `/clear` в чате — GSD читает `.planning/STATE.md` и продолжает с того же места.

**Авто-шаг:** `/gsd-progress` или `/gsd-progress --next` — «где я» и что дальше.

---

## 3. Greenfield vs brownfield

### У вас уже есть код (Krasterisk)

Порядок **обязательный**:

```text
/gsd-map-codebase
/gsd-new-project
```

На `new-project` говорите, **что добавляете**, а не «создать проект с нуля».

**Из готового PRD/плана:**

```text
/gsd-new-project --auto @.idea/MOH_MODERN_DELTA_PRD.md
```

Файл должен быть в workspace; `@` подтягивает содержимое в контекст.

### Новый проект с нуля

Только `/gsd-new-project` (без map), если репозиторий пустой.

---

## 4. Архитектура — чтобы GSD всегда знал про FE/BE

**Не правьте** шаблоны в `.cursor/gsd-core/` (перезапишутся при обновлении GSD).

Вместо этого — **проектные файлы**, которые discuss читает на шаге `canonical refs`:

| Файл | Роль |
|------|------|
| `.planning/CANONICAL_REFS.md` | Единый индекс ссылок |
| `.planning/PROJECT.md` | Секция **Canonical References** (обязательные ARCHITECTURE) |
| `.planning/ROADMAP.md` | `Canonical refs:` в шапке и у каждой фазы |
| `AGENTS.md` | Cursor видит в каждом чате |

При `/gsd-discuss-phase N` агент собирает `<canonical_refs>` в `*-CONTEXT.md` из PROJECT + ROADMAP + ваших уточнений.

**Новая фаза (редизайн, модуль):** добавьте в ROADMAP под фазой строку `Canonical refs:` с путями к модульным `.docs/*_MODULE.md`.

**Опционально:** `/gsd-map-codebase` — GSD может создать `.planning/codebase/ARCHITECTURE.md` (сводка); исходники правды остаются в `packages/*/.idea/ARCHITECTURE.md`.

---

## 5. Где что лежит

| Путь | Назначение |
|------|------------|
| `.planning/CANONICAL_REFS.md` | Индекс архитектуры и docs |
| `.planning/PROJECT.md` | Видение и scope |
| `.planning/REQUIREMENTS.md` | REQ-001, REQ-002… |
| `.planning/ROADMAP.md` | Фазы и статусы |
| `.planning/STATE.md` | Текущая позиция, решения (память между сессиями) |
| `.planning/phases/NN-*/CONTEXT.md` | Решения фазы после discuss |
| `.planning/phases/NN-*/` | Планы, UAT, verification |
| `.planning/intel/` | Снимок кодовой базы после map-codebase |
| `.planning/config.json` | Режим interactive/yolo, модели, parallelization |
| `AGENTS.md` | Краткие правила для агента |
| `.cursor/` | Skills GSD (не в git) |

**Коммитить в git:** `.planning/`, `AGENTS.md`, `GSD_GUIDE.md` — по решению команды.  
**Не коммитить:** `.cursor/` (в `.gitignore`).

---

## 6. Режимы и настройки

### Interactive vs YOLO

В `.planning/config.json`:

```json
{ "mode": "interactive" }
```

- **interactive** — подтверждение шагов (рекомендуется для prod-кода).
- **yolo** — авто-одобрение (осторожно).

Изменить в чате: `/gsd-settings`.

### Полезные флаги

| Флаг | Команда | Когда |
|------|---------|--------|
| `--auto @file.md` | `/gsd-new-project` | Roadmap из PRD |
| `--skip-research` | `/gsd-plan-phase` | Домен уже знаком |
| `--draft` | `/gsd-ship` | Draft PR |
| `--chain` | `/gsd-discuss-phase` | discuss → plan → execute подряд |

Справка: `/gsd-help`, `/gsd-help --brief`, `/gsd-help plan-phase`.

---

## 7. Задачи вне фазы (мелочи и баги)

| Команда | Когда |
|---------|--------|
| `/gsd-quick "описание"` | Небольшая задача с plan + verify |
| `/gsd-fast "описание"` | Тривиально, без subagents |
| `/gsd-debug "симптом"` | Системная отладка (сессия переживает `/clear`) |
| `/gsd-code-review N` | Ревью после execute |
| `/gsd-capture` | Идея в backlog |

---

## 8. Проверка качества (обязательно для Krasterisk)

GSD verify **не заменяет** ваши скрипты. Перед «готово» и перед PR:

```powershell
npm run lint
npm run test:backend
npm run test:frontend
```

При UI: `npm run test:e2e` (если затронуты критичные flow).

Доменные правила: `packages/frontend/.idea/ARCHITECTURE.md`, `.docs/*_MODULE.md` (локально, в gitignore).

---

## 9. Пример: новая фича в Krasterisk

1. Ветка: `git checkout -b feature/my-feature`
2. Описать scope в `.idea/MY_FEATURE_PLAN.md` или issue.
3. В Cursor:
   ```text
   /clear
   /gsd-map-codebase
   /gsd-new-project --auto @.idea/MY_FEATURE_PLAN.md
   /gsd-discuss-phase 1
   /gsd-plan-phase 1
   /gsd-execute-phase 1
   ```
4. Локально: `npm run test` + ручная проверка UI.
5. ```text
   /gsd-verify-work 1
   /gsd-ship 1
   ```

---

## 10. Пример: редизайн MohPage (Phase 2)

См. `.planning/ROADMAP.md` → Phase 2 и `.planning/phases/02-moh-page-redesign/PHASE.md`.

```text
/gsd-discuss-phase 2
/gsd-sketch MohPage redesign per @packages/frontend/.idea/ARCHITECTURE.md — 3 variants
/gsd-sketch --wrap-up
/gsd-ui-phase 2
/gsd-plan-phase 2
/gsd-execute-phase 2
```

## 11. Пример: MOH backend (Phase 1)

| Документ | Содержание |
|----------|------------|
| `.idea/MOH_MODERN_PLAN.md` | Исходный план |
| `.idea/MOH_MODERN_DELTA_PRD.md` | PRD только delta для GSD |
| `.docs/GSD_CORE_PIPELINE_MOH.md` | Пошаговый pipeline MOH (локально) |
| `.planning/` | Состояние фазы MOH playlist |

Дальнейшие шаги в Cursor:

```text
/gsd-map-codebase
/gsd-verify-work 1
/gsd-ship 1
```

---

## 12. Типичные проблемы

| Проблема | Решение |
|----------|---------|
| Нет команд `/gsd-*` | Перезапуск Cursor; переустановка `npx @opengsd/gsd-core@latest --cursor --local` |
| Агент «забыл» контекст | `/gsd-progress` или `/gsd-resume-work` |
| План создаёт уже существующие файлы | В discuss: brownfield, указать пути существующих модулей |
| Два директора процесса | Один главный: GSD для фаз; Superpowers — для TDD/debug навыков, не дублировать roadmap |
| Огромный diff в PR | `mode: interactive`, меньшие фазы, `parallelization.enabled: false` |

---

## 13. Связка GSD + Superpowers (если установлен)

| Инструмент | Роль |
|------------|------|
| **GSD** | Фазы, roadmap, plan/execute/verify/ship, `.planning/` |
| **Superpowers** | Дисциплина: brainstorming, TDD, systematic-debugging |

Не ведите два несогласованных плана: фазовый план — в `.planning/`, не копируйте то же в `docs/superpowers/plans/` без синхронизации.

---

## 14. Шпаргалка команд

```text
/gsd-help
/gsd-progress
/gsd-map-codebase
/gsd-new-project
/gsd-discuss-phase 1
/gsd-plan-phase 1
/gsd-execute-phase 1
/gsd-verify-work 1
/gsd-ship 1
/gsd-settings
/gsd-quick "..."
/gsd-debug "..."
```

Официальная документация: [open-gsd/gsd-core](https://github.com/open-gsd/gsd-core) — `docs/USER-GUIDE.md`, `docs/COMMANDS.md`.
