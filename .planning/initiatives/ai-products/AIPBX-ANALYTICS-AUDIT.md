# Аудит речевой аналитики aiPBX для Krasterisk v4

Дата: 2026-09-18. Режим: чтение исходников, планов, GSD-артефактов и тестов; без изменения aiPBX, запуска провайдеров, миграций или тестовых наборов. Это оценка локального checkout, а не подтверждение состояния production.

## 1. Границы и достоверность

Фронтенд находится в `C:/Users/Professional/WebstormProjects/aiPBX`. Указанный пользователем каталог `aiPBX/_backend` отсутствует. Фактический backend — `C:/Users/Professional/WebstormProjects/aiPBX_backend`; это подтверждают [workspace:9](C:/Users/Professional/WebstormProjects/aiPBX/aiPBX.code-workspace:9) и [PROJECT:14](C:/Users/Professional/WebstormProjects/aiPBX/.planning/PROJECT.md:14).

В таблицах ниже `FE/` означает первый абсолютный корень, `BE/` — второй. Статусы:

- **Код** — реализация найдена и прочитана.
- **Тесты есть** — изучены spec-файлы; в этом аудите не запускались.
- **Отчёт о проверке** — историческое утверждение GSD summary, не свежий результат.
- **План / gap** — проектное намерение; не свидетельство реализации.

Основной модуль `BE/src/operator-analytics` зарегистрирован в [app.module.ts:89](C:/Users/Professional/WebstormProjects/aiPBX_backend/src/app.module.ts:89). Сервис превышает 4 тыс. строк и объединяет ingestion, STT, LLM, проекты, dashboard, billing, exports-related data, webhooks, retention и токены. Копирование этого модуля целиком создаст ненужную связанность.

## 2. Что действительно реализовано

| Возможность | Реализация и свидетельство | Решение для Krasterisk |
|---|---|---|
| Проекты аналитики | `BE/src/operator-analytics/operator-project.model.ts:27`: владелец `userId`, prompt, metrics, taxonomy, schema version, dashboard, webhooks, budget, digest, alerts | Адаптировать продуктовую модель; заменить owner-only изоляцию на обязательный `vpbx_user_uid` + проектные permissions |
| Типизированные метрики | `BE/src/operator-analytics/interfaces/operator-metrics.interface.ts:89`: boolean, number, enum, string; min/max/unit/polarity. FE builder: `FE/src/features/OperatorAnalytics/ui/ProjectWizard/WizardStep2_MetricBuilder.tsx:159` | Взять типовую систему; добавить applicability, missing/invalid states, rubric, aggregation и versioned identifiers |
| Настройка через шаблоны, мастер, AI-помощь | `BE/src/operator-analytics/project-templates.ts`; `FE/src/features/OperatorAnalytics/ui/ProjectWizard/ProjectWizard.tsx:92`, `WizardStep0_Templates.tsx`, `WizardStep1_Chat.tsx` | Взять сценарий «шаблон → понятная метрика → пробный анализ → публикация»; генерация должна создавать только draft |
| Формальный результат LLM | `BE/src/operator-analytics/lib/analysis-schema.ts:398`, `:481`, `:581`; Zod + JSON Schema; `operator-analytics.service.ts:4002` валидирует и делает один repair retry | Взять контракт и validation-first подход; отдельно учитывать все provider attempts |
| Объяснение оценки | `analysis-schema.ts:148` — rationale + quote; `lib/operator-evidence.ts:15` — backward-compatible reader; evidence drilldown | Взять объяснимость; усилить до ссылок на transcript segments и временные интервалы, проверяемых без доверия LLM |
| Привязка к версии | `operator-project.model.ts:74`; `operator-analytics.service.ts:599`, `:3674` — schema version, promptVersion, model, `_custom_meta` | Взять принцип provenance; заменить изменяемую схему на immutable published revisions и immutable runs |
| Качество транскрипции | `lib/assess-transcription-quality.ts:33`: пороги, quality/reasons/confidence; service:617 и :1043 прекращает ненадёжный анализ | Взять разделение качества входа и оценки сотрудника; не считать heuristic confidence калиброванной вероятностью |
| Stereo diarization | `lib/audio-probe.ts:28`; service:387; channel probe, fake stereo, energy, dual-STT, mono fallback | Взять набор экспериментов/тестов; роль канала передавать в manifest каждой записи, не через global env |
| External API | `operator-analytics.controller.ts:170`, `:225`, `:282`: multipart, URL, Base64, polling, sync/async; API-token guard | Взять сценарии интеграции; спроектировать новый узкий versioned API с service accounts, scopes и идемпотентностью |
| Пакетная обработка | service:878 и controller:1021; batch progress, sequential processing | Переписать на durable jobs. Текущий batch существует в памяти процесса |
| Dashboard | service:2030+ и `lib/dashboard-aggregation.ts`; `OperatorDashboard.tsx:343`, `:546`, `:588`: summaries, sentiment, operator ratings, topics, side panels | Взять UX «от проблемы до конкретной записи» и явные bounded samples |
| Custom dashboard builder | `FE/src/features/OperatorAnalytics/ui/DashboardBuilder/useWidgetData.ts:149` читает реальные `customMetricsAggregated`; тесты boolean/number/enum есть | Выносить builder после готовых фиксированных dashboard и корректных version-aware aggregates |
| Темы и ручная корректировка | `operator-call-tag.model.ts`; auto/manual tagging, snapshots; `operator-metric-override.model.ts:18` хранит human correction отдельно | Взять сохранение оригинального AI-результата и ручной оценки; добавить append-only audit и review workflow |
| Отчёты и уведомления | FE `features/Calls/lib/useCallsExport.ts:68`, `callsExportSheet.ts:164`; BE `operator-digest.service.ts`, `operator-alert.service.ts`, cron tasks | Адаптировать фильтрованные выгрузки, digest и alerts; права доступа и доставку вынести в общие платформенные контракты |
| Биллинг | service:3918 — LLM tokens + платные STT minutes, локальный Whisper без STT-наценки; BillingRecord, split input/output tokens, FX fields | Взять детализацию usage; тарификацию и транзакционную фиксацию реализовать по платформенному ledger |
| Offline eval | `BE/src/operator-analytics/eval/README.md`, `eval-metrics.ts`, `run-eval.ts`, две sample fixtures | Взять метрики MAE/accuracy/kappa и human override pairs; расширить до реальной выборки и release gate |

