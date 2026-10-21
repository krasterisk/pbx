# Независимый review проектирования

Дата: 2026-09-18. Проверен первоначальный `ARCHITECTURE.md` по текущему исходному коду Krasterisk; вторым проходом — появившиеся `RECORDING-INTEGRATION.md` и `ANALYTICS-SPEC.md`. `ROADMAP.md` на момент этих проходов ещё не существовал. Findings переданы автору плана; статус ниже отражает момент review, не более поздние исправления.

## Вердикт

Архитектурное направление согласовано с обнаруженной базой: два независимых entitlement, отдельные домены, сохранение сценарных robots, развитие `ai-agents`, отдельный телефонный principal, API-first аналитика, immutable versions/ledger и durable jobs. Не найдено причины заменять NestJS/React/MySQL или создавать fork aiPBX. До исполняемого foundation plan нужны следующие уточнения.

Примечание к историческому review: после него пользователь потребовал PostgreSQL и MySQL как варианты установки. Все MySQL-only предпосылки ниже заменены [DATABASE-PORTABILITY](DATABASE-PORTABILITY.md) и ADR-13; сохранение MySQL не исключает добавление PostgreSQL. Текущий AI-02 gate проверяет оба engines.

## Findings

| ID | Приоритет | Пробел | Конкретная доработка и проверка |
|---|---|---|---|
| PR-01 | P1 | Analytics-only обещан, но текущий composition root безусловно загружает PBX/runtime/schedulers; signup безусловно создаёт контексты | Зафиксировать composition roots/profiles `control-api`, `media-runtime`, `analytics-worker` и единственный владелец scheduled jobs. Разделить organization identity creation и PBX provisioning. Gate: analytics-only запускается без ARI/AMI и Asterisk realtime schema, создаёт tenant/project/API key, принимает/обрабатывает запись. При 2 workers месячное списание/сканирование не дублируется. |
| PR-02 | P1 | Формулировка «не использовать старые public endpoints» не устраняет их доступность на том же API | Добавить явный remediation/compatibility gate `public/voice-robots` перед внешним доступом к новым продуктам: authenticated/scoped migration либо отключение в новом product profile. Нужен отрицательный HTTP-тест legacy unauth CRUD/CDR; не отключать существующую v3 интеграцию без inventory/compatibility решения. |
| PR-03 | P1 | Два SKU предлагаются, но текущая license логика позволяет все модули вне CLOUD и выводит AI Hub access из старых `voice_robot`/`cc_ai_voice` | Отдельный ADR новых продуктов для CLOUD/BOX/OPENSOURCE, migration aliases и общих provider rights. Gate: комбинации robot-only/analytics-only/оба/ни одного проходят UI + REST + SIP admission + job enqueue/worker, включая tenant 0; сценарный robot SKU сам по себе не даёт право запускать AI voice. |
| PR-04 | P2 | `user_uid` в новых таблицах не различает физическое имя столбца и Sequelize attribute | Явно выбрать `attribute user_uid → column vpbx_user_uid` по текущим `CcAiAgent`/`CcAiProvider` либо документировать обоснованное исключение. Для Async contracts использовать одно семантическое tenant поле без двусмысленности. Gate: migrations/models/query scopes одинаково трактуют tenant 0. |
| PR-05 | P2 | «Cancel STT/LLM/TTS при barge-in» допускает потерю новой речи caller | Сформулировать interruption contract: отмена текущей assistant generation/TTS/playback epoch, сохранение нового caller audio/pre-roll, rebind STT при необходимости без потери реплики прерывания. Gate: длинный ответ робота прерывается; первая новая фраза распознана полностью; stale chunks не играют; transcript не приписывает услышанное из отменённой части. |
| PR-06 | P2 | Бюджетные reservations перечислены в SQL, но текст связывает их с обязательным Redis без разделения authority | Разделить financial/quota reservation в SQL transaction и runtime resource leases/concurrency. Redis может ускорять/distribute, но источник истины баланса и settlement должен быть один. Gate: Redis loss/restart не теряет денежный hold и не создаёт второй debit, expired resource lease не означает автоматический refund уже выполненной услуги. |
| PR-07 | P2 | Отдельные runtime workers и один ARI adapter не определяют владельца событий на конкретном PBX | В transport spike/ADR выбрать единственный ingress/dispatcher на PBX node или явное разделение приложений/worker destinations; persistence lease связывает channel/session/owner. Не запускать каждый worker с копией общего `AriConnectionService` и теми же consumers. Gate: 2 runtime workers + scripted + autodial не получают двойного answer/hangup, drain сохраняет известного владельца; после потери owner выполняется только оговорённый fallback/cleanup. |
| PR-08 | P2 | Формулировка «PBX assistant — существующий модуль AI» может читаться как существующая отдельная лицензия admin-chat | В таблице лицензий оставить «существующая политика; проверить», поскольку текущие AI Hub, page-level license и overlay assistant — разные поверхности. Не объявлять имеющийся commercial SKU без проверки каталога. |
| PR-09 | P2 | Foundation/provider часть не называет уже найденный tenant 0 mismatch обязательной исправляемой миграцией | Перед runtime admission устранить `AiAgentsService` разрешение provider owner `[0, userUid]`: tenant 0 — реальный tenant, не глобальный template. Проверять ownership/enabled/capability на backend и publish-time, не полагаться на dropdown. Gate: tenant A не может привязать provider tenant 0/B, в том числе обновлением ID и при обработке старой конфигурации. |
| PR-10 | P2 | `ANALYTICS-SPEC` включает «повтор технической стадии» в список reanalysis с созданием новых runs, тогда как архитектура определяет technical retry как attempt того же run | Различить `retry_failed_stage` и осознанный `reanalyse/replay`: первый продолжает исходный run/версию с прежним billable key, второй создаёт новый run/version selection с явной ценой. Если manual retry тоже является новым run, обосновать другую модель и привести все API/ledger контракты к ней. |
| PR-11 | P2 | В recording policy `off` означает «не анализировать», но дальнейший текст допускает остановку capture на чувствительном участке по ещё не описанной privacy policy | Отделить `CapturePolicy/segment exclusion` от analytics mode. Analytics OFF само по себе не меняет обычную PBX запись; явный privacy exclusion запрещает передачу/анализ участка и, где так задано, capture. Определить приоритет при route chains/transfers и acceptance с уже начатым recorder, чтобы не было неявной смены смысла OFF. |

