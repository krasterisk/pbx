---
initiative: ai-products
phase: AI-07
revision: 2026-09-18-r2
status: planned_dependency_gated
tasks: [VR1, VR2, VR3, VR4, VR5, VR6]
depends_on: [AI-01, AI-02, AI-03, AI-00-G1]
---

# AI-07 — версия AI-робота и каскадный разговор

Чтение: [ROBOTS-SPEC](ROBOTS-SPEC.md), [AI-03](AI-03-PLAN.md), [AI-02](AI-02-PLAN.md), [PRODUCT-SLICES-CONTRACTS](PRODUCT-SLICES-CONTRACTS.md), [AI-00 closure](AI-00-CLOSURE-PLAN.md), [AIPBX-ROBOTS-AUDIT](AIPBX-ROBOTS-AUDIT.md). Требования VR-01/02/04/05, начальные VR-09/10/11/12. AI-04/аналитика и её лицензия не нужны. Native route integration ждёт DB-03; browser/domain tests можно раньше. Realtime и внешний SIP onboarding — AI-08, полный Tools/MCP/KB — AI-09.

Результат: versioned cascade робот принимает контролируемый звонок, отвечает, корректно прерывается и передаёт/завершает свой вызов; сохранены session/version/media/usage. Один app на семейство сервиса/namespace установки, не app на кампанию или робота. Детали предыдущего scripted робота не становятся моделью нового AI domain.

## VR1 — развитие cc_ai_agents, publish и deployment

**Вход:** A3/C1, AI-02 immutable provider revisions. **Owned paths:** `ai-agents` model/service/controller/tests и migration adapter, новый `ai-voice` configuration/version services, shared robot DTO, dual-DB SQL/manifest/coverage registry. Один schema/API writer.

Существующий `cc_ai_agents` остаётся единственным editable source name/prompt/greeting/mode/provider/voice/vad/toolset. Добавить draft revision, stable robot UUID и отдельную JSON runtime policy для новых полей (timeouts, allowed transfer target IDs, recording reference); не копировать те же prompt/provider поля в новую draft table. Прежние UID/unique_id сохраняются. Все старые и новые write endpoints идут через один aggregate service и revision CAS. Frontend старого CRUD обновляется вместе с контрактом; writes без expected revision возвращают428, GET возвращает revision. Выпустить compatibility note, не обещать lost-update protection клиенту без version.

| Таблица | Контракт |
|---|---|
| `ai_robot_versions` | tenant,id,agent_uid,version_no,config_digest,immutable snapshot/provider refs,created_by/at; UNIQUE(agent_uid,version_no), exact legacy agent owner |
| `ai_robot_deployments` | tenant,id,agent_uid,kind internal/browser_test/external_sip (последний disabled до08),active_version_id,status,revision,capture/fallback policy; UNIQUE(tenant,id) |
| `ai_voice_sessions` | tenant,id,deployment_id,version_id,ingress_kind,ingress_key,node/channel refs,owner/fence,state,reason,start/end,usage/capture refs; UNIQUE(ingress_kind,ingress_key), composite tenant/deployment/version checks |
| `ai_voice_turns` | tenant,id,session_id,input_turn_id,output_epoch,role,state,text/provenance,started/ended_ms,played_until_ms nullable; UNIQUE(session_id,input_turn_id,role,output_epoch) с non-null defined keys |
| `ai_voice_events` | tenant,id,session_id,sequence,type,safe payload,time; UNIQUE(session_id,sequence), append-only, retention |
| `ai_call_control_operations` | tenant,id,session_id,operation_key,action,target_ref,state,observed_result,created_at; UNIQUE(session_id,operation_key), no blind replay unknown side effect |

Migration preflight: duplicate unique_id, ownership links, invalid mode/provider/toolset; output report, invalid draft не удаляется/не публикуется. Backfill stable UUID и revision идемпотентно, не создаёт auto-active deployment/published version. Publish validates complete snapshot+exact tenant/capability, fixed version schema и budgets; только cascade запускается в07. Realtime drafts остаются читаемыми, publish/runtime для неподдержанного режима fail clearly. Rollback version — audited pointer CAS, текущий session сохраняет snapshot.

`input_turn_id` — server monotonic integer в session:0 для greeting,1… для caller turns; caller transcript row имеет output_epoch0, assistant — фактический epoch. Промежуточный текст mutable только до finalization; финальный turn неизменяем, corrections отдельным событием. Voice subject extension provider operations/reservations из PRODUCT-SLICES-CONTRACTS входит в VR1 migration до допуска runtime, чтобы не создавать dummy batch job для каждого аудиокадра.