## 3. Полезные алгоритмы и ограничения

### 3.1. Записи и говорящие

[transcribePossiblyStereo:387](C:/Users/Professional/WebstormProjects/aiPBX_backend/src/operator-analytics/operator-analytics.service.ts:387) различает wall-clock длительность звонка и billable STT duration. Это особенно важно при обработке двух каналов: billing считает сумму длительностей двух STT-запросов, а звонок — максимум длительностей каналов (`channel-diarize.ts:449`).

Есть три режима: один STT + определение говорящего по L/R RMS; два STT с merge timed segments; mono + LLM-разметка. WAV-заголовок читается локально, другие форматы через ffprobe; почти одинаковые каналы определяются корреляцией (`audio-probe.ts:23`, `:116`). Сегменты объединяются только при небольшой паузе (`channel-diarize.ts:45`).

Это хорошие кандидаты для сравнительного spike, но комментарий «energy = best quality» не подтверждён представленным корпусом. Energy-метод может ошибаться на crosstalk, шуме, пересечении реплик или длинном STT-сегменте с двумя говорящими. LLM-разметка mono не восстанавливает акустическую истину: в prompt прямо предлагается чередовать operator/customer (`analysis-schema.ts:669`). Для Krasterisk нужны реальные channel/participant IDs, интервалы bridges/transfers и `roleSource/roleConfidence`. Нельзя навсегда принять `left=operator` из `channel-diarize.ts:45` для входящих/исходящих вызовов и всех внешних PBX.

Frontend multipart создаёт processing-record без durable audio asset (`controller:1025`, `service:984`), затем передаёт Buffer в process-local batch. `recordUrl` может отсутствовать. Нужны обязательное управляемое хранилище или подтверждённая устойчивая ссылка до ACK задания, lifecycle оригинала и производных файлов, а также воспроизводимый повторный анализ без повторной STT при неизменной транскрипции.

### 3.2. Метрики, версии и оценка

В [analysis-schema.ts:22](C:/Users/Professional/WebstormProjects/aiPBX_backend/src/operator-analytics/lib/analysis-schema.ts:22) есть ценное разделение качества действий оператора и результата сделки: отсутствие свободного слота не должно автоматически ухудшать каждый процессный показатель. Там же есть шкальные якоря, rubric checklist и требование объяснить пропущенный пункт.

Проблемные допущения: «нет возражения → 100» и «N/A считается выполненным» (`analysis-schema.ts:31`, `:93`) завышают рейтинг, смешивают отсутствие возможности оценить навык с качеством навыка. В новой модели `not_applicable` исключается из знаменателя; coverage отображается рядом с оценкой. Автоматически предсказанный `csat` нужно назвать «оценка вероятной удовлетворённости», отдельно от фактического опроса клиента.

`schemaVersion` увеличивается при записи `customMetricsSchema`, но не при изменении project `systemPrompt`, visibility или taxonomy (`service:2646`). `_custom_meta` содержит display metadata, а не полный неизменяемый prompt/rubric. Это частичная provenance, не полноценная воспроизводимость. Published revision должна включать rubric, rules applicability, aggregation, prompt template, taxonomy, model policy и preprocessing version; analysis run фиксирует resolved model и фактические provider settings.