## Кодовые основания

- PR-01: `packages/backend/src/app.module.ts:245`…`:278` — unconditional Ami/Ari/Voicemail/Autodial/CloudAdmin imports; `cloud-admin/cloud-admin.module.ts:56` — Billing import; `cloud-admin/billing/billing.module.ts:25` — `ScheduleModule.forRoot`; `billing-scheduler.service.ts:67` — monthly cron. `auth/tenant-registration.service.ts:14` инжектит Context и `:35` создаёт два контекста в signup transaction.
- PR-02: `voice-robots/voice-robots-public.controller.ts:15` — no guard/fixed tenant; `voice-robots.module.ts:58` — регистрация controller; глобальный `APP_GUARD` в `app.module.ts:287` — throttler.
- PR-03: `cloud-admin/modules-registry.service.ts:54` — legacy Hub aliases; `:105`/`:123` — `mode !== CLOUD` bypass. `module-access.guard.ts:34` разрешает endpoint без annotation. `ai-agents.controller.ts:22` — только JWT/admin, без module entitlement guard.
- PR-04/09: `ai-agents/models/ai-provider.model.ts:60` — field mapping и комментарий о BOX tenant 0; `ai-agents/models/ai-agent.model.ts:79` — mapping; `ai-agents.service.ts:116` — legacy provider ownership `[0, userUid]`.
- PR-05: `voice-robots/services/voice-robot-session.ts:548` — barge-in speech transition; `:1972` — abort current TTS pipeline. Переносим поведение и тесты, а не обязательно весь session class.
- PR-06: `cloud-admin/billing/billing-balance.service.ts:147`/`:203` — SQL lock/transaction; `redis/redis.module.ts:11` — null fallback. Новая ledger архитектура ещё не реализована.
- PR-07: `ari/ari-connection.service.ts:65` — один app; `:230` — broadcast всех ARI events; `voice-robots/voice-robots.service.ts:505` — любой app event интерпретируется как numeric robot ID; `autodial/autodial-originator.service.ts:97` использует тот же app с `autodial,...`.

