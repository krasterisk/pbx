---
initiative: ai-products
phase: AI-04
revision: 2026-09-18-r2
status: planned_dependency_gated
tasks: [AN1, AN2, AN3, AN4, AN5, AN6]
depends_on: [AI-01, AI-02]
---

# AI-04 — первый сквозной продукт внешней аналитики

Чтение: [ANALYTICS-SPEC](ANALYTICS-SPEC.md), [AI-01-B](AI-01-B-INTEGRATIONS-PLAN.md), [AI-02](AI-02-PLAN.md), [PRODUCT-SLICES-CONTRACTS](PRODUCT-SLICES-CONTRACTS.md), [AIPBX-ANALYTICS-AUDIT](AIPBX-ANALYTICS-AUDIT.md). Требования AN-01…04/06…08/10…12 — тонкий срез, AN-05 только три фиксированных метрики. Реализация не ждёт CAP/DB-03/Asterisk. Редактор метрик — AI-05, dashboards/reports — AI-06A, native routes — AI-06P, коммерческое списание — AI-10A.

Готовый результат фазы: клиент без PBX создаёт проект, публикует конфигурацию, загружает WAV через API/UI и получает transcript+summary+проверяемые метрики. Использует один реально проверенный STT/LLM profile и offline fixtures; provider labels сами по себе не evidence качества. Full commercial launch этим результатом не объявляется.

## AN1 — проекты, версии и project permissions

**Вход:** AI-01 C4 и AI-02 D1–D4 evidence. **Owned paths:** новый `packages/backend/src/modules/speech-analytics/**`, `packages/shared` analytics types, dual-DB migrations+manifest, coverage registry. Единственный shared/schema writer.

| Таблица | Поля / invariants |
|---|---|
| `sa_projects` | tenant,id,name,status draft/active/archived,draft_revision,draft_config,active_version_id,created_by,timestamps; UNIQUE(tenant,id); optimistic revision |
| `sa_project_versions` | tenant,id,project_id,version_no,config_digest,immutable config/provider revision refs,created_by/at; UNIQUE(project_id,version_no); composite tenant/project FK |
| `sa_project_members` | tenant,project_id,user_id,role owner/analyst/viewer; PK project/user; exact tenant membership, foreign users reject |
| `sa_recordings` | tenant,id,project_id,integration_principal_id,external_call_id,source_part,asset_id,metadata,occurred_at,created_at; origin_namespace+external identity uniqueness (ниже), tenant/asset FK |
| `sa_analysis_runs` | tenant,id,recording_id,project_version_id,job_id,state,transcript_id,result_id,parent_run_id,reason,timestamps; UNIQUE(job_id), indices tenant/project/status/date,id |
| `sa_transcripts` | tenant,id,asset_id,stt_revision_id,content_digest,coverage/quality metadata,created_at; immutable; asset/revision/hash provenance |
| `sa_transcript_segments` | tenant,id,transcript_id,ordinal,start_ms,end_ms,channel,speaker/role,role_source,text,confidence nullable; UNIQUE(transcript_id,ordinal), tenant/transcript FK |
| `sa_results` | tenant,id,run_id,version,schema_version,summary,metric_results,evidence_refs,quality,status,created_at; UNIQUE(run_id,version), immutable |

JSON immutable config включает language, STT/LLM revisions, fixed rubric version, role/quality policy, max bytes/duration, fallback policy и retention reference; секретов нет. Config updates требуют `If-Match` draft revision; publish transaction lock project → validate exact owner/enabled capabilities → insert version → active pointer+audit. Retry с operation key возвращает ту же version. Active pointer change не меняет уже принятый run. Archive останавливает intake, оставляет право читать данные; delete/retention выполняется отдельно через AI-02 tombstones.

Начальная матрица ролей: tenant admin управляет проектом/keys/retention; project owner публикует и управляет members в своём tenant; analyst запускает и читает результат; viewer читает разрешённый результат. Audio/transcript — отдельные permission flags, не следствие viewer/analyst имени. Администрирование billing и provider secrets не наследуется. Tenant boundary перед project role. Интеграционный principal получает только scopes+project binding из B2, не JWT project role.

Зарегистрировать production `IntegrationResourceResolver` для project: тот же tenant, существует, не archived, action допустим; revoke/delete сверяются на каждом request/admission. Это закрывает отложенный B2 grant gate, fake resolver удаляется из production composition.

