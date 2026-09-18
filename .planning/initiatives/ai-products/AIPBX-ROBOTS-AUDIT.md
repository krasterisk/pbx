# Аудит AI-роботов aiPBX для Krasterisk v4

Дата: 2026-09-18. Статус: анализ исходного кода и артефактов, не приёмка работающей системы.

## Границы и достоверность

Указанный в запросе каталог `C:\Users\Professional\WebstormProjects\aiPBX\_backend` отсутствует. Фактический backend — `C:\Users\Professional\WebstormProjects\aiPBX_backend`; это подтверждено `aiPBX/aiPBX.code-workspace:10` и `aiPBX/.planning/PROJECT.md:15`. Далее:

- **BE** = `C:/Users/Professional/WebstormProjects/aiPBX_backend/`.
- **FE** = `C:/Users/Professional/WebstormProjects/aiPBX/`.
- Запись `BE/src/...:123` означает точный файл и строку в этом каталоге на дату аудита.
- **Факт** — непосредственно прочитанный код. **Артефакт** — заявленное в GSD/документации. **Вывод** — следствие статического анализа, ещё без воспроизведения на стенде. **Рекомендация** — проектное предложение для Krasterisk v4.

Исходники aiPBX не изменялись; `.env` и содержимое секретов не читались. Не запускались сервисы, провайдеры, звонки, миграции, установки пакетов и тесты исходного проекта. Для нынешнего аудита не проверялись production, качество распознавания, реальные задержки, коммерческие тарифы и полнота совместимости с внешними АТС. Найденные дефекты — ограничения пригодности донора, а не утверждение о произошедших инцидентах.

## Главный вывод

aiPBX полезен как библиотека проверяемых продуктовых идей и отдельных технических решений. Он уже содержит оба голосовых режима, настройки ассистента, SIP-публикацию, браузерное тестирование, функции, MCP, RAG и учёт использования. Копирование runtime целиком перенесёт ошибки изоляции звонков, гонки аудио, неполную авторизацию ресурсов и связь бизнеса с транспортными деталями.

Для Krasterisk v4 следует заново реализовать домен **AI-роботов**, независимо от сценарных `voiceRobots`, с переиспользованием инфраструктуры целевого проекта. Схема каскада: **VAD → STT → LLM → TTS**. В исходном пользовательском перечислении STT/TTS были переставлены; распознавание предшествует LLM, синтез следует за ним. Realtime speech-to-speech — отдельный адаптер того же домена, со своими возможностями VAD, транскрипции и управления ответом.

## Что реально существует