Deployment resolver регистрирует настоящий B2 resource binding; shared schema root содержит cc_ai_agents и dependencies без обязательных Context/CDR. Internal и browser_test развёртывания отдельны, но используют один version/runtime. Default disabled до successful readiness. Disable прекращает admissions, explicit emergency stop — отдельная permission с audit и ограничением своих sessions.

**Приёмка:** migrations обе DB, failed legacy links, concurrent edit/publish/rollback, in-flight version unchanged, realtime unavailable, same numeric UID чужого tenant, missing package/entitlement, no automatic deployment. Один config источник доказан API regression.

## VR2 — trusted ingress, ARI/media ownership и realtime execution

**Вход:** G1 classifier/names/ApplicationReplaced принят; AI-02 quota/usage contracts и CAP1/3. **Owned paths:** `ai-voice/runtime/**`, узкие `ari/**` routing extensions, нейтральный `voice-media/**`, extraction wrappers `voice-robots/services/**` с regression tests. Не переносить целиком `VoiceRobotSession` с keywords/slots/scripted repositories.

Batch workers D2 не перевозят каждый PCM frame и не сериализуют живой разговор через SQL очередь. Отдельный long-lived voice runtime держит bounded audio state в памяти, SQL хранит admission/session/turn milestones/usage/outcomes, outbox — durable downstream events. Один ARI ingress owner на PBX node, worker assignment имеет lease/fence. Для первого релиза один активный voice owner на node, другие replicas standby; active-active sockets одного app запрещены.

При native входе локальный trusted PBX helper получает single-use opaque dispatch ticket через authenticated node control API. Ticket связан с node, channel uniqueid, deployment, tenant из server binding, expiry30s. Caller/SIP headers/публичный body не выбирают tenant. Ticket consumed атомарно с session+quota reserve; duplicate Stasis возвращает ту же session, не вторую. При недоступном admission API bounded timeout (pilot2s) ведёт в настроенный PBX fallback до provider call. Ticket не содержит prompt/секрет, не логируется полностью. Route destination — static binding ID, не клиентский токен.

Event classifier подтверждает app/namespace/channel kind, correlated parent для external-media/Snoop. Atomic session claim до первого await. Только owner mutates channel/bridge; cleanup идемпотентен, чужой channel не hangup. Connected socket не равен readiness приложения; ApplicationReplaced запрещает originates/admissions соответствующего owner. После потери lease stale worker прекращает media/control calls, fence проверяется внутри единственного ingress control gateway, а не только при SQL completion.

Media port interface: normalized input PCM(sampleRate/channels/frame seq/monotonic time), ordered output enqueue(epoch,seq), flush(epoch), playback progress, close. Capability negotiated before call. Preferred chan_websocket выбирается только после реального probe buffer/flush/played markers/control protocol. Для validated RTP fallback reuse audio/VAD components через adapters; текущий UDP service читает datagrams без source validation и не является готовым secure transport. Новый adapter проверяет expected peer/port/SSRC binding, RTP extension/padding/CSRC/sequence/timestamp, payload codec, jitter/loss и bounds. Не доверять первому пришедшему UDP пакету как владельцу session.

