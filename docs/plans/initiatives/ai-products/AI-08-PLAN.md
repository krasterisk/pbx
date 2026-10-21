---
initiative: ai-products
phase: AI-08
revision: 2026-09-18-r3
status: planned_dependency_gated
tasks: [RT1, RT2, RT3, RT4, RT5]
depends_on: [AI-07]
---

# AI-08 — realtime, внешний SIP и lifecycle

Чтение: [ROBOTS-SPEC](ROBOTS-SPEC.md), [AI-07](AI-07-PLAN.md), [PROVIDER-MATRIX](PROVIDER-MATRIX.md), [ADVANCED-PRODUCT-CONTRACTS](ADVANCED-PRODUCT-CONTRACTS.md). Требования VR-03/06, завершение VR-09, VR-10/11/12; tool-event parity без полного каталога AI-09. Реальный provider/profile выбирается после AI-00 measurements, не по имени модели или рекламному наличию realtime.

## RT1 — realtime adapter с общим session contract

**Вход:** VR2/3/6 cascade/media/ownership accepted, real provider capability sheet. **Owned paths:** нейтральные `ai-connectivity/voice-model/**` adapters, ai-voice strategy factory, shared normalized events, contract fixtures. Никаких SDK-specific fields в public DTO и зависимости телефонии клиента от API провайдера.

Interface `VoiceModelSession`: open(immutable config), pushAudio(sequence/timestamp), commitInputTurn если capability требует, cancelOutput(epoch), truncatePlayed(outputRef,position), submitToolResult(operationId), close; normalized events inputSpeechStart/End, transcriptDelta/Final, responseAudio/text, toolRequested, usage, error, closed. Capability matrix отдельно automatic/manual endpointing, input transcript, played truncate, max session, reconnect/session resume, tools schema, supported codec/sample rate. Unsupported options block publish или явно недоступны; не silently ignore.

Session фиксирует provider revision/model/config до connect. Server credentials не уходят browser/SIP client. Barge-in по тому же inputTurn/outputEpoch contract VR3: flush local output и cancel/truncate upstream по фактическому played progress; новый caller audio не теряется. Если played boundary нет, history помечена uncertain и runtime не продолжает, притворяясь, что весь ответ услышан. Realtime generated text не называется дословной записью без declared provenance.

Tool events имеют стабильный provider call ID→local operation ID mapping, validation/gateway тот же VR4/AI-09. Duplicate provider event не запускает действие повторно. Usage разделяет measured/final/estimated; reconnect или repeated final usage не делает второй settle. Fatal/auth error не вызывает бесконечный reconnect. Resume возможен только при verified provider resume contract с проверкой turn/side-effect state; v1 default no transparent resume: bounded fallback/transfer/end. Переключение realtime→cascade mid-call disabled до отдельной parity проверки history/audio/usage.

**Приёмка:** replay event traces с out-of-order/duplicate/audio after cancel/tool args malformed, late final usage, provider429/auth/outage, partial transcript, interrupted greeting, max duration. Live same synthetic dialogs cascade vs realtime: task completion и first-played latency, no false played transcript. Не выдавать fixtures за live compatibility.

## RT2 — tenant SIP connections и edge provisioning

**Owned paths:** новый `ai-voice/connections/**`, neutral telephony provisioning adapter, SIP edge composition/driver schema component, shared DTO, dual-DB migrations, deployment/harness. Не требовать у клиента ARI-доступ и внутренние extensions/КЦ.

Таблицы: `ai_sip_connections` (tenant/id/edge_node/label/status/auth_policy/secret_ref/allowed_networks/transport/codec/profile revision), `ai_sip_did_bindings` (connection_id,normalised_did,deployment_id,status; UNIQUE connection/did), `ai_sip_provisioning_operations` (connection/revision/action/digest/state/observed_revision/error; UNIQUE connection/revision/action). Source of truth SQL; node applied config ack отдельный status, HTTP save не равен deployed.