| Область | Факт кода | Ограничение / значение для переноса |
|---|---|---|
| Ассистент | `BE/src/assistants/assistants.model.ts:15`: prompt/instruction, greeting, model, voice, VAD, interrupt, tools, MCP, pipelineMode, STT/LLM/TTS | Одна изменяемая запись. Отдельных draft/published revision в проверенных модели, сервисе и DTO нет |
| Realtime | `BE/src/open-ai/realtime-model.adapter.ts:13`: интерфейс адаптера; OpenAI, Qwen и Yandex реализации | Хорошая идея capability/format адаптера. Имена моделей/формат API из донора нельзя считать актуальным каталогом |
| Подключение к модели | `BE/src/open-ai/open-ai.connection.ts:23`: ограниченные reconnect attempts, backoff, fatal-stop; `realtime-vendor.resolve.ts` | Полезны классификация фатальных ошибок и предотвращение reconnect storm. Нужна явная семантика восстановления диалога, а не только переподключение WS |
| Каскад | `BE/src/non-realtime/non-realtime.service.ts:30`, `:255`: STT → streaming LLM → TTS по предложениям | Есть интерфейсы провайдеров, но runtime требует переработки изоляции, отмены, очереди воспроизведения и tool loop |
| Аудио-native LLM | `BE/src/non-realtime/non-realtime.service.ts:271`: отдельная проверка `isAudioLlmProvider`, пропуск STT | Подтверждено наличие ветки, а не качество/доступность конкретной модели. Не делать обязательным первым релизом |
| Телефония | `BE/src/ari/call-sessions.ts:58`, `:130`: CallSession, mixing bridge, ARI externalMedia, PCMA/alaw; `ari-connection.ts:265`: ассистент из Stasis args | Отделение жизненного цикла звонка от модели полезно; фактическая реализация смешивает их через OpenAiService |
| Передача / завершение | `BE/src/mcp-client/services/tool-gateway.service.ts:91`, `:223`: builtin hangup/transfer через события | В cascade есть ошибка подписки обработчиков; нельзя считать parity между режимами готовой |
| Внешние SIP-транки | `BE/src/sip-trunks/sip-trunks.model.ts:12`, `:38`: registration/IP и UDP/TCP/TLS; связь с assistant | Управление удалённой PBX завязано на частный REST action API и слабый токен. Потребительский сценарий пригоден, реализация интеграции — нет |
| Внешний voice API | `BE/src/voice-session/voice-session.gateway.ts:17`, `:33`: `/voice`, API key scope; `voice-session.service.ts:38`: owner check, sample-rate negotiation | Реальный внешний контракт, но сервис всегда вызывает nonRealtimeService: это не универсальный realtime API |
| Tools | `BE/src/mcp-client/services/tool-gateway.service.ts:66`: единая точка builtin → Telegram/Composio/Bitrix → MCP → webhook | Переиспользовать идею gateway, убрать vendor-specific dispatch из core, укрепить проверку разрешений |
| MCP | `BE/src/mcp-client/services/mcp-client.service.ts:251`: registry, policies, вызов, журнал; `mcp-connection-manager.service.ts:54`: RPC timeout для WS | Самодельные протоколы HTTP/WS, ограниченное согласование возможностей, неполное распространение политик |
| RAG | `BE/src/knowledge/knowledge.service.ts:174`: embed query → pgvector search; `ai-tools-handlers.service.ts:89`: tool retrieval | Есть file/URL ingestion, chunk/embed, top-K и metadata. Не переносить SQL pgvector в MySQL основную БД Krasterisk без отдельного решения о хранилище |
| Учёт | `BE/src/open-ai/open-ai.service.ts:449`: usage realtime; `non-realtime.service.ts:696`: text token accumulation; `billing.service.ts:281`: finalize | Для полноценного каскада нужны ещё STT seconds, TTS characters/audio duration, GPU, storage, tools. Пользовательская цена и себестоимость — разные записи |
| UX | `FE/src/features/AssistantSettingsForm/`, `PlaygroundSession/ui/{CallCenter,SetupSheet,DebugSheet}` | Прогрессивное раскрытие настроек и отдельный debug хороши. Миграция UI aiPBX в Krasterisk запрещена без адаптации к его shared/ui/FSD |

## GSD: что брать из артефактов и чему не доверять автоматически

Общий root `FE/.planning/` покрывает оба репозитория. `PROJECT.md` задаёт продуктовый инвентарь, `ROADMAP.md` — последовательность, `codebase/` — снимок реализации, `intel/` — продуктовый контекст. Сам `ROADMAP.md` прямо объявляет приоритет codebase map при расхождении с intel. Это полезная дисциплина, но карта датирована 2026-06-24 и не является live-истиной.

`FE/.planning/codebase/CONCERNS.md` перечисляет долг, например отсутствие FE `.env.example`, падающие тесты и неполный frontend. В текущем дереве `.env.example` уже существует, а более поздний `STATE.md` заявляет выполненную engineering foundation. Эти утверждения нельзя без перепроверки включать в список текущих дефектов. В настоящем отчёте существенные риски проверены в коде.

По `FE/.planning/STATE.md:5–30` Phase 11 ещё **Executing**, остановка после `11-04-PLAN.md`. `11-05-PLAN.md` содержит закрывающий аудит локалей, удаление старого UI и manual WebRTC UAT. Поэтому современный Playground уже виден в коде, но нельзя объявить всю фазу проверенной только по наличию компонентов.

Для планирования полезны:

- `FE/.planning/phases/11-playground-ux-redesign-for-voice-assistant-testing/11-CONTEXT.md`: Call-first, Setup по запросу, Debug скрыт, ошибки микрофона, мобильный поток, запрет менять настройки во время звонка.
- `11-UI-SPEC.md`, `11-RESEARCH.md`, `11-VALIDATION.md`: связь решений с UI, проверками и ручной телефонией.
- `11-01-PLAN.md`…`11-05-PLAN.md`: малые планы с зависимостями и критериями; не импортировать номера фаз и project state в Krasterisk.
- `FE/.planning/scenarios/krasterisk-helpdesk-voice-assistant.md`: пример законченного бизнес-сценария с tools; он не заменяет multi-tenant security contract.