Официальный chan_websocket предоставляет media/control и flow-control возможности, зависящие от версии; поддерживаемый профиль фиксируется после probe, не по одному номеру: [Asterisk WebSocket driver](https://docs.asterisk.org/Configuration/Channel-Drivers/WebSocket/). Если корректный flush/playback acknowledgement не доказан, эта transport capability недоступна; не заявлять barge-in гарантированным.

**Приёмка:** spoof/missing/expired ticket, duplicate Stasis before await, stale owner control, чужой app/channel, UDP spoof/malformed RTP, websocket flow stop/resume, ApplicationReplaced, disconnect/drain. Scripted и autodial regression. Node outage не обещает восстановить память разговора: перейти в documented fallback/hangup и reconcile SQL.

## VR3 — каскад, interruption и provider contracts

**Owned paths:** ai-voice turn coordinator, voice-media buffers, нейтральные STT/LLM/TTS adapters, deterministic audio/provider fixtures. A3 capability labels недостаточны: streaming/abort/timeout/codec/usage подтверждены отдельным adapter contract.

Per-session VAD instance; incoming timeline и `inputTurnId` независимы от assistant `outputEpoch`. Default pilot limits: pre-roll300ms, endpoint silence600ms (configurable validated), max utterance30s, max call10min, max60 turns, output buffered audio не более2s, max2 TTS chunks prefetch; не universal optimal values, параметры acceptance profile. Transcript/history token budget ограничен; целые tool/message pairs сохраняются, context exhaustion вызывает fallback, не молчаливое удаление system policy.

Turn lifecycle: listening → STT final → thinking → speaking → listening. Interim STT отображается provisional и не запускает действия; один accepted final на input turn, late duplicates игнорируются. STT/LLM/TTS deadlines отдельно, no response/silence retry максимум2 → allowlisted fallback/hangup. SQL usage operations уникальны session/turn/stage/attempt; цена/config snapshot фиксированы до отправки. Не повторять весь живой ответ после unknown provider result как будто клиент его не слышал.

Speech-start немедленно повышает outputEpoch, abort old LLM/TTS, flush только старый output и игнорирует его late callbacks. Новый input/pre-roll и ongoing STT новой реплики не очищаются. Serial playback по sentence sequence даже если второй TTS ответ пришёл раньше первого. Старые chunks/состояния после teardown отбрасываются по fence+epoch; errors не оставляют hanging promise/resource.

Transcript различает generated, queued и observed-played assistant text; отправленные bytes не доказательство, что caller всё услышал. При отсутствии точного played boundary хранить uncertain progress и не использовать полный незавершённый ответ как услышанную историю. Новая LLM history получает явный interruption marker/достоверную played часть. Echo/false VAD не переносят голос ассистента в caller role; inbound/output audio separation и test signals обязательны.

Provider choice: один реально проверенный cascade profile RU; BYOK/local capability без автоматического egress fallback. В CI fake adapters fault capable; никакой привязки domain DTO к одному vendor SDK. Заменять уже работающий provider mid-turn можно только по явному контракту; v1 fatal error→fallback, не бесконечный reconnect.

**Приёмка:** barge-in на первом слоге, в STT final/LLM/TTS/queued/playing; новый caller utterance сохранён полностью; reverse TTS completion; late callbacks; 2 sessions с разными marker signals; silence/echo; overlong input/context;429/auth/unknown result; cleanup после каждого failure. Измерять end-of-speech→first-played audio и interrupt→old-audio-stop, не только HTTP latency.

## VR4 — минимальные tools, маршрут, КЦ и AutoDial

**Owned paths:** ai-voice call-control/typed outcomes, `routes` dialplan action generator, shared ActionType/DTO, frontend dialplan schema registry/useSchemaRefs/CATALOG_DEFAULTS, bounded autodial executor adapter/tests, КЦ handoff DTO. Shared schema/ARI/autodial writer один.

Route action `ai_voice_robot` отделён от существующего `voicerobot`. Destination server validates tenant/published deployment/license/readiness/fallback; compiled dialplan содержит server binding, не произвольный app или target. Missing/disabled runtime не блокирует звонок без fallback: goto разрешённого PBX направления либо controlled hangup; причина в журнале. Сохранение/copy/raw/actions использует единую schema-driven форму, не handwritten условный editor.

Tools v1: `end_call(reason enum)`, `transfer(targetId из snapshot allowlist)`, `get_session_context` read-only безопасные caller-supplied metadata с provenance. Нет административного MCP и произвольного HTTP/SQL/номер из свободного текста LLM. Execution journal operation_key дедуплицирует запрос; JSON schema, deadline, permission, target current validity и loop/hop limit проверяет server. Transfer requested не равно transferred: подтверждение bridge/channel destination, failure→fallback; при unknown outcome query control state, не второй transfer вслепую. Caller utterance не доказывает право на приватные CRM данные.

КЦ handoff: validated tenant target, минимальная summary с provenance и session link только authorised recipient, текущие playback/recording roles закрываются корректно. Summary provisional не маскируется под дословный transcript. Если КЦ package absent — queue target недоступен, возможен другой разрешённый target. Нет обязательной лицензии КЦ для простого робота.

AutoDial сохраняет единственное владение originate/pacing/DNC/schedule/retry. Adapter связывает campaign attempt UUID → deployment version → VoiceSession; **не делает второй originate**. Фаза ответа/переход между приложениями проходит через owner handoff ingress, только после допустимого состояния attempt. UNIQUE attempt-session link и outcome event key защищают duplicate/late events. Typed outcome: completed/transferred/no_input/runtime_failed/cancelled с reason/usage/session refs; campaign retry decision остаётся AutoDial, LLM не может его запускать. Campaign pause/cancel — explicit event в runtime, один terminal outcome; timeout проигравшего race не переписывает уже принятое completion.

AI-07 включает controlled попытку и contract/harness для обоих DB; полная live КЦ/AutoDial outage matrix и external outbound capability — AI-08. Не запускать production кампании для проверки.

**Приёмка:** invalid route foreign deployment, unpublished version, target deleted, injection arbitrary number, duplicate end/transfer, transfer unknown, two campaigns same app, cancel-vs-complete, DNC запрещает originate до runtime, old scripted routes unchanged.

## VR5 — editor, тест голосом, журнал и запись

**Owned paths:** `features/aiRobots/**`, `pages/AiRobots*`, scoped ai-agents legacy editor revision support, RTK endpoints/types/locales/tests; backend browser test/session read controllers. FSD/shared primitives/SCSS, существующий ModuleShell.

Editor: identity → prompt/greeting → cascade profiles/voice → fallback/limits → test → publish. Autosave debounced draft CAS, saving/conflict/failure; publish не работает поверх unsaved change. Realtime option видна как unavailable до08; tools/KB extension points без fake working controls до09. Сценарный редактор остаётся отдельным. Secret не отображается в prompt/history/export.

Browser preview opt-in использует тот же versioned snapshot/runtime, но `browser_test` deployment/principal: mic permission после действия Start, отдельный one-use short-lived ticket из JWT POST, secure WSS и origin allowlist. Ticket bound user/tenant/test session/expiry, не JWT/API key в query; обмен через первый bounded auth frame до audio, deadline5s. AudioWorklet timestamped PCM frames, negotiated format/rate, bounded binary messages/sequence/backpressure; tab close/logout/stop → cleanup. Preview по умолчанию не выполняет SIP transfer/end чужого call; call-control simulated и явно помечен. Настройки во время теста frozen, restart для нового snapshot. Не включать mic автоматически.

Журнал: sessions server pagination/filter by deployment/date/outcome, version, timeline, timings, generated-vs-played transcript, tool decisions, usage measured/estimated и recording status. Отдельные права audio/transcript; plain inert rendering. Capture по CAP deployment policy работает без Route/CDR и без аналитики; optional analysis link появляется только с отдельным правом и реальным downstream run. Нельзя создавать второй conflicting record toggle для native route call.

**Приёмка:** draft race/save fail, disabled publish, mic denied/disconnect/stop, stale ticket/cross-origin/cross-tenant, fake audio frame overflow, test snapshot unaffected by edit, no side-effect tools in preview, tenant switch cache clear, RU/EN360/1440/keyboard, interrupted transcript truthful. Internal test extension остаётся альтернативой browser preview, но не закрывает его UAT.

## VR6 — live и eval приёмка, rollback

**Вход:** VR1–5, CAP5/native DB-03, AI-00 transport/provider probes. **Owned paths:** synthetic voice fixtures, remote controlled call harness, eval sheets, AI-07 SUMMARY/VERIFICATION. Paid providers только с разрешённым test budget; запись тестовых реплик синтетическая/consented.

MySQL/PG x две tenant identities и0: scripted+autodial+AI coexistence, simultaneous sessions, malformed/duplicate ARI events, barge-in first syllable, transfer/hangup, ARI/provider outage, worker kill/drain, storage failure, quota exhaustion, rollback published version during call. Не меньше10 simultaneous synthetic sessions на declared hardware для pilot; это проверка isolation, не обещание production capacity. Мощность/latency измерить и записать, не вывести из числа passed tests.

Hard invariants: no чужой answer/hangup/PCM/secret; 1 attempt→1 session→1 terminal outcome; old output не играет после confirmed flush; input нового utterance сохранён; no double usage settlement; resource leak count возвращается к baseline после100 create/cleanup cycles. Fault tests детерминированные с event barriers. Целевые p95 latency/barge-in thresholds закрепить до live run в acceptance profile; недоказанный transport flush или плохое качество speech блокируют этот профиль.

Проектные checks/build, adapter tests и real call evidence с event timeline/packet metadata без credentials. Runtime restart не восстанавливает разговор прозрачно: v1 controlled fallback/hangup, partial transcript и reconciliation; это видимая граница. Rollback: stop admission → drain свои active sessions → disable new action/descriptor для новых calls → сохранить versions/session/media/ledger. Не rename Stasis app во время разговоров. External SIP и realtime не объявлять реализованными до AI-08.