Default profile digest authentication + optional source ACL; SIP credential отдельно от HTTP integration key, encrypted server secret/HA1 по capabilities, one-time выдача клиенту и revoke/rotation. IP-only включается только явно администратором установки для доверенного private/VPN профиля; не anonymous fallback. Ротация создаёт config revision и проверяет applied ack, старый credential удаляется после согласованного bounded transition; отсутствующий ack → not ready, secret не выводить повторно.

Tenant binding идёт из authenticated endpoint/connection + allowed DID. From/Caller-ID/P-Asserted-Identity/header tenant — metadata, не authorization. Endpoint match ambiguity между tenants/IP ranges запрещена preflight. Unknown DID/deployment disabled →reject/fallback только внутри того же tenant. SIP context не имеет выхода в произвольный PBX dialplan, shell/system или платные внешние направления. CPS/concurrent/duration limits до provider и у edge; DTMF/codec/NAT capability profiles measured.

TLS/SRTP supported profile подтверждается стендом, не checkbox promise; insecure transport только явный installation profile с понятными ограничениями и separate readiness. Нельзя ломать чужие transport/trunk configs: generated objects имеют installation+connection namespace и owner revision; delete/drain только свои. Apply config transactional desired-state+outbox, node reconciler идемпотентно converges, partial apply quarantines connection.

Standalone edge может использовать Asterisk/PJSIP собственных узлов без полного пользовательского PBX schema/CDR. Добавляется отдельный SIP schema component в C2 manifest; MySQL/PG provisioning/readiness и relevant DB-03 driver tests обязательны. Existing full-pbx ps tables не создавать второй раз.