**Рекомендация:** сохранять decisions → requirements → plans → implementation → evidence/UAT, но не переносить чужой roadmap как источник требований. Для Krasterisk нужны собственные AI-SPEC, UI-SPEC, performance/audio fixtures и eval datasets. Статусы «код есть», «моки зелёные», «стенд пройден», «принято в production» должны различаться.

## Решения, которые стоит адаптировать

### 1. Единый домен и несколько транспортов

В доноре один assistant может попасть в звонок, playground, widget или внешний voice WS. Это правильное продуктовое направление. Однако источник определяется по префиксу `channelId` (`playground-`, `voice-`) в `non-realtime.service.ts:91`, `:518`, `:723`. Так transport concerns проникают в генерацию речи и учёт.

Предлагаемый контракт: `VoiceSessionContext { sessionId, tenantId, agentVersionId, ingressKind, telephonyCallId?, sourceConnectionId?, capabilities }`. Runtime выдаёт нормализованные события/аудио; Asterisk, browser и external adapter преобразуют их. Бизнес-функции hangup/transfer используют интерфейс управления звонком, независимо от realtime/cascade.

Сценарный робот и AI-робот остаются разными сущностями. Общими могут быть ARI connection management, MediaSession, CDR correlation, recording readiness, provider credentials и метрики. Разделение доменов не требует второго конкурирующего ARI-слушателя или параллельного dialplan engine.

### 2. Настраиваемый pipeline и capability negotiation

Полезны интерфейсы `BE/src/non-realtime/interfaces/*` и `RealtimeModelAdapter`. Следует заменить разрозненные строковые поля схемой, валидируемой по capabilities провайдера: input/output codec и sample rate, streaming, tool calls, server/semantic VAD, cancellation, usage units. Конкретные модели должны приходить из существующего каталога провайдеров целевого проекта.

Для realtime и cascade должна выполняться одна продуктовая приёмка: первое приветствие, перебивание, передача оператору, завершение, tool, KB, usage, журнал. Формально переключить `pipelineMode` недостаточно.

### 3. Быстрый первый звук без нарушения порядка

`non-realtime.service.ts:337–354` накапливает LLM tokens до предложения и запускает TTS сразу. `:674` имеет fallback разреза длинной фразы по запятой. Идея уменьшает ожидание первой реплики.

Адаптация: ограниченный prefetch синтеза + **строго упорядоченная** очередь воспроизведения, идентификатор turn/generation, отмена всех результатов старой генерации, независимые события synthesis-ready/playback-start/playback-end. Можно готовить следующее предложение параллельно, но выдавать только в порядке текста. Буферы ограничиваются миллисекундами аудио, а не произвольным количеством chunks.

### 4. Единая обработка tools и поиск знаний как tool

Gateway снижает расхождения realtime/cascade, а RAG по запросу не раздувает prompt всем содержимым базы. Ingestion и serving поиска уже разделены по функциям. Сохранить этот принцип.

Новый gateway должен проверять tenant, привязку tool к **опубликованной версии** агента, JSON Schema, права на конкретный ресурс, timeout, side-effect policy, число вызовов/денежный бюджет. Результат — структурированный envelope со статусом, сокращённым safe output и audit id. Повторы side-effect tools требуют idempotency key; отмена LLM не означает отмену уже выполненного внешнего действия.

Для MCP использовать один согласованный protocol client, isolated connector configuration, короткие голосовые deadlines и circuit breaker. Подтверждение опасного действия должно иметь реальный lifecycle requested/approved/denied/expired, если этот режим предлагается в UI.

Для KB: источники и citations, версии документов/индекса, tenant-фильтр на ingestion/search, обработка untrusted content, воспроизводимость retrieval. Из aiPBX переносится замысел, не непроверенная уверенность `similarity * 100`.

### 5. Playground как этап публикации