Наличие `quote: string` в Zod ещё не доказывает цитату: поиск подстроки/segment alignment в прочитанном validation-path не найден (`analysis-schema.ts:398`). Следует проверять существование evidence в канонической транскрипции, границы времени и роль; отдельно маркировать вывод без прямой цитаты. Невалидную custom metric код превращает в `null` с `_custom_invalid`, что лучше выдуманного нуля; в новом UI это должен быть видимый partial result.

### 3.3. Dashboard и drilldown

Положительный UX: operator → metric → evidence → call; topic → calls; back-stack и bounded sample с предупреждением (`lib/operator-evidence.ts:6`, FE `model/panelStack.ts`). Evidence в aiPBX ограничен пятью примерами на метрику и по умолчанию 300 звонками; ограничение отображается, но не заменяет полные агрегаты.

Ограничения: часть dashboard агрегирует загруженные страницы целиком в память (`service:3470`); tag/distribution filtering имеет hard limits 5000, поиск transcript — 500 (`service:1835`, `:1890`; `dashboard-aggregation.ts:406`). Для большого объёма такой срез нельзя выдавать за полный набор. Нужны SQL/materialized aggregates, cursor pagination и явная точность/полнота результата.

Custom metric `line-chart` берёт `point.callsCount`, а не историю выбранной метрики ([useWidgetData.ts:211](C:/Users/Professional/WebstormProjects/aiPBX/src/features/OperatorAnalytics/ui/DashboardBuilder/useWidgetData.ts:211)). Перенос UI без semantic verification воспроизведёт вводящий в заблуждение график.

## 4. Критичные конструкции, которые нельзя переносить

| Приоритет | Наблюдение в коде | Последствие / требование к новому модулю |
|---|---|---|
| P0 | API body `projectId` перекрывает project токена (`controller:200`, `:259`); pipeline загружает `projectRepository.findByPk` (`service:595`, `:1025`) | Не найден owner/project-scope check на этом ingestion-path. Возможны чужой prompt/taxonomy и отправка webhook чужому проекту. Все записи и задания получают tenant из verified principal, project проходит ownership + token scope проверку до постановки |
| P0 | `generateApiToken` сохраняет raw token (`service:3330`), guard ищет его напрямую (`guards/api-token.guard.ts:34`), хотя model комментарий говорит «hashed» | Новый secret показывать один раз, сохранять hash+prefix, scopes, expiry, revoke/rotation; project-scoped ключ не может выбирать другой project |
| P0 | `sanitizeUrl` только исправляет протокол и пробелы (`service:345`); axios downloads follow 5 redirects; TLS validation отключена по умолчанию (`service:4136`) | URL ingestion и webhooks должны использовать контролируемый egress: допустимая схема, DNS/IP validation, повторная проверка redirect, закрытие private/metadata destinations; доверенная private PBX через отдельно настроенный connector, проверенный CA |
| P0 | `Map` + fire-and-forget batch (`service:122`, `:900`), аудиобуферы в RAM | Crash/redeploy теряет задания/буферы. `202` только после durable record+asset+outbox; leased worker, retry/backoff, cancellation, DLQ, recovery |
| P0 | `chargeCost` выполняется до результатов; `COMPLETED` выставляется до CDR/analytics/metric/billing writes (`service:660`, `:668`, `:700`, `:725`) | Ошибка между стадиями даёт списание без полного результата и неоднозначный retry. Terminal result + usage settlement + outbox должны фиксироваться атомарно либо через явно восстанавливаемую saga |
| P0 | Debit externalId = `usage_operator_${Date.now()}_${userId}` (`service:3944`) | Повтор одной работы имеет новый idempotency key. В `UsersService` транзакция и externalId dedup есть (`users.service.ts:678`), но вызывающий код не использует стабильный ключ операции. Новый ключ: tenant + run + attempt/charge purpose, unique constraint |
| P1 | Dedup ищет только completed по user/project/audio hash (`service:3488`) | Не предотвращает одновременно запущенные дубли; может вернуть оценку старой версии rubric. Разделить ingress idempotency и artifact cache key, включающий pipeline/version/model/options; не объединять разные business call IDs |
| P1 | Учёт usage возвращает только последний успешный `parsedResult.usage` после repair/diarization retries (`service:4019`, `:4045`, `:4078`) | Стоимость всех попыток, fallback и failed provider calls не видна. Нужен отдельный UsageAttempt ledger и прозрачное правило продажи повторов |
| P1 | Webhook — 3 in-process попытки, custom headers, затем только log (`service:3245`) | Нет persistent delivery history, eventId/signature/replay и гарантии после restart. Нужен outbox, HMAC, bounded retries, DLQ и ручной replay |
| P1 | `checkBalance` проверяет лишь `balance > 0` (`service:3829`); бюджет проверяется после обработки (`service:740`) | Это alert, не hard quota. Перед дорогой работой нужна admission/reservation policy; hard stop и budget notification — разные параметры |
| P1 | normalized metric dual-write удаляет/вставляет значения и глотает ошибку (`service:3759`) | JSON и SQL aggregates расходятся. Нужен один canonical result + transactional projection / repairable projection watermark |
| P1 | Шифрование опционально и fail-open без ключа (`lib/transcript-crypto.ts:59`), key fallback от JWT; SQL LIKE продолжает искать ciphertext (`service:1884`) | Нужны explicit data classification, key management, truthful encrypted search strategy, log redaction; quotes/summary/audio охватываются общей retention policy |
| P1 | Metric preview использует один hardcoded demo transcript и direct JSON.parse (`service:2878`, `:2905`) | Не валидирует применимость к собственным звонкам и production schema. Preview должен использовать тот же engine и пользовательский sample corpus с отображением стоимости |
| P2 | XLSX formula guard применяется к tags; transcript/keywords/summary остаются без общего text-cell policy (`FE/features/Calls/lib/callsExportSheet.ts:85`, `:246`, `:251`) | Для любого export нужна единая проверка ячеек/формул и server-side permissions; статус исторического GAP-31 подтверждается кодом |

