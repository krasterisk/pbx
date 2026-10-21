# CDR v1.2 C3/C4 r4 — глобальные модели и проверка фактов

Координатор прежний: `/root`, chat `01a14cff-e054-7ba0-931d-95fd94bfb3e8`, `codex-direct`; canonical PLAN v1.2 §12.9 slice5, §12.17. Main HEAD10308472 и общий dirty baseline сохранены. Без субагентов, commit/reset/stash, deploy, новых SQL schemas или изменения общей модели роботов. Это завершённый ограниченный implementation slice; **C3/качество/реальный глобальный STT/native live acceptance/release не завершены**.

## Что изменено

- Общий Nomic256 переиспользуется без изменения модели/profile/query-document prefixes. CDR index дополнительно отдаёт только внутренний recall pool (cosine≥0.35); прежний r3 ranker/polarity сохранён. Непроверенные кандидаты не становятся пользовательскими строками.
- Новый CDR `call-semantic-grounding.ts`: общий contract prompt и строгая проверка результата. Различаются тема, вопрос, просьба, обещание и выполненный факт; объект, роль, отрицание, исправление даты и короткие ответы учитываются в контексте. Цитаты поддержанного результата проверяются по **тому же callId/segmentId и тексту**, а не по summary. Отрицательная классификация никогда не превращается в hit; её пояснительные цитаты игнорируются.
- Client переиспользует текущие provider auth/chat URL/DeepSeek structured-response helpers. Service читает **назначенный глобальный LLM** через PlatformSpeechModelsService/AiProvidersService, без tenant-name/default/env fallback. Проверяет provider revision после вызова. Ошибки HTTP не сохраняют Axios cause с Authorization и разговорами. Timeout45s, максимум2 provider I/O на процесс, redirects отключены.
- Search: первый RR snapshot собирает разрешённые кандидаты, затем закрывается; LLM выполняется вне SQL; перед возвратом заново проверяются user/product/pages/scope и RR whole-call/project/node/run/retention/content. Смена источника/прав/провайдера отменяет выдачу. Успешный audit создаётся в конечном snapshot без содержимого разговора/запроса. В таблице одна строка на звонок, переход к первой проверенной цитате и её исходному времени, остальные цитаты в snippet. Отсутствие/ошибка LLM не заменяется старыми vector hits.
- Ограничения:12 разговоров,160 сегментов на разговор,40000 символов на inference; обрезанные транскрипты не используются для вывода об отсутствии факта. Shared calls получил только optional verification metadata и `verification_limit`, calls RU/EN — пояснение лимита. ReportsCdrModule импортирует существующий нейтральный AiConnectivityModule. Shared providers/SA/robots/Autodial не редактировались.

## Сверка настоящей конфигурации

[PLATFORM-PROVIDERS](../../../.planning/cdr-reports-ux/SEMANTIC-R4-PLATFORM-PROVIDERS.json): SELECT-only primary **ipbx.krasterisk.ru**, live node process13778/release a7440544 обнаружен заново, без fixed PID. Читались те же cloud_settings/cc_ai_providers, которые обслуживают `/platform/tenants` через GlobalProvidersController.

| Назначение | Глобальный provider | Проверка |
|---|---|---|
| LLM |59, deepseek, `deepseek-flash`, `https://api.deepseek.com/` | Реальный API200, затем реальные ASR→LLM evaluations |
| STT |66, aipbx stt, `https://aipbx.ru/api/whisper/transcribe` | Реальный MP3→HTTP502; fallback отсутствует |

[STT-HEALTH](../../../.planning/cdr-reports-ux/SEMANTIC-R4-STT-HEALTH.json): повторная проверка 23:07 Asia/Krasnoyarsk — health API HTTP200, serviceStatus unavailable. SSH root@aipbx.ru:22 по-прежнему publickey denied; пользователь уведомлён и запрошен актуальный ключ/порт либо восстановление STT. Этот узел отличается от ipbx.krasterisk.ru, где глобальные настройки прочитаны успешно. Действующие назначения/каталог не менялись. Секреты не публиковались; временный приватный transfer с ключами удалён после завершения eval, следующий запуск должен перечитать глобалы.

## Реальные записи и ограничения разметки

LAN inventory двух доступных MySQL кабинетов показал0 ASR/SA строк, PostgreSQL — отсутствие SA tables; MariaDB auth fail не выдаётся за проверенную пустую БД. Autodial namespace/3181/его7 контейнеров и0053 не читались и не менялись.

Пользователь предоставил49 stereo MP3. До чтения ASR выбраны first16 по SHA256, до разбора текстов зафиксирован split8/8. Историческое распознавание этих16 через **speech.krasterisk.ru**, а не глобальный STT66, дало442 временных сегмента. Эти результаты сохранены отдельно; **новых успешных распознаваний через STT66 нет**. Полный provenance/audio hashes/ASR/тексты/разметка находятся только вне repo в `C:/Users/Professional/Documents/Codex/cdr-semantic-r4-20261018`. Нет native CDR/SA admission, роли unknown, стереодиаризация и аудиоаудит не выполнены.

80 запросов:32 calibration +48 второй части. Labels подготовлены агентом по ASR с цитатами и exhaustive judgments в каждом8-call cohort; **это не независимая человеческая разметка**. Corpus final SHA256 `5a5be2c58983c2092c386b9a079663c90a780fab0e62ad92ed577cab47112d20`. Validator проверяет исходный MP3/hash, identities, отсутствие пересечения split по audio/text/query, labels/evidence, path containment;17 harness tests PASS.

## Измерения и незакрытая приёмка

