# Как выполнять инициативу

Дата: 2026-09-18. Рекомендация: Codex как среда исполнения; GPT-6 Astra для foundation/архитектуры/review и GPT-5.6 Sol для ограниченных implementation slices; существующая GSD-модель документов как память проекта и приёмка.

**Правило управления, принятое пользователем:** [HYBRID-WORKFLOW](../../HYBRID-WORKFLOW.md) и [EXECUTION](EXECUTION.md) обязательны. Режим инициативы — `codex-direct`; GSD-workflow не назначает работу параллельно. Модель исполнителя не определяет координатора. Само чтение документов не запускает реализацию; задания назначаются по PLAN/task IDs/owned paths. Для перехода к GSD runner сначала выполнить handoff по протоколу.

## Почему так

GSD и модель решают разные задачи. GSD даёт фазовый процесс и артефакты; Astra анализирует и реализует изменения. У проекта уже сотни GSD-планов и предметные решения. Их перенос в другой framework сейчас создаст работу по миграции, не улучшая автоматически SIP, изоляцию tenant или качество метрик.

| Вариант | Оценка для этого проекта |
|---|---|
| Только большой план в чате | Быстро начать, трудно продолжать по частям и отличать реализацию от live acceptance |
| Полный автоматический GSD chain | Уместен для ограниченной понятной фазы, но текущие stale statuses и незакрытые P0 нельзя принимать за readiness |
| **Codex + короткие GSD-совместимые фазы** | Выбран: один roadmap, независимые эксперты, проверяемые результаты, без повторной генерации существующего CRUD |
| GitHub Spec Kit | Альтернатива для команды, желающей другой spec workflow; оснований мигрировать эту инициативу сейчас нет |
| Собственный агентный orchestrator | Не нужен для разработки этих продуктов; отдельная система сопровождения без доказанного выигрыша |