Полезны минимальный Call screen, полная форма только в Setup, Debug drawer, replay последнего теста, ясные ошибки. Проверены `FE/src/features/PlaygroundSession/model/useAutosaveAssistant.ts:35` (failure blocks start) и соответствующие tests.

Но сохранение напрямую в текущего assistant не подходит коммерческому управлению релизом агента: тестовая правка prompt не должна незаметно менять новые реальные звонки. Нужны draft + immutable published version + явное «Опубликовать», session snapshot и rollback. Autosave применяется к **draft**, Start тестирует выбранный draft/version, production ingress использует published pointer.

## Анти-паттерны и конкретные риски

### R1. Общая память VAD между звонками — высокий приоритет

**Факт:** `non-realtime.module.ts:37` создаёт один `SileroVadProvider`, `non-realtime.service.ts:35` хранит его один раз; provider хранит и обновляет recurrent `_h`, `_c` в `vad/silero-vad.provider.ts:19–20`, `:101–109`. `processSamples` не принимает session id. Звонки используют один stateful object.

**Вывод:** история аудио одного звонка влияет на решения VAD другого; возможны гонки state при одновременных `session.run()`. Это не утверждение, что сами PCM-пакеты передаются соседу, но изоляция алгоритма нарушена.

**Рекомендация:** shared immutable model + per-session recurrent state и последовательная обработка frames для каждой сессии. Добавить interleaved two-call fixtures. Параметры VAD должны действительно применяться по агенту: сейчас module init threshold=0.5, а пользовательские настройки передаются не полностью.

### R2. Неоднозначная привязка RTP за NAT — критично для multi-tenant

**Факт:** `BE/src/rtp-udp-server/rtp-udp-server.service.ts:57–76`: неизвестный address:port привязывается к первому session, который ещё не получил RTP. Нет доказательства соответствия конкретному вызову/тенанту. Новый map key добавляется, старый остаётся; cleanup `:204–225` удаляет один найденный key.

**Вывод:** при нескольких звонках возможна неверная маршрутизация чужого аудио; restart/cleanup может оставлять алиасы. Это нельзя переносить как NAT workaround.

**Рекомендация:** отдельный media allocation на вызов, подтверждённое сопоставление ARI external channel/портов/адресов, контролируемый symmetric RTP, явное удаление всех индексов. Unknown packets отвергать. Защиту периметра и SIP edge вынести в отдельный контракт.

### R3. Потери аудио под нагрузкой и неполный RTP parser

**Факт:** `rtp-udp-server.service.ts:147–165` пропускает новый входной audio event, когда channel уже в `activeChannels`, вместо очереди. `audio/audio.service.ts:24–25` просто удаляет 12 bytes RTP header; не разбирает CSRC/extensions/padding/sequence. `resampleLinear` в том же сервисе — простой linear resampler.

**Вывод:** при медленном VAD/обработчике теряются пакеты, а расширенные RTP headers интерпретируются как аудио. Простая ресемплизация должна оцениваться тестами на реальном голосе, а не считаться качественным DSP.

**Рекомендация:** bounded per-session queue, jitter/reorder policy, drop counters, корректный parser, осмысленная overflow policy и проверенные кодеки/resampling. Для первого релиза документировать поддержанные transport/codec/sample-rate пары.

### R4. Неполное прерывание и гонки TTS

**Факт:** `non-realtime.service.ts:350`, `:477` запускает TTS без ожидания. `:532`, `:580` общий флаг `isSpeaking` выставляется каждой задачей; одна задача может снять его, пока другая ещё звучит. На speech start `:209–219` pipeline отменяется только при `isSpeaking`; фаза STT/thinking не защищена тем же условием. `NonRealtimeSession:75–76` считает prefix frames по 30 ms, хотя `NonRealtimeService:138–140` обрабатывает 96 ms.

**Вывод:** возможны порядок «вторая фраза раньше первой», наложение chunks и поздний ответ предыдущего turn. Реальный prefix 300 ms может стать примерно 960 ms. Это подтверждённое несоответствие frame accounting, не измеренный latency результат.

**Факт:** realtime `open-ai.service.ts:335` очищает локальный output/отменяет response, но в проверенном файле нет `conversation.item.truncate`/played-audio cursor. `widget/widget-webrtc.service.ts:203` оставлен TODO очистки browser audio buffer.

