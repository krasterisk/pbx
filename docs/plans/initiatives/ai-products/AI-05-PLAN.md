---
initiative: ai-products
phase: AI-05
revision: 2026-09-18-r3
status: planned_dependency_gated
tasks: [MET1, MET2, MET3, MET4, MET5]
depends_on: [AI-04]
---

# AI-05 — редактор метрик, версии и человеческая проверка

Чтение: [ANALYTICS-SPEC](ANALYTICS-SPEC.md), [AI-04](AI-04-PLAN.md), [ADVANCED-PRODUCT-CONTRACTS](ADVANCED-PRODUCT-CONTRACTS.md), [AIPBX-ANALYTICS-AUDIT](AIPBX-ANALYTICS-AUDIT.md). Требования AN-04/05/06/07/12; aggregate contracts AN-08/09. AI-04 fixed metrics становятся первым preset того же engine, не второй несовместимой системой.

## MET1 — definition contract и immutable publication

**Вход:** AN1/3/6 accepted. **Owned paths:** `speech-analytics/metrics/**`, project/version services, shared DTO/schema, additive migrations+manifest. Один schema writer; никакого исполнения SQL или JavaScript из rubric.

Metric definition: stable UUID+key (ASCII lower snake, <=64), display name, type boolean/number/enum/string, instructions, evidence policy, applicability, unit/range/enum values, polarity positive/negative/informational, weight, normalization, reducer, required flag. `key` уникален внутри project version; удалённый key не переиспользовать для другого смысла. Enum хранит стабильные keys отдельно от RU/EN labels. Required означает полноту результата, а не обязанность выдать оценку при отсутствии данных.

Новые таблицы: `sa_metric_definitions` (tenant/id/project/key identity, archived_at; UNIQUE project/key), `sa_metric_revisions` (definition_id/revision/immutable schema+rubric/hash; UNIQUE definition/revision), `sa_project_version_metrics` (tenant/project_version/metric_revision/order/weight; UNIQUE version/definition), `sa_metric_values` (tenant/run/metric_revision/status/typed nullable columns/normalised_score/evidence refs; UNIQUE run/metric_revision). Composite tenant FKs; typed value хранится ровно в одном поле при scored, все value columns null при unknown/N/A/unscorable. Пояснение/error code отдельно. Existing AN1 result JSON остаётся immutable API snapshot; normalized metric_values формируются той же result transaction для фильтров/агрегатов, не редактируются отдельно.

Draft definitions редактируются в существующем project draft_config; revision tables только published. Backfill AN1 fixed rubric в revisions сохраняет прежние result semantics/digest; не менять исторический JSON и не переоценивать calls. Publish валидирует schema, ranges, duplicate keys, provider constraints, веса и все ссылки одной transaction с active project pointer CAS. Rollback выбирает прежнюю version; текущие runs не меняются. Delete metric только архивирует identity; old versions/results читаемы до retention.

**Приёмка:** два одновременных publish/update, duplicate keys, type/range/enum mismatch, unsafe regex/expressions reject, fixed preset compatibility, foreign revision, rollback без rerun, MySQL/PG migration/replay.

## MET2 — applicability, scoring и deterministic measurements

**Owned paths:** pure scoring/eligibility validators, pipeline snapshot integration, shared result schema, property-based/fixture tests. Не добавлять LLM tools в аналитический pipeline.

Applicability v1 — bounded declarative AST: all/any/not и сравнения allowlisted metadata/quality/role fields; глубина <=4, <=32 nodes, bounded strings. Никаких arbitrary SQL/JS/regex/http. Semantic applicability разрешена отдельным LLM verdict с evidence и статусом unknown; результат LLM не меняет schema. Missing metadata → unknown, не false. Publish запрещает циклы метрик: v1 applicability не зависит от других mutable metric results.

Единые statuses: scored, unknown, not_applicable, unscorable; optional technical error с machine reason отражается в run partial/failed. False и0 — полноценные значения scored. No speech/плохой input не даёт хороший/плохой score. Role-sensitive metric запрещена при unknown/unverified role, если rubric требует verified attribution. External role claim маркирован отдельно.

Нормализация в version: boolean explicit map0/100, numeric linear range [min,max] с обязательным max>min и declared polarity, enum explicit score map только если включено scoring; string/informational не входят в overall. Range violation →invalid, без тихого clamp. Weight decimal nonnegative; total scored weight>0. Overall = sum(weight*normalisedScore)/sum(weight только scored и applicable); отдельно coverage = scored eligible weight/eligible weight. Не публиковать overall при coverage ниже version threshold (default0.8 для pilot), возвращать null+reason. Unknown applicability учитывается отдельно, не улучшает coverage исключением из denominator. Определить eligible set по версии до подсчёта; неизвестная применимость снижает покрытие как unresolved eligible.

По calls агрегировать metric distribution/counts и coverage, не усреднять произвольно already-rounded overall. Numeric arithmetic decimal, rounding один раз на presentation. Версии с разной семантикой не объединять без explicit compatibility mapping (в v1 mapping отсутствует).

Точный eligible denominator: scoreable definitions версии с weight>0, исключая только подтверждённые not_applicable; unknown applicability остаётся в наборе. E=0 →overall null, coverage null, reason no_applicable_metrics. E>0, scored weight=0 →overall null, coverage0. Required metric с technical failure не скрывается достижением coverage другими метриками: run partial/failed согласно required policy.