Official PJSIP separates endpoint identification and authentication, поэтому matching From/header нельзя принимать за доказанную identity: [configuration relationships](https://docs.asterisk.org/Configuration/Channel-Drivers/SIP/Configuring-res_pjsip/PJSIP-Configuration-Sections-and-Relationships/), [res_pjsip reference](https://docs.asterisk.org/Latest_API/API_Documentation/Module_Configuration/res_pjsip/). Конкретные supported fields проверить по deployed version при исполнении.

**Приёмка:** wrong secret/From spoof/foreign DID, overlapping match rules, NAT/codec, revoke during idle/active call, config partial apply/node reconnect, no anonymous context, two engines, robot-only account без внутренних PBX modules.

## RT3 — внешний call API и управляемые переводы

**Owned paths:** ai-voice integration controllers/invocation repository, neutral originate/control gateway, B2 scopes, delivery events, SQL migration/tests. AutoDial bulk scheduling не копировать.

Canonical public namespace `/api/v1/ai-voice` (ранний `/api/integrations/v1/voice` ещё proposed, не второй alias). GET deployments/sessions `robots:read`; POST sessions `robots:invoke`; POST sessions/:id/actions `robots:control`; transcript/audio требуют `robots:transcript`/`robots:audio`. Grants bound deployment. Read DTO без prompt/tool args/provider/SIP secret/free-text transcript при отсутствии content scope.

`POST /sessions` accepts deploymentId, destinationRef или validated destination внутри server outbound policy, externalCallId, variables schema, Idempotency-Key; 202 после `ai_voice_invocations`+quota+outbox transaction. Таблица unique stable principal/deployment/externalCallId + request hash, deterministic channel correlation; status accepted/originating/ringing/answered/failed/outcome_unknown/cancelled, sessionId после allocation. Повтор ключа/бизнес-ID не делает второй originate, другой payload409. Max concurrency/CPS/daily destination budget, allowed caller IDs/routes и normalisation проверяет gateway; ни model, ни caller не задают raw PJSIP dial string.

Robot-only single-call API использует нейтральный originate gateway без покупки AutoDial. Если actor=AutoDial, **только attempt owner** инициирует вызов; invocation adapter привязывает existing attempt, не дублирует originate. DNC/schedule/pacing/retry AutoDial остаются его ответственностью; direct API проверяет собственную разрешённую destination/consent policy, не выдаёт права массовой кампании.

Network timeout originate: reconcile deterministic channel/session identity на edge, включая recent completion journal; отсутствие одного channel lookup не доказывает, что не было звонка. Unknown не auto-redial; explicit operator reconciliation/new invocation по policy. Command receipt+ARI channel ID не обещают exactly-once у сторонней PBX при потере всей истории.

External transfer v1 — управляемый новый leg через approved connection/target и bridge handoff после подтверждения ответа (blind business handoff, без agent consult). Arbitrary REFER target запрещён; native REFER как отдельный certified capability позже. Target list bounded, max2 transfer hops pilot, no self-loop/premium fallback. Failed transfer сохраняет управляемую исходную session/fallback, successful releases только ресурсы робота и явно передаёт recording ownership. `transfer requested` не terminal success до наблюдаемого handoff.

Signed callbacks через AN4 neutral delivery, без обязательного speech_analytics import/license. Voice events минимальные IDs/status/usage state, не transcript/summary по умолчанию. Delivery retries не repeat calls/tools. Это перенос нейтрального delivery component, не зависимость robot release от аналитики.

**Приёмка:** invoke duplicate/crash-after-originate, foreign deployment, target injection, cancel-ring-answer race, stale commands, unknown outbound, transfer-loop/timeout, absent AutoDial package, external read/control scope separation.

## RT4 — onboarding и эксплуатация

**Owned paths:** aiRobots connections/wizard/session views, RTK/locales, operational readiness/admin endpoints; worker/node drain/reconcile code только scoped assignment.

Wizard: create connection → auth/transport/ACL → DID binding → copy destination/secret once → test call → readiness. Показать фактический supported profile, applied config revision, failed step/action. Не требовать extension/queue setup. Test call явно initiated пользователем, не автоматический дозвон при Save. Instructions для внешней PBX — только реально проверенные профили; общий SIP contract не обещает совместимость всех поставщиков.

Realtime selector в editor учитывает provider capability, media profile и approved test report. Тестовый и опубликованный snapshots разделены. Instance health показывает provider/edge/queue/storage/quota по machine reasons, без internal passwords/ARI URL. Voice session trace объединяет signalling/media/provider/tool events по correlation и monotonic durations; content redacted.

Drain: stop admissions → bounded finish active sessions → reconcile orphan channels/usage → unload node subscriptions. Emergency kill отдельная admin permission/action и только own sessions. ApplicationReplaced/lost lease блокируют mutations; no active-active same app. Provider outage вызывает bounded fallback, не незаметную отправку audio другому vendor. Node crash v1 может завершить разговор; журнал честно partial/reconciliation, transparent failover не обещать.

**Приёмка:** one-time secret UX, revoked connection, expired config, mic/browser regression, RU/EN360/1440, drain during transfer, two nodes same namespace refused, orphan cleanup не трогает чужой channel.

## RT5 — certified profiles и полная live матрица

**Вход:** RT1–4, VR6/CAP5; MySQL/PG SIP driver evidence. **Owned paths:** disposable SIP/ARI/provider harness, connection examples/runbook, AI-08 SUMMARY/VERIFICATION.

На выделенном сервере external PBX emulator → собственный edge → cascade/realtime: inbound/outbound, two tenants/0, NAT/packet loss/jitter, allowed TLS/SRTP profile, incorrect auth/DID, simultaneous calls, CPS cap, provider429/fatal/unknown, backend/edge restart, drain, transfer, AutoDial attempt pause/cancel/no double retry, КЦ authorised handoff. Не production телефонные номера или платные звонки без заданного budget.

Измерить ROBOTS-SPEC proposed SLO на declared hardware/concurrency/codec/region, отдельно signalling/media-ready/first-played/barge-in/cleanup. Profile acceptance sheet фиксируется до прогона, regression сравнивается с cascade. Local/BYOK без скрытого egress и SaaS wallet. Real provider failure не подменяется fake success; CI может пройти отдельно, live gate остаётся pending.

Project checks/build, own-resource cleanup и logs с credentials redacted. Rollback disable new realtime/external admission → drain собственные sessions → restore previous config revisions; не удалять connection/session/usage history. Полные MCP/KB и коммерческий billable mode остаются AI-09/10R.