**Рекомендация:** turn state machine; interrupt всегда по active generation, played-audio accounting, provider-specific truncation по capabilities, cancellation STT/LLM/TTS/tool ожиданий, per-device buffer flush и обязательный тест «перебил в первые 100 ms / при долгом tool / в последнем слове».

### R5. Hangup/transfer не равнозначны между pipeline

**Факт:** `ari/call-sessions.ts:59–92` вызывает `registerOpenAiHandlers()` только в realtime branch; подписки `transferToDialplan`/`HangupCall` находятся внутри этого метода `:123–127`. Cascade `buildTools()` всё равно предлагает эти функции (`non-realtime.service.ts:609–644`), gateway генерирует те же события.

**Вывод:** в исследованном ARI пути cascade может сообщить о передаче/завершении, не выполнив действие. Gateway также возвращает «Call transferred» сразу после event emit, не подтверждая успешный ARI redirect (`tool-gateway.service.ts:249`).

**Рекомендация:** transport-independent CallControlPort с подтверждённым результатом и allowlisted destinations; одинаковые acceptance scenarios обоих pipeline. При внешней PBX стратегия transfer (SIP REFER либо перевод через собственный ingress) задаётся capabilities connection.

### R6. Авторизация объектов не следует за authentication

**Факт:** `assistants.controller.ts:80–83`, `:92–95` не передаёт владельца в update/delete; `assistants.service.ts:115–131`, `:147–151` ищет/удаляет по id и связывает произвольные tool/MCP ids. `auth/roles.guard.ts:48–52` проверяет роль, не ownership assistant.

**Факт:** `knowledge.controller.ts:75–79`, `:148–158` list documents/search не принимает пользователя; `knowledge.service.ts:82–88`, `:174–198` фильтрует только knowledgeBaseId. Upload/addUrl сохраняет указанный KB id без проверки принадлежности KB (`knowledge.service.ts:90`, `:119`). RAG handler принимает KB ids из tool config и не передаёт tenant (`ai-tools-handlers.service.ts:104`).

**Факт:** `mcp-client.service.ts:258` выполняет unscoped findByPk serverId; переданный userId используется для политики/журнала, но нет проверки ownership server и доступности tool именно этому assistant.

**Вывод:** в проверенных путях отсутствуют обязательные resource authorization checks. Необходимо считать это блокирующим для копирования, не полагаться на скрытие в UI или на то, что модель обычно вызывает только показанные ей tools.

**Рекомендация:** следовать правилам Krasterisk `vpbx_user_uid` в обязательном контексте каждого сервиса; проверять связи и nested resources; негативные cross-tenant tests для CRUD, stream start, tool calls, KB search, attachments и logs.

### R7. Tool gateway пока не security boundary

**Факт:** `tool-gateway.service.ts:91–180` dispatch builtin/direct integrations до MCP policy path. `mcp-policy.service.ts:38` require_approval лишь бросает ошибку; inbox/approval/resume отсутствуют в этом path. Rate limiter `:65–75` считает все successful calls пользователя, не фильтрует toolRegistryId и не атомарен. `parseArguments()` gateway возвращает `{}` при malformed JSON. `non-realtime.service.ts:497–500` рекурсивно вызывает tools без максимума шагов.

**Рекомендация:** deny-by-default единый authorization/policy слой для всех tool типов; schema validation до исполнения; лимиты шагов, времени, стоимости и output bytes; классификация read/write; реальный approval flow либо честное состояние «автоматическое исполнение запрещено». Не сообщать модели об успехе по одному факту постановки действия в очередь.

### R8. Самодельный MCP и доверенные внешние URL

**Факт:** `mcp-connection-manager.service.ts:207`, `:293`, `:318` жёстко использует protocol version; HTTP request получает целый response как text и извлекает SSE после завершения (`:322–340`). Наличие HTTP/SSE parser не доказывает полную реализацию Streamable HTTP lifecycle/resumption. В проверенных HTTP-запросах не видны ограничения egress и размера ответа.

**Факт:** `knowledge/parser.service.ts:44–59` fetch произвольного URL, 30 s timeout, чтение полного тела; `ai-tools-handlers.service.ts:53–69` обращается к сохранённому webhook без local URL policy/response cap. В последнем timeout не задан на уровне вызова; глобальную конфигурацию HttpModule этот аудит не устанавливает.