**Приёмка:** publish/update race, stale draft409, immutable historical config, projectA assetB, roles/audio/transcript independently, archived after queue, tenant0, same UUID different tenant predicates. Migration/replay real MySQL/PG.

## AN2 — API/UI ingestion и business dedupe

**Owned paths:** speech-analytics public/JWT controllers, domain ingestion service, media-assets upload adapter, integration grants serializer, RTK contract DTO и API tests. Общий upload/outbox/job/ledger из AI-02, не второй pipeline в controller.

Namespace public `/api/v1/speech-analytics`; JWT management `/api/speech-analytics`. Global `api` уже установлен в main, controller prefix не должен повторить его. Controllers используют разные auth adapters и один domain service. Public caller не может назначать project roles, edit/publish rubric/provider.

| Endpoint public | Поведение / scope |
|---|---|
| `POST /uploads` | 201 uploadId/expiry; project bound, Idempotency-Key, `analytics:upload` |
| `PUT /uploads/:id/content` | Поток bytes, bounded Content-Length/chunked; владелец upload, `analytics:upload`; v1 полный stream, не произвольные append/range |
| `POST /uploads/:id/complete` | 202 при durable probing, 200 при ready; Idempotency-Key, checksum; не запускает анализ |
| `GET /uploads/:id` | Состояние своего upload/asset ref после ready; `analytics:upload` |
| `POST /analysis-runs` | 202 runId/recordingId/projectVersionId/statusUrl после transaction; `analytics:upload` разрешает первый analysis import |
| `GET /analysis-runs/:id` и `/result` | `analytics:read`, project binding; result без transcript/audio/PII quotes при отсутствии дополнительных scopes |
| `GET /analysis-runs/:id/transcript` и `/audio` | Дополнительно `analytics:transcript` либо `analytics:audio`, Range proxy AI-02 |
| `POST /analysis-runs/:id/cancel` | `analytics:cancel`; идемпотентный запрос, pending/terminal фактическое состояние |
| `GET /recordings` и `/capabilities` | Project-scoped pagination/readiness; не выдаёт весь tenant list |

`analytics:upload` включает ровно initial run по imported recording; explicit reanalysis появится отдельным scope/endpoint в AI-05. Старые proposed scope names не aliases — контракт ещё не выпускался. UI upload использует тот же domain flow. Presigned/direct-object и URL import отключены v1; базовый путь streaming upload. Дополнительный multipart convenience endpoint допускается только thin adapter к тем же upload/complete/run steps с тем же operation receipt, не обязательный отдельный API.

Initial-run transaction: resolve active version один раз → authorize ready asset+project+principal → claim business recording identity → create run+AI-02 job/reserve/outbox/idempotency receipt. Adapter AI-02 принимает caller transaction; нельзя commit отдельно domain row, потом job. 202 никогда не выдаётся до commit. Если media ещё probing —409 `asset_not_ready`, без provider reserve.

Business key: tenant+stable integration principal+project+externalCallId+sourcePart. `externalCallId` обязательный для API (max128 UTF-8 bytes), sourcePart default `main` (max64), byte/case-sensitive; хранить hash tuple как indexed key и raw fields для collision comparison. Для UI создавать server UUID source identity в namespace user upload. Same business key с тем же asset checksum/metadata hash → прежний recording/initial run даже при новом Idempotency-Key; другое содержимое →409, никаких тихих replacement/reanalysis. Два разных externalCallId с одинаковым audio не склеиваются. UNIQUE initial-run guard по recording предотвращает два initial jobs; reanalysis не использует этот guard. Null external ID не используется как nullable unique trick.

Input metadata allowlist: occurredAt/timezone, direction, participants, external labels; bounded length/count, roles claimed_by_integration, не verified PBX. Phone/externalId не предоставляют доступ к человеку/CRM. Перепроверять project ownership на grant, upload, complete, run и worker. Tenant из payload не принимать.

**Приёмка:** same key/different hash409, потеря202, rotation same principal, two clients race same business key, same audio different calls, invalid hash, archived project, revoked principal, oversize413/type415/metadata422/quota429, foreign upload404. Одинаковые HTTP/DB outcomes обе СУБД.

## AN3 — STT, качество, метрики и evidence

**Owned paths:** speech-analytics pipeline/validators/fixtures, нейтральные provider adapters в `ai-connectivity`, media derivative contracts; без импорта VoicemailModule/AMI. Полезные aiPBX patterns: typed output, quality before scoring, stereo QA, evidence и bounded repair; не переносить монолит.