Это findings статического аудита, а не результаты эксплуатации. Source credentials и значения окружения не читались и не публиковались.

## 5. GSD: что считать источником истины

`FE/.planning/STATE.md` указывает phase 11 in_progress, но состояние отдельной аналитической фазы нельзя выводить из общего completed_phases.

В [10-10-SUMMARY.md:79](C:/Users/Professional/WebstormProjects/aiPBX/.planning/phases/10-speech-analytics-ux-overhaul-operator-drill-down-call-tags-t/10-10-SUMMARY.md:79) явно записан checkpoint: задачи 1–2 готовы, human UAT отсутствует. Summary сообщает 208 locale tests и OpenAPI checks, но не подтверждает реальный audio→STT→LLM→dashboard E2E. В `10-VALIDATION.md` frontmatter `nyquist_compliant: false`, а нижний checklist утверждает установку true — ещё один пример drift артефактов.

`FE/.planning/GAPS.md` и `codebase/CONCERNS.md` частично устарели:

- Утверждение о stub custom aggregates уже не соответствует `useWidgetData.ts:149` и `03-01-SUMMARY.md:13`.
- Redis insights cache уже реализован (`BE/src/operator-analytics/insights-cache.service.ts:17`), хотя при отсутствии Redis есть in-memory fallback; это не означает durable очередь анализа.
- Offline eval harness существует, но corpus ограничен двумя sample fixtures. `eval/run-eval.ts` возвращает ошибку только при техническом failure, не при нарушении MAE/accuracy target.
- `CONCERNS.md` содержит исторические падения FE/BE тестов на дату 2026-06-24. Свежий статус не проверялся; нельзя переносить в новый план ни «всё зелёное», ни «всё ещё сломано» без запуска.

Нужная дисциплина для Krasterisk: requirement → implementation → reproducible automated evidence → runtime/UAT evidence, с датой и SHA. Completion summary не заменяет acceptance gate. Общие milestone planning не переписывать по старым `.idea`-наброскам.

## 6. Что переносить как идеи, что писать заново

**Адаптировать:** metric type/range/polarity; immutable provenance как развитие текущих snapshots; проверяемые schema outputs; quality gate; separation process/outcome; channel diarization helpers как reference algorithms; manual corrections отдельно от AI; topic vocabulary; drilldown c evidence; bounded sample UX; usage breakdown; eval statistics.

**Писать заново в архитектуре Krasterisk:** domain entities `RecordingAsset/AnalysisRun/ProjectVersion`; public integration principal; durable ingestion/workers; transactional settlement; secure egress; versioned API/webhook delivery; tenant-aware storage; query/aggregate layer; licensing и самостоятельная работа без внутренней PBX.

**Не наследовать:** многотысячный orchestration-service, raw tokens, owner-only идентификацию tenancy, PBX/channelId как первичный ID standalone analytics, in-memory очереди, mutable scoring history, default insecure TLS, N/A=100, незаметное смешение versions/scales, LLM speaker labels как гарантированную акустическую истину, отсутствующие данные как ноль.

Следующий контракт продукта — `ANALYTICS-SPEC.md` этой инициативы. Общая маршрутизация, запись Asterisk и коммерческая инфраструктура описываются отдельными документами инициативы.