| Выборка | Вариант | Recall@10 | No-answer false | Первая цитата в размеченном evidence | Ошибки verifier |
|---|---|---:|---:|---:|---:|
| Calibration32 | r3 |90.63% |14/16 (87.5%) |6.67% |— |
| Calibration32 | v2 |100% |0/16 |62.5% |0 |
| Frozen second48 | r3 |83.33% |19/24 (79.17%) |0% |— |
| Frozen second48 | grounding-v1 |70.83% |1/24 |82.35% |5 |
| **Reused second48** | grounding-v2, final parser |100% |**2/24 (8.33%)** |87.5% |0 |

Сначала v1 был заморожен до чтения второй части. Первоначальный runner прерывался при invalid model output; затем выполнена только measurement-поправка: собрать все48, записать ошибки и не считать их успешной приёмкой. [Frozen holdout receipt](../../../.planning/cdr-reports-ux/SEMANTIC-R4-HOLDOUT.json) сохранён. На повторной calibration-v1 модель уже дала1 ложный ответ вместо исходных0: недетерминированность не скрыта и нулевой первый прогон не объявлен гарантией.

v2 после анализа ошибок сохраняет короткие «да/нет» и числа вместе с контекстом, уточняет intent/object/time. При этом второй split уже просмотрен: [v2 result](../../../.planning/cdr-reports-ux/SEMANTIC-R4-V2-REUSED-CORPUS.json) — **development regression, не новый holdout**. Его единственная format failure была отрицательным verdict с реальной пояснительной цитатой. Final parser безопасно отбрасывает такую цитату; [revalidation receipt](../../../.planning/cdr-reports-ux/SEMANTIC-R4-V2-REPLAY.json) повторно проверяет сохранённый настоящий ответ, **без нового LLM вызова и без подмены классификации**. Исходный failed receipt остаётся. Поддержанные выдуманные цитаты, чужие IDs, неполные/повторные строки по-прежнему отклоняются.

Recall считается по звонкам, groundedRecall — по попаданию хотя бы одной цитаты в размеченный сегмент; exact navigation — только первой цитаты, не любой из списка. Precision — macro precision фактически возвращённых первых10 результатов непустых выдач. Охват —8-call cohorts, не поиск всего16-call архива и тем более не миллионов звонков.

Оставшиеся2 совпадения и условия gold review зафиксированы в SEMANTIC-R4-LABEL-REVIEW.json. Предшествующий звонок по квоте и относительные даты без доверенного call timestamp требуют аудио/человеческой проверки; не вычищать их из frozen metrics. Второй split остаётся выше5% target. **Quality gate FAIL/default-off**, не объединять его с calibration ради формальных5% по общей выборке.

## Проверки

- Финальные CDR targeted: **7 suites/87 tests PASS** (grounding/client/provider/global-only/queue bound/fresh source+grants/no vector fallback/старые ranking/polarity/index regressions).
- Source race checks: отзыв project grant, новый run, изменённый текст, node, исчезнувший звонок, смена scope; inference действительно после завершения SQL. Смена provider secret/assignment и отсутствие глобального LLM закрыты unit mocks. Это **unit**, не новый live SQL/HTTP/browser proof.
- Root lint PASS:0 errors,123 backend и101 frontend warnings; final scoped lint после последней parser правки также PASS (exit0).
- Shared build, backend/frontend types PASS; frontend search/journal final targeted2files/7tests PASS; corpus validator17 PASS.
- Полный backend runner фактически выполнил весь suite из-за проигнорированного plural testPathPatterns: exit0,489 suites/4683 tests,27 skipped; лог semantic-r4-targeted.log. Это full snapshot до последних небольших CDR counter/prompt/parser правок; их закрывает финальный targeted87, не выдавать за повторный весь suite.
- Собственный root `npm run test:frontend`: exit0,454files/2429tests, лог semantic-r4-frontend-full.log, snapshot стартовал22:11 до наших additive locale/typedef deltas и поздних Autodial frontend11. Конечные own UI/type gates перечислены выше. Смежный владелец уведомлён, его текущий full runner не дублировался.
- Первые targeted npm invocation с неверным relay flags и frontend invocation с неверным cwd завершились ошибкой инструмента; исправленные команды прошли. Initial lint выявил намеренно потерянный Axios cause; добавлено локальное обоснование privacy исключения preserve-caught-error, затем root lint прошёл.

## Следующее действие / handoff

1. Продолжать **это же** C3/C4 назначение и PLAN §12.17, без новой orchestration цепочки. Код заморожен; основной SQL index/schema0054 и общая Nomic не меняются. Autodial владеет LAN3181/0053/shared editor/auth инициативой; наша строка registry и CDR-only files — здесь.
2. Получить ответ на уточнение SSH/STT; при восстановлении использовать только `semantic-r4-platform.cjs` (перечитать назначения безопасно) → `semantic-r4-global-stt.cjs --limit=1`, затем16 последовательно. Исторический semantic-r4-transcribe.cjs и sibling env больше не запускать вместо глобального провайдера.
3. Новые ASR сохранять `.platform.json`; проверить SHA и таймкоды, создать **новую** версию корпуса/разметки, не переносить старые cue ordinals на изменённый текст. Независимо проверить неоднозначные звонки, роли, исправления даты и контекст callback. Для календарной интерпретации нужны доверенные startedAt/timezone; не угадывать их из названия файла.
4. Новая ранее не просмотренная выборка + repeatability/negative controls + native authorized CDR/SA end-to-end SQL/HTTP/browser. До этого CDR_SEMANTIC_PREVIEW_ENABLED не включать по результатам текущего development regression. Archive index/performance/player/E2/full-shell/release остаются чужими/следующими gates, не закрываются этим срезом.
