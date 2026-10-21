# C3: переиспользование embeddings — handoff 2026-10-18

Статус: **implemented / automated-tests-passed** для ограниченного технического среза; **C3 quality acceptance FAIL**, browser interaction acceptance **FAIL/pending investigation**, не released. Координатор прежний /root, chat01a14cff-e054-7ba0-931d-95fd94bfb3e8, codex-direct, PLAN v1.2 §12.9 slice5 C3/C4. HEAD main10308472; общий dirty baseline сохранён. Без субагентов, коммитов и новых воздействий на LAN.

## Что реализовано

- Найден и переиспользован `modules/embeddings/nomic-embed.ts`: общий singleton Nomic ONNX CPU q8, query/document prefixes, нормализация, 256 измерений, encode/decode/cosine. Использован KB `chunkText(180,24)` из knowledge-engine; новые модель, зависимости и второй loader не добавлялись. Voice semantic router использует этот же механизм; поиск баз AI playground местами остаётся лексическим, не объявлять все роботы семантическими.
- Миграция0054 MySQL/PostgreSQL: `call_semantic_windows`, только derived vector/provenance/hash/profile/dimension, без копирования текста. FK/CASCADE к call_facts и tenant-bound native SA sources. Для MySQL SA UUID-полей явно сохранена utf8mb4_unicode_ci, отличная от CDR call_key collation. Manifest/catalog изменены только ограниченными0054 entries;0051–0053 принадлежат Autodial.
- Версионированные окна расшифровки с overlap, участником, исходным сегментом/таймкодом. Индекс по tenant/call/node/run/transcript/content hash/model/profile/dimension. Неподходящие/повреждённые векторы не участвуют и перестраиваются.
- Ограниченная on-demand очередь: максимум64 ожидающих окна,16 новых за запрос, вычисление документа после SQL commit. Сериализация общей CPU-модели, bounded failures/retry, нормальное завершение worker. Это ещё не event-based обработка всего архива.
- Свежие page/ProductAccess/project can_transcript/call/participant/node/source grants при чтении и перед записью. Удалённые/истёкшие assets удаляют derived vectors; FK cascades и периодическая очистка. Отзыв доступа исключает выдачу, не удаляет общие для других разрешённых читателей векторы.
- API `mode=semantic`, состояние indexing/ready/unavailable/error и точный охват; найденный фрагмент открывается существующим reader. Никакого hashed_bow или буквального поиска под названием семантики. Саммари не заменяет исходные окна разговора.
- **По умолчанию выключено**: `CDR_SEMANTIC_PREVIEW_ENABLED` разрешает только явный preview. Журнал получает серверный `transcriptSemanticAllowed`. Без флага семантический API403, UI показывает существующий поиск фразы. В собственном проверочном runtime флаг включался явно.

## Проверки и границы evidence

| Gate | Результат |
|---|---|
| targeted backend | PASS:21 тест,3 suites; semantic-targeted-final.log |
| targeted UI | PASS:11 тестов,3 файла; semantic-ui-targeted.log |
| migration catalog | PASS:20 tests |
| MySQL8.4.11 | PASS:27 checks, normal cleanup true; VERIFICATION-SEMANTIC-LAN-mysql.json |
| PostgreSQL17.11 | PASS:27 checks, normal cleanup true; postgres component VERIFICATION-SEMANTIC-LAN.json |
| HTTP actual JWT/SQL/Nomic | PASS: SEMANTIC-HTTP.json, async cold/warm, actual profile256, current authorization negatives, mode validation |
| npm run lint | PASS,0 errors, backend123/frontend100 existing warnings; semantic-lint.log |
| npm run test:backend | PASS:480 suites,4581 tests;27 skipped; semantic-backend-full.log |
| npm run test:frontend | PASS:450 files,2419 tests, runner exit0; semantic-frontend-full.log. Worker termination timeout diagnostics occurred, runner nevertheless completed successfully |
| backend/frontend typecheck | PASS exit0: semantic-backend-types-final.log / semantic-frontend-types.log |
| browser | Journal loads against own JWT/SQL runtime; screenshot semantic-browser-journal.png. Search disclosure stayed collapsed after mouse/keyboard activation, no console errors. **Interaction acceptance not passed**; investigate automation/runtime versus actual UI before declaring browser verified. No semantic result/card/mobile/theme acceptance claimed this slice |
| real Russian retrieval quality | **FAIL**, see below |
| real SA/STT, archive/5M SLA, production release | pending |

Both SQL engines tested actual0054 cache, asynchronous real Nomic embedding, warm reuse, malformed vector repair, CHECK dimension and foreign-tenant FK rejection, grant/node/manual/tenant/participant negatives, deleted/expired vector purge, restore/reindex and call-delete cascade rolled back. The first MySQL attempt failed FK collation; preserved original failed artifact, fixed schema and reran successfully. Do not read outer result of the first mixed artifact as final MySQL result.

Source: unchanged LIVE-LAN-CALLBACKS.json from isolated192.168.2.201 Asterisk16.28 (9 SIP scenarios,10 CDR,120 CEL). ASR/project/account fixtures are **synthetic**, not real STT output. No new LAN calls this slice. Shared Nomic really loaded locally: semantic-real-embedder.log. The HTTP fixture proves mechanism, not relevance.

## Quality finding and next assignment

SEMANTIC-RU-EVAL.json / semantic-ru-eval.cjs: actual shared Nomic,16 authored synthetic Russian documents,64 positive paraphrases and16 no-answer queries. Recall@10=0.859375, nDCG@10=0.5704136365, top1=0.328125; at cosine threshold0.55 **all16 no-answer queries returned false matches**. p95 query253ms is only this isolated corpus measurement, not archive SLA. `qualityTargetsPassed=false`; script exit0 means measurement completed, not quality passed.

Next bounded work under the same PLAN: reproduce/fix browser disclosure and add browser semantic-result/card checks; evaluate calibrated rejection and hybrid/reranking against this fixed corpus, including negation/no-answer cases. If an alternative multilingual embedding profile is required, first record a scoped ADR and coordinate its owner; do not silently replace the shared robots model. Only enable production semantics after RU quality and real route→SA→STT gates pass. Event-based archive indexing, durable queue/backfill, revision/retention contract, multi-recording/player and full archive performance remain separate pending work.

## Ownership / cleanup

Autodial was explicitly informed:0054 bounded manifest/catalog writes finished; it may resume its agreed writes. MySQL0054 SHA256 cd57d703a46a99c12ca612c56a61666bbda325785bca14e2c346fd3350626df3; PostgreSQL0054 5c38a61e61d74ef05aa7d19c0c330569cadf681338eae6553ff7c7a95948e698. Shared embeddings/knowledge/robots sources stayed read-only. Its3181/runtime untouched.

Own browser tab closed; runtime82970 received normal stop, exit0 and SQL cleanup confirmed in BROWSER-RUNTIME-CLEANUP.json. SQL harness engine cleanup true. Old rejected MySQL/PYrP0s resources untouched; no workaround of earlier rejected deletion. No deployment or release performed. Required final handoff: this document, EXECUTION current action and own registry row; no milestone closure.