Пути без префикса в этом разделе относительны к `packages/backend/src/modules/`. Это inspection текущего исходника, не результат нового live PBX теста. Материалы существующих UAT не заменяют новые foundation gates.

## Что уже решено удачно и не требует повторного обсуждения

- `cc_ai_agents` — каркас, не готовый runtime; план не обещает обратного.
- Внешний analytics API не требует местного callcenter/extension/CDR.
- Транскрипт робота можно повторно использовать только с проверенной provenance/capability, без фиктивного STT charge.
- Callback delivery отделён от analysis run, technical retry — от explicit reanalysis.
- Supplier cost отделён от customer pricing; uncertain upstream outcome явно учитывается.
- Caller tools и administrative PBX tools разделены по полномочиям.
- Transport/provider decision вынесено на проверяемый capability spike, без безусловного production deployment нового драйвера.

## Review status

Все findings отправлены автору проектных документов. В этот файл не внесено утверждение «исправлено»: дальнейший авторский pass должен сослаться на конкретный phase task/acceptance для каждого принятого P1/P2. Production-код review не меняет.

## Повторный независимый review: disposition PR-01…PR-11

Дата повторного прохода: 2026-09-18. Проверены обновлённые ARCHITECTURE, ROADMAP, AI-00-PLAN, RECORDING-INTEGRATION, ROBOTS-SPEC и ANALYTICS-SPEC. Все одиннадцать первоначальных findings **addressed in plan**: появились конкретные решения и этапы проверки. Это **не fixed in code**, не успешные тесты и не доказанная безопасность production. Исполнение, миграции и live gates остаются впереди.