V1 bounded limits: WAV/FLAC/MP3, 256MiB максимум, 30min audio, 1–2 channels; меньший provider limit показывается в capabilities и проверяется до платной стадии. Max transcript/model token budget проверяется до LLM: whole-transcript fits → analyze, иначе `context_limit` без молчаливого truncate первых N chars. Long-call chunking/reducers позже, controlled limit — честное ограничение pilot. Voicemail helper с лимитом4000 chars нельзя использовать как готовый analytics engine.

Stages: asset probe ready → normalize derivative if needed → STT → transcript validation → quality gate → LLM analysis → result validation/repair → commit. Provider operations/unknown states/retries/metering только D2/D4. A transient retry создаёт attempt прежнего run; repair максимум один отдельный metered operation. Fallback к иному provider только explicit published allowlist с residency policy; v1 default disabled.

Stereo: probe correlation/energy quality; verified independent channels допускают dual STT с merge по timestamps. Call duration = elapsed media duration; provider usage = сумма реально обработанных track durations. Unknown/fake stereo не получает две выдуманные роли. Mono transcription разрешена со speaker/role unknown; diarization capability only if adapter verified. STT words/segments bounded in [0,duration], sorted; overlap разных speakers допустим. Без time alignment adapter не публикуется как evidence-capable v1.

Три fixed metrics rubric v1 (не общий employee score): `greeting_present` boolean для известного operator и полного начала; `next_step_agreed` boolean для применимого разговора с проверяемым согласованием; `topic` enum sales/support/other. Каждая value имеет status `scored|unknown|not_applicable|unscorable`, evidence segment IDs/time spans, rationale и rubric revision. Unknown status → value null, не false/0. Absence false допускается только при достаточном coverage; неизвестная роль не превращается в плохую оценку. `next_step` applicability определена шаблоном и проверяется отдельно, не обязательна для любого звонка.

Quality flags разделяют silence/no intelligible speech, short but valid call, missing channel, low STT confidence (если измеряется), truncated/incomplete input. При no speech provider LLM не вызывается; run completed с quality `unscorable` и пустыми scored metrics либо policy-skipped, не failed fake score. Technical STT failure — failed. Частичная необязательная метрика — partial; глобальный malformed result — failed после одного repair.

LLM получает неизменяемый rubric+transcript как недоверенные данные; tools/MCP отключены. Валидатор schema/type/range/enum, quoted evidence membership, segment IDs, temporal bounds, applicable role и coverage. Несуществующая цитата не исправляется выдумыванием; invalid evidence → repair/unknown. Output не включает произвольные URLs/HTML/SQL. Result+run terminal+usage settlement+completion event committed в одной transaction с fence; stale worker не публикует результат.

**Приёмка:** silence/short valid/fake stereo, role unknown, malformed timestamps, wrong quoted evidence, injected transcript instructions, LLM extra fields, truncated context, one repair budget, cancellation/unknown provider result. Fixed adapter tests + real RU dataset gate AN6.

## AN4 — durable callbacks и polling

**Owned paths:** нейтральный `integration-delivery/**` infrastructure module, speech-analytics event adapter, migrations/coverage registry/harness. Outbox AI-02 сохраняет authority; callback retry не создаёт analysis/usage.

Таблицы: `ai_webhook_endpoints` tenant/id/principal/project/validated URL/encrypted signing-secret reference/key version/status/revision; `ai_webhook_deliveries` tenant/id/event_id/endpoint_id/endpoint_revision/payload_digest/state/attempt/next_at/http_class; UNIQUE(event_id,endpoint_id); `ai_webhook_attempts` delivery/ordinal/status/latency/error code, без response secret/body по умолчанию. Endpoint configuration только JWT admin, integration read scopes не разрешают менять destination.

Events completed/partial/failed/cancelled, envelope eventId/schemaVersion/time/projectId/runId/externalCallId/resultUrl; без текста/audio/PII metadata. Подписываются точные UTF-8 bytes сохранённого envelope: HMAC-SHA256(timestamp + '.' + rawBody), headers timestamp/keyId/signature. Timestamp новый у каждой попытки, eventId неизменен; consumer проверяет окно5min и dedupe eventId. Key rotation хранит старую key version до окончания pending delivery; revoke endpoint немедленно останавливает dispatch. Manual replay повторяет delivery/event ID, не run.

