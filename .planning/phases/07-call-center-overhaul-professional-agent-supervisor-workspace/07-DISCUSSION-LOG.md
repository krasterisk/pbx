# Phase 7: Call Center overhaul - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-07-15
**Phase:** 7-call-center-overhaul-professional-agent-supervisor-workspace
**Areas discussed:** Приоритеты и разбиение, Метрики и отчётность, Call Cards, WebRTC softphone, AI-ready задел, Wallboard, АРМ оператора, АРМ супервизора, Internal chat, Отчёты v1, Роли и навигация

---

## Приоритеты и разбиение

| Option | Description | Selected |
|--------|-------------|----------|
| Одна фаза с waves | ~12–18 планов, как Phase 6 | ✓ |
| Подфазы 7.1–7.x | Каждое направление со своим циклом | |
| Гибрид | Cards и WebRTC в фазы 8–9 | |

**User's choice:** Одна фаза с waves; первым — metrics engine; аудит внутри research; ничего не режем (все направления в фазе).

---

## Метрики и отчётность: источник данных

| Option | Description | Selected |
|--------|-------------|----------|
| Трёхслойная схема | in-memory + cc_* из AMI + queue_log backfill | ✓ |
| queue_log первичный | QueueMetrics-стиль | |

**User's choice:** Трёхслойная схема (после уточнения про надёжность AMI).
**Notes:** Пользователь поднял вопросы: «что если AMI упадёт/перегрузится, best practice ли AMI-сбор?» и «нужен анализ нагрузки: 150 одновременных, 10–20 тыс. звонков/день». Итог: rebuild метрик из БД при рестарте; SLA per-queue; механизм агрегации отчётов не фиксирован — research делает анализ нагрузки; запись из AMI — батчевая, детали на усмотрение Claude.

---

## Call Cards

| Option | Description | Selected |
|--------|-------------|----------|
| Сразу DnD-конструктор | Полный конструктор + live preview одной итерацией | ✓ |
| Форма-список → DnD позже | Двухэтапно | |

**User's choice:** Сразу DnD; типы полей — на усмотрение Claude; auto_open_on настраиваемый per-template; webhook через notification_integration Phase 6.

---

## WebRTC softphone

**User's choice:** Полный объём (hold/mute/DTMF/transfer/audio devices/quality); модалка выбора режима при логине; auto-answer настраиваемый + zip tone; STUN + TURN-in-config (coturn по потребности).

---

## AI-ready задел

| Option | Description | Selected |
|--------|-------------|----------|
| Event contracts | Типизированный CC event bus | ✓ |
| MCP/AI tools | CC-сущности через AI Chat (паттерн Phase 5) | ✓ |
| ARI media skeleton | PCM-поток без STT | ✓ |
| Docs only | Только документ | |

**User's choice:** Все три технических пункта.
**Notes:** Указаны существующие наработки: модуль voice-robots в репо + внешний проект aiPBX (assistants.service.ts, ai-analytics.service.ts) — концепции использовать в research. AI-модули планируются отдельными платными модулями → изолировать, полей в схеме CC не резервировать, но предусмотреть быстрое подключение. AI-агент как оператор очереди — после модуля AI Voice Assistants. Механика подключения: гипотеза Nest-модули + license gate, research подтверждает оптимальный вариант.

---

## Wallboard

**User's choice:** Display-токен для TV без логина; настраиваемые пороги через UI; алерты через notification_integration Phase 6; фиксированный layout.

---

## АРМ оператора

**User's choice:** Pick call из своих очередей + per-user разрешение на перехват; wrap-up — продление кнопкой И autosave draft, все таймеры per-operator; полный набор звуков/browser notifications; DnD transfer с подтверждением.
**Notes:** Выявлена сущность per-operator настроек CC.

---

## АРМ супервизора

**User's choice:** «Все фичи делаем» — agent detail modal, queue management, bulk actions, live calls actions, sparklines; grid↔table toggle с запоминанием; spy через Originate на устройство супервизора.

---

## Internal chat

**User's choice:** REST+SSE транспорт; полноценный чат (личные + оператор↔оператор + broadcast + групповые); история в БД.

---

## Отчёты v1

**User's choice:** Все 7 отчётов; экспорт CSV+XLSX+PDF; автоматическая рассылка в фазе (поздняя волна); agent timeline переиспользуется в отчётах и agent detail modal.

---

## Роли и навигация

**User's choice:** Namespace /callcenter/* с редиректами; role-based меню по level; супервизор-как-оператор; единая страница /callcenter/settings.

---

## Claude's Discretion

- Набор типов полей Call Card v1
- Механизм агрегации отчётов (SQL vs rollup) по итогам анализа нагрузки
- Детали батчевой записи AMI→БД
- Схемы новых таблиц и миграции
- Детали reconciliation с queue_log
- Формат PDF-экспорта
- Внутренности CC event bus

## Deferred Ideas

- AI-агент как оператор очереди (после модуля AI Voice Assistants)
- Модули AI аналитики / голосовых ассистентов (отдельные платные модули/фазы)
- WFM, omnichannel — backlog
- Конфигуратор виджетов wallboard
- Callback / skill-based routing — кандидаты в следующую фазу