**Рекомендация:** новый MCP adapter по поддерживаемому SDK/protocol после отдельной проверки официальной документации; запрет private/metadata destinations по умолчанию для внешнего fetch, контроль DNS/redirects, allowlisted internal connectors как явная конфигурация, response caps и deadlines. Встроенные PBX tools — через внутренние typed ports, не HTTP к произвольному localhost.

### R9. SIP publication tied to legacy PBX management

**Факт:** `sip-trunks.service.ts:98`, `:171` вызывает `https://{sip_host}/api/?action=...`; `:294–297` Bearer token — SHA-256 комбинации идентификатора/адреса/serverId/userId без секрета. Это не криптографическое подтверждение полномочий. `sip-trunks.model.ts:46–48` хранит password строкой, в inspected model нет encryption transformer.

**Рекомендация:** переиспользовать управление транками/credential storage Krasterisk. Внешняя PBX подключается к service SIP endpoint через стандартный ingress/ACL/credential contract. Не требовать, чтобы каждая внешняя АТС реализовала частный API aiPBX. TLS в enum само по себе не доказывает SRTP, certificate validation или устойчивость к toll fraud.

### R10. Неполный учёт, неограниченное состояние и логи

**Факт:** runtime хранит live sessions в Map (`open-ai.service.ts:59`, `non-realtime.service.ts:32`, `voice-session.service.ts:29`); provider send queue — массив (`open-ai.connection.ts:28`). `NonRealtimeSession.trimHistory():183` ограничивает сообщения количеством 50, а не токенами/целыми tool exchanges. `speechBuffer` не имеет видимого лимита максимальной непрерывной речи.

**Рекомендация:** live audio state остаётся локальным владельцу worker — переносить PCM в Redis не следует. Нужны session ownership/lease, capacity routing, bounded buffers, durable summary/events/usage, termination reconciliation при падении. History trimming сохраняет целые assistant-tool-result группы, prompt version и token budget.

**Факт:** cascade usage содержит только сумму prompt/completion (`non-realtime.service.ts:696`); provider audio/STT/TTS не учитывается здесь. У billing есть полезный idempotent debit: `billing.service.ts:466–470` передаёт стабильный externalId, `users/users.service.ts:697–719` проверяет его. Не следует неверно объявлять весь billing неидемпотентным. Однако накопление usage (`billing.service.ts:235–251`) не имеет event id и может повторно учесть доставленный второй раз usage event; ошибки проглатываются.

**Рекомендация:** append-only usage events с provider/session/response id, отдельные rate-card snapshots, reservations и reconciler. Commercial quotas проверяются при старте и в процессе, а не только в конце звонка. Разделять input/output/cached/audio/STT/TTS units.

**Факт:** prompt excerpt и STT text логируются (`non-realtime.service.ts:298`, `:327`); tool arguments/result пишутся в журнал gateway. В `mcp-crypto.service.ts:30` есть fallback-derived encryption key, включая статический fallback.

**Рекомендация:** redaction/retention/role-based visibility для transcript/tool traces; обязательный ключ шифрования без fallback; данные тестовых и production sessions под одной tenant isolation policy.

## Матрица переноса