Deterministic metrics: duration из probe; talk/silence/overlap только из versioned audio/VAD algorithm и известного channel layout, не из LLM guesses. Timestamps STT не равны измеренной тишине. Для mono overlap unavailable, для duplicated stereo не два speakers. Алгоритм фиксирует frame size/threshold/provenance и validated bounds; изменение — новая revision. Нужен measured test corpus, пока он не принят capability disabled.

**Приёмка:** all-N/A/all-unknown/zero/false/no-speech; missing applicability не улучшает score; zero weight; numeric boundaries; mixed versions; deterministic silent/overlap marker signals; повтор расчёта на обеих DB даёт одинаковые decimal/string results. Transcript injection не изменяет AST/rubric.

## MET3 — preview, reanalysis и человеческие corrections

**Owned paths:** project preview/reanalysis/review controllers/services, usage admission adapter, migrations, grants scope extension. Idempotency/outbox/reservations из AI-02.

Добавить scope `analytics:reanalyze` bound project; `analytics:upload` не разрешает повторный платный run. JWT action имеет отдельное permission. `POST /analysis-runs/:id/reanalyses`: explicit projectVersionId/reason/source transcript revision, Idempotency-Key, approved estimate token. Новый run с parentRunId, original immutable. Technical retry AN3 остаётся attempt того же run.

Preview draft создаёт immutable non-published config snapshot+evaluation job (не active project version), лимит10 выбранных samples/запрос; показывает estimated provider units/price unknown. Пользователь запускает явно, никакого платного анализа при каждом нажатии клавиши. Snapshot digest, dataset IDs и estimate expiry включены в подтверждаемый request. Изменился draft/provider/selection — estimate invalid409; trial/quotas действуют. Preview results не входят production dashboards. Transcript reuse только совпадают asset hash, STT/preprocessing revision, channel mapping и ACL; не начислять фиктивный STT usage.

`sa_human_reviews`: tenant/id/run/metric_revision/expected_review_revision/value/status/reason/actor/time/supersedes_id, append-only; permission reviewer. AI result не переписывается; latest correction pointer с CAS, отмена отдельным событием. `sa_transcript_corrections` immutable revisions с author/reason; corrected text не делает старые evidence валидными автоматически: explicit reanalysis/derived result с новыми IDs. Повтор human correction дедуплицируется command key.

Reviewed view явно отделён от AI view; reviewer/оператор не изменяет объективные длительности без отдельного measured-data override authority. Full audit и доступ по проекту; review rationale/quotes требуют transcript permission. Delete/retention очищает sensitive correction payload по policy, audit сохраняет минимальный tombstone.

**Приёмка:** unauthorized reanalysis, stale estimate, duplicate command, same transcript cache wrong tenant, concurrent review409, original result unchanged, preview исключён из reporting, edits не вызывают providers автоматически.

## MET4 — интерфейс редактора и сравнения

**Owned paths:** `features/speechAnalytics` metric editor/project version/review UI, shared RTK, RU/EN/tests; FSD paths окончательно закрепляются по AN5. Shared primitives/SCSS, существующий modal shell, без новой дизайн-системы.

Форма: «Что проверять» → тип/диапазон/варианты → когда применимо → доказательства → влияние на итог; advanced key/schema скрыты. Для polarity слова «Да — хорошо / Да — проблема / Информация», не только цвет. Numeric anchors обязательны для субъективных шкал. String имеет лимит/описание extraction, без averaging. Template и generated suggestions создают draft, никогда auto-publish.

Preview на выбранных recordings показывает на одной карточке value/status/evidence/quality и расход; progress/cancel/retry по shared jobs. Compare версии показывает semantic changes, покрытие/оценку каждого sample, AI vs human; small-N предупреждение без заявлений статистической значимости. Publish explicit с validation report, autosave ошибки и409 не теряются. Publish не запускает history reanalysis.

Review mode показывает original AI + correction + reason, append-only history; source seek работает по соответствующей transcript revision. Instant server toggles RTK optimistic+undo; draft формы сохраняются через draft revision, не mutation по каждому полю без контроля версии.

**Приёмка:** keyboard, RU/EN,360/1440, metric copy new identity, duplicate key validation, publish disabled при invalid/unsaved, compare different scales, unknown/N/A различимы, correction access, saved conflict и undo.

## MET5 — eval, совместимость и rollback

**Owned paths:** analytics eval fixtures/harness, AI-05 SUMMARY/VERIFICATION; code fixes отдельным recorded assignment.

Сохранять tuning/train samples отдельно от frozen held-out; минимум30 calls с двойной human разметкой для rubric calibration, группы role unknown/short/no objection/no speech. Метрики per rubric: agreement/kappa/MAE, applicability F1, evidence validity, unknown coverage, latency и cost. Численные цели из ANALYTICS-SPEC — предлагаемые, фиксируются до live experiment; нельзя объявлять выполненными по synthetic fixtures. Любой model/prompt/preprocessing/metric semantic change требует diff report и measured no-regression gate для release profile.

Hard tests: accepted fake evidence=0, no speech scored=0, cross-tenant=0; one repair максимум AN3, bounded attempts и usage. MySQL/PG same fixtures, version migration/replay; project lint/backend/frontend/build и browser evidence. Paid eval только с разрешёнными credentials/budget. Rollback активной version сохраняет результаты/reviews; admission paused для невалидного нового rubric, исходные данные не удаляются. После MET5 — AI-06A.