SSRF: HTTPS egress по проверенному endpoint, TLS verification, запрет credentials в URL, redirect disabled, DNS/IP validation при connect и закреплённый resolved address; private/link-local/loopback/metadata IP deny. Для customer internal endpoint — отдельный installation-admin egress allowlist/connector, не обход через project URL. Timeout10s, bounded response body64KiB, секреты не в query. Delivery max8 попыток за24h с exponential+jitter; 2xx ack, timeout/429/5xx retry, 410 disable, другие permanent4xx dead-letter. Polling остаётся authoritative при недоступном callback. Deletion/revoke проверяется перед каждой отправкой, endpoint URL revision не подменяется неожиданно pending event.

**Приёмка:** signed body fixture, key rotation, duplicate delivery, callback outage без new charge, redirect/DNS rebinding/private IP, cross-tenant endpoint, revoke race, replay history; actual HTTP fake receiver на стенде.

## AN5 — проект, список, карточка результата

**Owned paths:** `features/speechAnalytics/**` (принять один FSD spelling в assignment), `pages/SpeechAnalytics*`, shared RTK endpoints/types, RU/EN, product routes. Server policy/ingestion не копируются в UI.

Project wizard: name/language/provider profiles → fixed rubric preview → test upload → publish. Draft save показывает saved/saving/failed/conflict; publish disabled до server validation. Readiness отдельно от лицензии; нет обязательного PBX onboarding. Integration setup явно показывает scopes, project binding, lifecycle upload→complete→run→poll; curl samples без реального secret.

Список записей server cursor (occurredAt,id), filters project/date/source/status/quality, total count semantics documented; page size25/max100. Нельзя показывать неполный client-filter как весь dataset. Карточка: player+timed transcript, summary, три metric cards с applicability/quality, click evidence→seek, version/provider provenance, attempts/shadow usage. Отсутствующие timestamps/speaker роли обозначены. Transcript/HTML rendered inert; denied audio/transcript не грузятся скрытым запросом.

Состояния queued/running/retry_wait/awaiting_reconciliation/partial/failed/cancelled различимы; cancel button отражает request pending, не мгновенную отмену upstream. 202 upload complete означает probing, не готовый analysis. Технический retry UI не создаёт новый run; reanalysis control disabled с объяснением до AI-05. Global instant switch RTK optimistic+undo; form settings сохраняются явным Save. Polling bounded backoff/visibility pause, прекращается terminal; callbacks клиентскому UI не требуются.

**Приёмка:** keyboard/focus/360/1440px, RU/EN, tenant switch cache clear, failed upload resume/retry без duplicate recording, deep-link403/404, quote seek, partial/unscorable без зелёного employee score. Скриншоты/browser UAT + component/API tests.

## AN6 — сквозная приёмка, eval и release граница

**Вход:** AN1–5; AI-02 recovery evidence. **Owned paths:** synthetic fixtures/eval harness, deployment profile tests, AI-04 SUMMARY/VERIFICATION.

Remote MySQL и PG, Redis/storage, analytics-only profile без Asterisk/PBX tables: JWT UI и API key проходят upload→result→callback→replay; tenantA/B/0, ключ отозван, worker kill, two workers, context overflow, retention deletion. Один logical initial run и неизменный wallet в shadow. Existing PBX/scenario robots regression не ломается. `npm run lint`, backend/frontend tests и profiles build перед closure.

Eval contract: deterministic corpus минимум30 synthetic cases с expected schema/evidence/quality; отдельный consented human-labelled holdout минимум30 RU telephony calls для выбранного provider profile, без пересечения tuning. Измерить STT WER по channel/quality bucket, metric agreement с двумя reviewers, evidence validity и долю unscorable. Hard gates: zero cross-tenant leaks, fabricated accepted evidence=0, invalid typed results=0, all no-speech cases unscorable. Цели качества WER/metric agreement и latency/budget фиксируются **до** live run в provider acceptance sheet; без согласованных targets и реального прогона фаза лишь technical pilot, commercial accuracy не заявляется.

Paid calls только с разрешёнными credentials/budget; fake provider не доказывает AI-качество. Rollback: stop intake/publish → drain или cancel jobs → сохранить results/assets/versions/ledger; удалить plugin routes без schema down. Редактор/отчёты/внутренние маршруты остаются следующими планами.