| Находка | Решение | Как именно |
|---|---|---|
| Realtime/cascade interfaces | **Адаптировать** | Typed provider capabilities и общая VoiceSession; совместить с AI provider registry Krasterisk |
| ARI bridge/externalMedia lifecycle | **Адаптировать идею** | Интегрировать с действующим ARI целевого проекта; новые session ownership и cleanup guarantees |
| Audio format conversion | **Проверить и адаптировать** | Набор golden audio fixtures и quality/performance comparison; не копировать UDP server целиком |
| Prefix buffering / early sentence TTS | **Адаптировать алгоритм** | Корректная длительность frames, ordered playback, generation cancellation |
| Reconnect fatal classification | **Адаптировать** | Ограниченный backoff + conversation recovery/transfer policy + tests |
| ToolGateway | **Адаптировать архитектуру** | Единая policy, auth, schema, idempotency, budgets; plugins для vendor integrations |
| RAG tool + source ingestion | **Адаптировать** | Tenant-safe document versions, indexing queue, retrieval provenance; explicit vector-store ADR |
| Scoped hashed API keys | **Использовать паттерн** | `BE/src/api-keys/api-key.service.ts:27–44`, `:86–106`; совместить с auth/keys Krasterisk |
| Call/Setup/Debug UX | **Адаптировать продуктовый подход** | Krasterisk shared/ui, draft autosave + явная публикация, accessibility и RU/EN |
| GSD decisions/plans/validation | **Адаптировать workflow** | Собственные требования, evidence и acceptance gates в инициативе |
| NAT first-unclaimed-session match | **Отклонить** | Неприемлемая неоднозначность аудио/тенанта |
| Singleton recurrent VAD | **Отклонить** | Per-session state |
| Fire-and-forget TTS и безлимитный tool recursion | **Отклонить** | Управляемые очереди, bounded agent loop |
| Prompt как mutable production row | **Отклонить для нового продукта** | Immutable agent versions, test/publish/rollback |
| Частный SIP management token | **Отклонить** | Стандартный ingress + проверенная server auth |
| Самодельный MCP + regex text tool calls | **Отклонить как базовый протокол** | Protocol SDK/typed calls; legacy compatibility только за явным adapter с тестами |
| Tenant filtering только в части контроллеров | **Отклонить** | Обязательный tenant context на каждом resource operation |
| Импорт React/MUI/redesign-v3 целиком | **Отклонить** | Собственная UI-система/FSD Krasterisk; не переносить ещё одну генерацию UI |

## Проверки, без которых нельзя принимать AI-роботов

Существующие tests полезны, но не подтверждают системную готовность. `BE/src/voice-session/voice-session.service.spec.ts:60–128` покрывает ownership, sample rates и forwarding. `open-ai/open-ai.connection.spec.ts:127` покрывает reconnect storm/fatal guard. `knowledge/knowledge.service.spec.ts:127–163` проверяет ownership update/delete, но это не закрывает перечисленные search/upload paths. По поиску в `BE/src/non-realtime/` нет собственных `*.spec.ts`; тесты VoiceSession mock-ят каскад. Реальное аудио, concurrency и interleaved VAD ими не проверены.

Для планов Krasterisk обязательны следующие самостоятельные критерии:

1. Два и более одновременных звонка: изоляция VAD/PCM/transcript/tools/usage, NAT, завершение одного без влияния на другой.
2. Ordered TTS и barge-in: отмена STT/thinking/streaming/playback, нулевое воспроизведение результата старого turn после отмены, аудио samples/clock accounting.
3. Mock provider contract suite + opt-in live compatibility tests для каждой реально поддержанной модели. Провайдеры не вызываются обычным CI без разрешённых стендовых credentials/budget.
4. Внутренний маршрут и внешний SIP-транк достигают одного published agent runtime; стабильный external call id; transfer/hangup подтверждены в realtime и cascade.
5. RBAC/tenant negative matrix для agent versions, tools/MCP, KB, recordings, transcript, costs, API tokens и websocket start.
6. Provider failure: истёкшая сессия, auth/rate limit, потеря сети, зависший tool/TTS, termination/retry без повторного side effect или списания; fallback на оператора/сообщение задаётся политикой.
7. Crash/restart: cleanup ARI/external channels, зафиксированный session outcome, reconciliation usage/recordings; active audio session не обещается восстанавливать бесшовно без отдельного доказательства.
8. Security of tools/RAG: prompt injection в tool result/KB не даёт новые полномочия, schema и per-agent allowlist соблюдаются, unsafe URL отсекаются, citations отслеживаются.
9. Product evals: task success, фактические ошибки, корректность tools, grounded answers, handoff quality, RU speech cases; latency p50/p95, first audio, interruption latency, WER/слотовые ошибки на телефонном аудио. Численные SLO устанавливаются по собственному стенду.
10. Промпты: draft test, publish, rollback; начавшийся звонок сохраняет snapshot версии; аналитика и отчёты знают точную версию агента.

Результат аудита поддерживает реализацию новой фичи по фазам. До выбора конкретных SDK/моделей и инфраструктуры требуется отдельный проверяемый architecture/spike этап; наличие аналогичной кнопки в aiPBX не является свидетельством пригодности её серверной реализации.
