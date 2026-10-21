# Phase 5: Phonebooks AI — Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-07-14
**Phase:** 05-phonebooks-ai-universal-directory-mechanisms-mcp-tools-and-c
**Areas discussed:** Концепция справочников, Механизм переиспользования, Поверхность AI-tools, LLM context, Платформенный принцип, Dialplan apply, Глубина контракта, Миграция brownfield, UX формы привязки, Аудит и безопасность AI, E2E-приёмка

---

## Концепция справочников

| Option | Description | Selected |
|--------|-------------|----------|
| Фильтры маршрутизации | blacklist/whitelist/VIP на route | |
| Обогащение контекста | lookup имени/PB_* для CDR/webhooks | |
| Оба равноценно | политика + данные | |
| Экспертное мнение | запрошено пользователем | ✓ |

**User's choice:** Запрошена экспертная рекомендация «за скобками текущей реализации». Принята модель **Directory Policy: match → enrich → act** (вариант 1) + требование универсального переиспользования (вариант 4): справочник = callerid + данные; при матче — подстановка `CALLERID(name)`, black/white list, переназначение `CALLERID(num)` и т.д.
**Notes:** «Хотелось бы видеть какой-то универсальный инструмент для гибкой маршрутизации».

---

## Механизм переиспользования (данные vs поведение)

| Option | Description | Selected |
|--------|-------------|----------|
| Actions только на привязке | справочник = чистые данные | ✓ |
| Default на справочнике + override | мягче миграция, два места правды | |
| Оставить на справочнике | как сейчас | |

| Option | Description | Selected |
|--------|-------------|----------|
| Пресеты + Custom | имя/номер/blacklist/whitelist/redirect/vars-only + DialplanAppsEditor | ✓ |
| Только Custom | AI генерирует actions сам | |

**User's choice:** 1 + 1. Привязка = phonebook + order + match_mode + behavior; invert уходит на привязку (`on_match`/`on_no_match`).

---

## Поверхность AI-tools

| Option | Description | Selected |
|--------|-------------|----------|
| CRUD + bind атомарные | AI комбинирует сценарии сам | ✓ |
| + сценарные макро-tools | create_blacklist одним вызовом | |
| Только сценарные | без примитивов | |

| Option | Description | Selected |
|--------|-------------|----------|
| Узкий bind/unbind tool | безопаснее | |
| Полноценный update_route | универсальнее, включая bindings | ✓ |
| Оба | расширение scope | |

**User's choice:** 1 + 2.

---

## LLM context

| Option | Description | Selected |
|--------|-------------|----------|
| Summary в snapshot + on-demand tool | не раздувает контекст | ✓ (подтверждено после уточнения) |
| Полный dump entries | не масштабируется | |
| Ничего в snapshot | AI слепой | |

| Option | Description | Selected |
|--------|-------------|----------|
| Компактный KB-блок 10–15 строк | модель + пресеты + правила порядка | ✓ |
| Полный PHONEBOOKS_MODULE.md в KB | дорого по токенам | |
| Ничего | хуже качество | |

**Notes:** Первоначальный ответ «1: 2:1» был неоднозначен; после пояснения про масштабирование пользователь подтвердил вариант 1 (summary).

---

## Платформенный принцип AI Chat

**User's choice (свободная формулировка):** «Смотрим глобальней, не только в контексте справочников… создаём фундамент и платформу для работы со всеми существующими и будущими модулями. Проект AI PBX планируется как универсальный конструктор телефонии для офисных АТС с помощью генеративных моделей».
**Зафиксировано:** Domain AI Adapter (Tools / State / Knowledge), phonebooks — референсная реализация; рефакторинг существующих 5 доменов — deferred.

---

## Dialplan apply

| Option | Description | Selected |
|--------|-------------|----------|
| Полная прошивка в фазе | apply маршрута тянет phonebook-контексты | ✓ |
| Только CRUD/AI | runtime-разрыв остаётся | |

---

## Глубина универсального контракта

| Option | Description | Selected |
|--------|-------------|----------|
| JSON-schema tools + KB-описание | без метаязыка | ✓ |
| Machine-readable metadata-слой | генерация tools из дескриптора | |

---

## Миграция brownfield

**User's choice:** «Существующих справочников нет, смело перерабатываем структуру, применяем любые миграции, удаляем/изменяем поля». Полная свобода схемы, legacy-совместимость не нужна.

---

## UX формы привязки

**User's choice:** Отдельная вкладка «Справочники» в RouteFormModal; preview dialplan не нужен; добавить демо-тест lookup (поиск значения по номеру).

---

## Аудит и безопасность AI

**User's choice:** Закрыть gap логирования MCP в `action_logs`. Подтверждения деструктивных операций — настраиваемый параметр; UI настроек — подраздел «AI Chat» в `packages/frontend/src/features/cloud-admin/ui/SellerSettingsForm`.

---

## E2E-приёмка

**User's choice:** Все сценарии из ROADMAP делаем («создай чёрный список», «VIP с redirect», «привяжи к маршруту»), приёмка включает проверку реальным звонком.

---

## Claude's Discretion

- Per-binding контекст vs Gosub с аргументами
- Схема таблиц привязок и миграции
- Структура интерфейсов Domain AI Adapter
- Размещение демо-теста lookup в UI
- Модель хранения настроек AI Chat в SellerSettingsForm
- События-триггеры регенерации dialplan

## Deferred Ideas

- Match по DID/exten/trunk — отдельная фаза
- Типы справочников beyond phonebook — после универсального слоя
- Рефакторинг 5 существующих AI-доменов на Domain AI Adapter — следующая фаза