| ID | Disposition | Где проверено решение | Этап исполнения / проверка |
|---|---|---|---|
| PR-01 | Addressed in plan | [ARCHITECTURE §3](ARCHITECTURE.md#3-общая-схема): отдельные composition roots, один scheduler owner, signup без PBX Context; [AI-00 Task 4](AI-00-PLAN.md#task-4-provider--product-profile-decision), пункт 3: независимый профиль | [AI-01](ROADMAP.md#ai-01-границы-модулей-identity-и-навигация), задача 3 и приёмка; [AI-02](ROADMAP.md#ai-02-долговечные-задачи-медиа-и-измерение-расхода), задача 4. Два workers без повторных cron; analytics-only startup/signup/upload. |
| PR-02 | Addressed in plan | [ARCHITECTURE §4](ARCHITECTURE.md#4-правила-владения-и-изоляции), заключительный абзац: legacy ingress inventory, scoped compatibility либо отключение profile, отрицательные HTTP-тесты | [AI-01](ROADMAP.md#ai-01-границы-модулей-identity-и-навигация), задача 2: до внешнего открытия; existing v3 compatibility не удаляется молча. |
| PR-03 | Addressed in plan | [ARCHITECTURE §1](ARCHITECTURE.md#1-границы-продуктов): CLOUD/BOX/OPENSOURCE, aliases, tenant 0, запрет implicit AI rights из scripted SKU | [AI-01](ROADMAP.md#ai-01-границы-модулей-identity-и-навигация), задача 1 и матрица доступа; [AI-10](ROADMAP.md#ai-10-коммерческая-готовность-по-каждому-продукту), задачи 1/3/5 и standalone acceptance. |
| PR-04 | Addressed in plan | [ARCHITECTURE §4](ARCHITECTURE.md#4-правила-владения-и-изоляции), правило 1; [ADR-11](ARCHITECTURE.md#12-реестр-общих-решений); [ANALYTICS-SPEC §3](ANALYTICS-SPEC.md#3-сущности-и-инварианты): attribute `user_uid` → physical `vpbx_user_uid`, без массового rename | [AI-00 Task 1](AI-00-PLAN.md#task-1-baseline-и-инварианты), пункт 4; migrations/models проверяются в AI-01/02. Tenant 0 обрабатывается явно. |
| PR-05 | Addressed in plan | [ARCHITECTURE §6](ARCHITECTURE.md#6-голосовой-runtime); [ROBOTS-SPEC Cascade](ROBOTS-SPEC.md#cascade): независимые assistant epoch и inputTurnId, STT новой реплики не очищается | [AI-07](ROADMAP.md#ai-07-ai-робот-версия-и-каскадный-разговор), задача 3; fixture с прерыванием на первом слоге сохраняет полный utterance/pre-roll и прекращает старый playback. |
| PR-06 | Addressed in plan | [ARCHITECTURE §10](ARCHITECTURE.md#10-коммерция-и-контроль-стоимости): единственная financial authority — SQL; expiry Redis lease не возвращает деньги автоматически | [AI-02](ROADMAP.md#ai-02-долговечные-задачи-медиа-и-измерение-расхода), задачи 1/5 и fault/replay acceptance; [AI-10](ROADMAP.md#ai-10-коммерческая-готовность-по-каждому-продукту), задача 2: shadow reconciliation до billable mode. |
| PR-07 | Addressed in plan | [ARCHITECTURE §7](ARCHITECTURE.md#7-ari-и-существующие-модули): один ingress на PBX node, mapping/lease, запрет mutating broadcast; [AI-00 Task 2](AI-00-PLAN.md#task-2-ari-ownership--media-transport-spike): namespace fixture | [AI-07](ROADMAP.md#ai-07-ai-робот-версия-и-каскадный-разговор), задача 2, coexistence и два workers; [AI-08](ROADMAP.md#ai-08-realtime-внешний-sip-и-lifecycle), задача 4: disconnect/drain/reconciliation. |
| PR-08 | Addressed in plan | [ARCHITECTURE §1](ARCHITECTURE.md#1-границы-продуктов): для PBX assistant указана существующая политика, отдельный SKU не предполагается | [AI-01](ROADMAP.md#ai-01-границы-модулей-identity-и-навигация), задача 4: provider screen не требует лишней лицензии AI-chat. |
| PR-09 | Addressed in plan | [ARCHITECTURE §4](ARCHITECTURE.md#4-правила-владения-и-изоляции), заключительный абзац: убрать `[0,userUid]`, owner/enabled/capability; global templates — другой тип | [AI-01](ROADMAP.md#ai-01-границы-модулей-identity-и-навигация), задача 5: CRUD/publish/admission и migration inventory. Исправление кода ещё требуется. |
| PR-10 | Addressed in plan | [ANALYTICS-SPEC — версионирование](ANALYTICS-SPEC.md#версионирование-и-повторный-анализ): explicit reanalysis — новый run; timeout/429/crash/repair — attempt исходного run, стабильный client billable key, отдельный supplier usage; согласовано с [ARCHITECTURE §5](ARCHITECTURE.md#5-контракты-и-данные-общего-уровня) | AI-02 jobs/ledger и [AI-04](ROADMAP.md#ai-04-вертикальный-mvp-внешней-аналитики), задачи 2/4/5; AI-06 bulk reanalysis — явный платный запуск. Delivery failure не повторяет analysis. |
| PR-11 | Addressed in plan | [RECORDING-INTEGRATION INT-02](RECORDING-INTEGRATION.md#int-02-эффективная-политика): analytics OFF не выключает PBX запись; отдельный CapturePolicy с `capture`/`analysis_export`, privacy deny priority; при невозможности выделить segment весь asset удерживается | [AI-03](ROADMAP.md#ai-03-recording-asset-из-внутренних-звонков) recording/segments и [AI-06](ROADMAP.md#ai-06-внутренняя-аналитика-дашборды-и-отчёты), задачи 1/2. Контракт прямо требует проверку transfer/уже начатого recorder. |

### Дополнительная сверка roadmap: standalone, admission и billing

- **Standalone покрыт планом:** AI-00 Task 4 проверяет composition prototype; AI-01 отделяет identity/onboarding от PBX; AI-04 даёт внешний analytics flow; AI-08 даёт external SIP и scoped outgoing без покупки полного AutoDial; AI-10 A/R отдельно принимают независимый продукт. AI-04 не зависит от AI-03/legacy CDR — внешний API не блокируется repair внутренней PBX.
- **Admission покрыт контрактами и фазами:** AI-01 проверяет entitlement/tenant/provider ownership; AI-02 вводит финансовые reservations и лимиты; AI-07 требует trusted session admission; AI-08 реализует CPS/concurrency/duration и outbound policy. В [ROBOTS-SPEC VR-11](ROBOTS-SPEC.md#2-требования-vr-01vr-12) и [ARCHITECTURE §10](ARCHITECTURE.md#10-коммерция-и-контроль-стоимости) reservation обязателен до новой платной сессии. При детализации AI-07 тест должен проверять отказ до provider/media spending, а не только tenant mismatch.
- **Billing покрыт планом до коммерческого допуска:** AI-02 — shadow events/reserve/settle/replay с MySQL+Redis; AI-10 A/R — price versions, invoices, reconciliation и переключение в billable; AI-11 A/R — failure/restore evidence. Analytics completion и роботский hangup не создают второй клиентский charge; supplier retries учитываются отдельно.

### PR-12 — зависимость recording capability для robot-only

На первом чтении ROADMAP обнаружен один дополнительный P2: AI-07 зависел только от AI-01/02+probe00, не содержал подключения robot recording asset, а AI-10R зависел от 08+09. При изменении порядка реализации можно было дойти до robot commercial acceptance без общей recording capability AI-03, хотя VR-11 требует media links/recording.

Замечание передано автору: recording capability AI-03 должна быть общим основанием роботов и аналитики; добавить зависимость/отдельный обязательный capture slice перед recording acceptance AI-07/10R. Analytics pipeline AI-04…06 и entitlement `speech_analytics` остаются необязательными для robot-only. Legacy CDR repair требуется только затрагиваемому внутреннему PBX path, не standalone session/media attribution.

Статус PR-12 на момент добавления этого блока: **open in plan, автор уведомлён**. Следующая запись disposition должна подтвердить изменённые DAG/depends/tasks/acceptance, а не только декларацию в спецификации.

### Финальная сверка PR-12

Повторно прочитан обновлённый roadmap после ответа автора. **PR-12 addressed in plan**:

1. В [DAG](ROADMAP.md#результаты-и-порядок) добавлено ребро `AI-03 → AI-07`.
2. [AI-03](ROADMAP.md#ai-03-recording-asset-из-внутренних-звонков) явно определена как общая capture/asset capability обоих продуктов, без лицензии/проекта аналитики; в требования включён recording slice VR-11. Legacy CDR/tenant attribution gate применяется только к внутреннему PBX path; external robot-only использует доверенный VoiceSession/media manifest.
3. В [AI-07](ROADMAP.md#ai-07-ai-робот-версия-и-каскадный-разговор) `depends` теперь включает AI-03, а задача 7 подключает recording/asset-ready по deployment/connection policy без Route/CDR и без аналитики, проверяет playback/retention права. Analytics AI-04…06 и её entitlement прямо исключены из обязательных зависимостей робота.
4. Commercial robot path `07 → 08/09 → 10R → 11R` теперь транзитивно включает shared recording, но не analytics product. Продуктовая независимость сохранена.

Итог независимого plan review: **12/12 findings addressed in plan; открытых замечаний в проверенной области не осталось**. Это допуск к детализации/реализации фаз с перечисленными gates, а не утверждение о готовом коде. **0 из этих findings объявлены fixed in code этим review**; новые unit/integration/live/load tests и production fixes здесь не выполнялись.

## Дополнение после уточнения SaaS / self-hosted / OpenSource

Reviewer дополнительно проверил DEPLOYMENT-LICENSING и передал два уточнения. Автор плана внёс их и сверил документы; отдельный завершающий reviewer verdict для этого дополнения не заявляется.

| ID | Замечание | Disposition автора |
|---|---|---|
| PR-13 | Коробка с local/BYOK не должна требовать cloud wallet/обязательный денежный hold | Учтено в ARCHITECTURE §10, DEPLOYMENT-LICENSING §5, ROADMAP AI-02: entitlement/resource admission обязателен, money hold условен по billing policy. Проверить standalone без SaaS balance |
| PR-14 | Core providers сейчас связаны с AiAgentsModule, простое исключение commercial robots сломает voicemail/ai-chat | Учтено в ARCHITECTURE §5, DEPLOYMENT-LICENSING §2, ROADMAP AI-01 task6: нейтральный provider/connectivity модуль, compatibility facade, один credential store; community compile/test без commercial source tree |

Итого: 12 первоначальных замечаний закрыты независимой повторной сверкой на уровне плана; два дополнительных отражены автором в задачах и gates. Исправления production-кода и проверка SaaS/self-hosted/OSS дистрибутивов ещё предстоят.

## Дополнительный scope: SaaS, self-hosted и OpenSource core

Дата: 2026-09-18. После предыдущего прохода пользователь явно уточнил SaaS, коробочную установку и OpenSource базового модуля. Проверены новый DEPLOYMENT-LICENSING, изменённые ARCHITECTURE/ROADMAP/AI-00-PLAN и первые разделы продуктовых спецификаций. Предыдущий итог 12/12 относится к первоначальному scope; ниже — два дополнительных замечания и их независимая повторная проверка.

| ID | Пробел первоначальной редакции | Disposition и проверенные места | Обязательный execution gate |
|---|---|---|---|
| PR-13 | Безусловная денежная reservation/положительный баланс противоречили self-hosted local/BYOK без SaaS-кошелька | **Addressed in plan.** [ARCHITECTURE §10](ARCHITECTURE.md#10-коммерция-и-контроль-стоимости), [DEPLOYMENT §5](DEPLOYMENT-LICENSING.md#5-биллинг-и-стоимость): entitlement/resource admission обязателен, money hold условен по billing policy; non-billable usage разрешён, BYOK supplier bill не дебитуется повторно. [AI-02](ROADMAP.md#ai-02-долговечные-задачи-медиа-и-измерение-расхода), задача 5, содержит тот же контракт. | Чистая local/BYOK коробка с действующей локальной лицензией работает без облачного кошелька; managed service сохраняет authoritative charge ID и не создаёт двойное списание. Приёмка [AI-10](ROADMAP.md#ai-10-коммерческая-готовность-по-каждому-продукту)/[AI-11](ROADMAP.md#ai-11-приёмка-нагрузка-пилот-и-эксплуатация). |
| PR-14 | Community build без коммерческого robot package несовместим с текущими импортами providers из `AiAgentsModule` в voicemail/ai-chat | **Addressed in plan.** [ARCHITECTURE §5](ARCHITECTURE.md#5-контракты-и-данные-общего-уровня), [DEPLOYMENT §2](DEPLOYMENT-LICENSING.md#2-граница-opensource-ядра), [AI-01](ROADMAP.md#ai-01-границы-модулей-identity-и-навигация), задача 6: neutral core/connectivity providers/media contracts, compatibility facade, один credential store, удаление прямой зависимости от commercial robot sources. | Compile/start/tests community при отсутствующем commercial source tree, а не просто отключённых меню; PBX-only не требует AI queues. DEP-01, повтор [AI-11](ROADMAP.md#ai-11-приёмка-нагрузка-пилот-и-эксплуатация). |

Дополнительно подтверждена согласованность новой концепции в проверенном scope:

- Deployment kind отделён от независимых product entitlements; существующий non-CLOUD bypass не становится правом на новые AI-продукты. SaaS и self-hosted включены в приёмку обеих веток, analytics-only и robots-only сохранены: [DEPLOYMENT §1](DEPLOYMENT-LICENSING.md#1-разделить-два-измерения), [матрица DEP-01…08](DEPLOYMENT-LICENSING.md#6-gates-и-фазы), AI-01/04/07/08/10/11.
- Локальные storage/jobs/keys/ledger, явные provider connections, запрет скрытого egress и cloud fallback, backup/restore/upgrade/rollback закреплены в [DEPLOYMENT §3](DEPLOYMENT-LICENSING.md#3-коробочная-эксплуатация), AI-02 задача 6, AI-10 задача 6, AI-11 задача 5. [AI-00 Task 4](AI-00-PLAN.md#task-4-provider--product-profile-decision), пункт 4, требует измеренный hardware/provider profile; fake provider не доказывает реальную локальную AI-работу.
- [DEPLOYMENT §4](DEPLOYMENT-LICENSING.md#4-entitlements-коробки) задаёт локальную проверку подписанной лицензии и честно ограничивает offline revocation; не обещает абсолютную DRM. Expiry не отключает community core и не удаляет данные. Perpetual/subscription/grace остаются явным бизнес-решением AI-00/10, а не незаметным допущением.
- OpenSource base и коммерциализация AI не приравнены к автоматической закрытости исходников. Состав community release и условия поставки оформляются manifest; существующая MIT-лицензия этим пакетом не изменяется. Это проверка согласованности технического плана, не юридическое заключение.

**Итог после уточнения scope: 14/14 findings addressed in plan; 0 fixed in code.** Новых открытых противоречий в проверенной области не обнаружено. Реальные сборки community, чистые установки, offline-license проверки, измерения local AI и restore drills являются будущими gates; в рамках этого review они не выполнялись.

## Дополнение PostgreSQL/MySQL и первый implementation slice

Дата: 2026-09-18. Независимый read-only audit проверил current config/driver/migrations/raw SQL/CI/Asterisk gaps; review проверил DATABASE-PORTABILITY, DB-01-PLAN и зависимые изменения ROADMAP/README. Поддержка двух engines — уточнённое требование пользователя, а не готовое свойство runtime.

| ID | Замечание | Повторная независимая проверка |
|---|---|---|
| PR-15 | DB-01 rollback обещал общий startup preflight, хотя реализуемый guard относился только к canonical runner | **Addressed in plan:** migration-command guard явно отделён от runtime schema readiness DB-02 |
| PR-16 | Cross-engine data transfer ошибочно становился общим release blocker при требовании только выбора engine при установке | **Addressed in plan:** DB-04 — install/upgrade/backup/restore каждой СУБД; transfer отдельная будущая capability |
| PR-17 | Standalone commercial analytics транзитивно зависел от Asterisk через общий AI-06 | **Addressed in plan:** DAG/acceptance/dependencies/README согласованы: 05→06A→10A/11A без Asterisk; 06P обязателен только встроенному PBX-профилю |

Итог независимого повторного review этого дополнения: **3/3 addressed in plan, открытых замечаний в проверенном scope нет; 0 fixed in code**. DB-01 признан ограниченным исполнимым scope config/runner/harness; полный PostgreSQL baseline/core/runtime остаётся DB-02, Asterisk — DB-03. Это не проверка ещё не написанной реализации и не live certificate.