GSD Core документирует discuss→plan→execute→verify→ship и поддержку нескольких coding runtimes. [Официальный репозиторий](https://github.com/open-gsd/gsd-core). Spec Kit также предоставляет процессы, шаблоны и сохраняемые результаты для coding agents. [Официальный репозиторий](https://github.com/github/spec-kit). Сравнение выше — наша оценка применимости, не benchmark этих инструментов.

Codex поддерживает независимые subagents и сбор результатов; это позволяет разделить аудит/реализацию/review, но требует ясного владения файлами. [Документация subagents](https://learn.chatgpt.com/docs/agent-configuration/subagents). GPT-6 Astra пригодна для сложной разработки и исследования; выбор её для архитектуры не доказывает лучшую стоимость или задержку голосового runtime. Модели продукта выбираются отдельными evals. [Модель](https://developers.openai.com/api/docs/models/gpt-6-astra).

## Модель для реализации

Это инженерная рекомендация для данного проекта, а не результат сравнительного benchmark. Official OpenAI documentation описывает Astra как наиболее способную модель для сложной сквозной работы, Sol — как flagship для сложной профессиональной работы. На 2026-09-18 опубликованные базовые API token rates Sol ниже Astra; стоимость завершённой задачи и расход подписки Codex из этого напрямую не следуют. [GPT-6 Astra](https://developers.openai.com/api/docs/models/gpt-6-astra), [GPT-5.6 Sol](https://developers.openai.com/api/docs/models/gpt-5.6-sol).

| Работа | Предлагаемая модель/effort | Причина |
|---|---|---|
| Текущий DB-01/02 foundation, миграционные решения, ARI ownership, media lifecycle, деньги и tenant security | **GPT-6 Astra, high** | Много связанных legacy контрактов; ошибка требует переделки обеих продуктовых веток |
| Большинство последующих implementation slices: NestJS service/DTO, FSD screens, API bindings, заданные adapters, targeted tests | **GPT-5.6 Sol, high** | Более ограниченные задачи с готовыми контрактами и измеримой приёмкой |
| Независимое архитектурное и security/data review | **GPT-6 Astra, high**, xhigh для конкретной сложной проблемы | Проверить границы и failure modes без автоматического max на каждом CRUD |

Если нужен один выбор **для ближайшего старта**, оставить Astra high до стабилизации foundation. Если нужен основной исполнитель **на большую часть проекта**, использовать Sol high с Astra-review критичных срезов. После первых нескольких сопоставимых задач скорректировать выбор по rework, найденным review-дефектам, времени и реальному расходу; более низкая цена токена не доказывает меньшую цену исправления ошибки.

Настройки текущей задачи/аккаунта и `.planning/config.json` этой рекомендацией не меняются. В частности, GSD `execution=sonnet` сам по себе не переключается на Sol/Astra: перед использованием конкретного runner нужно проверить поддерживаемое отображение моделей. В прямом Codex workflow GSD хранит планы/приёмку, а выбор модели задаётся средой Codex. Эти рекомендации касаются coding agents; LLM голосового продукта выбирается отдельными latency/quality/cost evals.

## Что готово для старта

Фазовый roadmap, продуктовые SPEC и архитектурные контракты подготовлены. Детально исполнимы [AI-00](AI-00-PLAN.md) и [DB-01](DB-01-PLAN.md); можно начинать их независимые локальные задачи. AI-00 live/provider gates по-прежнему требуют соответствующего стенда/ключей. Планы AI-01…11 и DB-02…04 ещё предстоит превратить в небольшие execution plans перед каждой фазой; не называть их полным набором готовых PLAN.md.

Ближайший порядок: DB-01 connection/migration foundation параллельно AI-00 media/provider contracts → DB-02 schema/query parity → AI-01/02 shared platform; DB-03 Asterisk параллельно платформе, затем две продуктовые ветки. Все новые DB contracts сразу имеют MySQL и PostgreSQL acceptance. [Контракт двух СУБД](DATABASE-PORTABILITY.md).

## Состояние локальной системы

- При исходном аудите `AGENTS.md` называл GSD 1.8.0, фактический `.cursor/gsd-core/VERSION` был **1.12.0**. Теперь AGENTS требует читать VERSION вместо старой фиксированной версии.
- `.planning/config.json`: interactive, parallelization.enabled=false, execution=sonnet. Это существующая конфигурация GSD, а не настройки текущего Codex. В рамках аудита её не меняли.
- Глобальные skills и локальный `.cursor/gsd-core` могут ссылаться на разные workflow roots; не предполагать, что любая команда из глобального skill доступна локальному runner.
- `.planning/STATE.md`, `ROADMAP.md`, `PROJECT.md`, архитектурные планы и UAT местами расходятся. Текущий код, прямой runtime evidence и дата проверки важнее старой галочки.
- В frontend ARCHITECTURE сохранилось историческое направление merge в aiPBX. Новый запрос задаёт обратное: независимые продукты внутри Krasterisk, без зависимости от приложения aiPBX. Устаревшую секцию нужно обновить при активации implementation-фазы, а не исполнять как новый scope.

Этот этап — прямой аудит с сохранёнными артефактами. Полный `/gsd-map-codebase` или `/gsd-new-project` не запускался; все существующие фазы не переинициализированы. Документы инициативы — вход в следующий phase planning, не заявления об исполненных GSD-командах.

## Один источник фаз

Инициатива использует локальные ID **AI-00…AI-11**, чтобы не занять ошибочно следующий номер общего ROADMAP во время параллельной работы. Общий ROADMAP содержит ссылку на инициативу. При запуске формального GSD runner:

Сначала выполнить передачу управления по HYBRID-WORKFLOW, остановить пересекающиеся назначения и записать новый mode/coordinator в EXECUTION. Далее:

1. Сверить текущие workstreams/последнюю фазу и записать mapping AI-ID → свободный номер GSD в ROADMAP инициативы.
2. Импортировать **следующую фазу**, с её requirements/ADR/acceptance; не создавать второй параллельно редактируемый master plan.
3. Из root STATE сделать ссылку на активную фазу после начала её исполнения. Не объявлять старый milestone complete и не перезаписывать текущий production/autodial track.

До такого mapping команды вида `/gsd-execute-phase AI-02` не предлагаются: произвольные AI-ID могут не поддерживаться runner-ом. В прямом Codex-режиме использовать документ фазы как инструкцию и записывать SUMMARY/VERIFICATION туда же.

## Цикл одной фазы

`CONTEXT/ADR delta → PLAN (2–4 связанные задачи) → implementation → targeted tests → independent review → required checks → live/eval gate → SUMMARY/VERIFICATION → handoff`.

Детализировать ближайшую фазу; дальние содержат контракты/результаты/зависимости. Новое доказательство из spike может изменить выбор транспорта или provider, поэтому заранее генерировать сотни планов по файлам нецелесообразно.

Для AI/UX-фаз добавлять `AI-SPEC`/eval dataset и `UI-SPEC`, но не повторять уже решённые вопросы. В UI применять `sketch-findings-krasterisk-v4` и каноническую архитектуру. При реализации новых backend модулей обязательны classification в `module-coverage.registry`, AI adapter/skill или обоснованная infrastructure classification.

## Распределение работы

- Один coordinator владеет контрактами, миграциями общего ядра, root wiring, registries, общими локалями и интеграцией.
- Независимые workers: аналитика backend, роботы/media, frontend согласованной фазы. Общие registry/API/types меняются одним владельцем после согласования контракта.
- Reviewer получает план, diff и evidence; не принимает свой же тест как единственное подтверждение реализации.
- При работе в worktree сначала сохранить согласованный baseline незавершённых изменений. Worktree от HEAD не содержит текущие uncommitted исправления. Не stash/reset/commit чужой большой diff ради удобства нового агента.
- Один PR на проверяемый vertical slice. Нельзя коммитить всю рабочую копию с уже существующими изменениями.

## Реальные gates

1. Unit/integration checks согласно `AGENTS.md`: `npm run lint`, `npm run test:backend`, `npm run test:frontend`.
2. Миграции: upgrade, compatibility rollback и восстановление backup на disposable DB.
3. Runtime: real Redis crash/replay + controlled Asterisk calls. Отдельно негативные tenant/admission/billing tests.
4. AI: замороженные обезличенные fixtures и held-out set, schema validity, score agreement, role assignment, speech latency, budget.
5. UX: desktop 1440px и 360px, keyboard, loading/error/empty, save/publish distinction, RU/EN.
6. Данные и деньги: storage expiry, duplicate requests, double billing, unclear provider outcome, product disable while in flight.

Состояния фазы отдельно: **planned / implemented / automated-tests-passed / live-verified / commercially-released**. Наличие SUMMARY, успешный mock и «модель сказала done» не заменяют живой звонок или приёмку измерений.

Нет разрешённых ключей/стенда → зависимый live gate остаётся pending; остальные работы продолжаются. Включение платного провайдера, реальных платежей или production routes делается по конкретному deployment scope; этот план не является фактом такой выкладки.
