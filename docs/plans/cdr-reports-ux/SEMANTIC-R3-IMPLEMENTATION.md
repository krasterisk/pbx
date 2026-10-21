# CDR v1.2 C3 r3 — явные противоречия и ложные fallback

Тот же координатор /root, chat01a14cff-e054-7ba0-931d-95fd94bfb3e8, codex-direct, main10308472/shared dirty baseline. Прямое назначение пользователя, PLANv1.2 §12.9 slice5 C3/C4, §12.15–12.16. Владельцу Autodial переданы границы и потребление ресурсов. LAN3181/frozen0053, его контейнеры, схемы/manifest/catalog, shared Nomic/knowledge/robots/SA/UI/contracts не менялись. Никакого deploy или смены общей модели.

## Реализация

- CDR-only `call-semantic-polarity.ts`: ограниченный veto для явно противоположных утверждений с совпадающим stem-предикатом и близким предметным контекстом. Отдельно распознаются формы согласия и конструкции отказа/запрета. `не` не теряется при этой проверке, хотя lexical bag продолжает исключать stop words. Нет словаря тематик/идентификаторов корпуса и нового inference runtime.
- Отрицание ограничено фразой; учитываются отрицательные вспомогательные формы. Условия проверяются до разделения по запятой. Вопросы, альтернативы «или», косвенное «ли», модальные и двойные отрицания оставляются без вывода о противоречии. Упоминание темы/инфинитивная просьба не равны факту результата. «Нет/без» не получают выдуманную синтаксическую интерпретацию. Если в документе есть согласованное положительное свидетельство, противоположное не используется как безусловный veto.
- `cdr-hybrid-ru-v2`: противоречащее окно исключается независимо от высокого cosine. Чтобы вместо него не появилось случайное совпадение по одному слову, более слабый кандидат другого звонка исключается, если противоречащий соперник имеет не менее сильный vector и больше совпавших query terms. Равная текстовая поддержка и другие окна того же звонка этим правилом не блокируются. Старые числовые ограничения, текущие ACL/cohort/profile/hash и strong-paraphrase путь сохраняются.
- Валидное индексированное окно, исключённое по смысловому противоречию, остаётся `indexed`: оно не превращается в missing/failed и не запускает бесконечное переиндексирование. Отдельный service-level regression проверяет это с cosine=1 и default-off.

Это **эвристическая проверка поверхностных утверждений**, не морфологический/синтаксический parser и не NLI/entailment модель. Роли, время, цитируемая речь, отрицания без пунктуации и синонимы предикатов в общем виде не решены. Слова «согласие» в обсуждении темы не гарантируют согласия клиента. Не расширять claims до полноценного понимания разговора.

## Измерения

`semantic-r3-eval.cjs` / `SEMANTIC-R3-EVAL.json`: старые80+32 synthetic queries теперь считаются regression, не новым held-out. Настоящие shared Nomic256 CPU vectors, исходный cache SHA256 `f2d42c7dd2e747bbefcd2e8821d602f55e9d655749a11833c6bf899672b8f69e`; R2 artifacts сохранены. Report содержит SHA256 конечных ranking/polarity sources.

| Метрика | development r2 → r3 | additional regression r2 → r3 |
|---|---:|---:|
| Recall@10 |78.125% →78.125%|75% →75%|
| Top1 |68.75% →68.75%|75% →75%|
| nDCG@10 |0.7415 →0.7415|0.7500 →0.7500|
| No-answer queries с ложной выдачей |50% →43.75%|31.25% →25%|

Ранее находившиеся нужные звонки в этих наборах не потеряны (`lostRelevant=[]`). Исправлены противоположные consent/refusal и слабые тематические fallback для двух запросов. Остальные false matches (погода/завтра, работа, скидка, банковские реквизиты, перенос приёма и т.п.) остаются. **Quality gate FAIL**, C3 не принят, semantic preview по умолчанию выключен.

`semantic-r3-polarity-corpus.cjs` записан до первого scoring этого файла;12 новых synthetic минимальных контрастов (публикация отзыва, визит, счёт, замена блока, копия акта, комментарий). `SEMANTIC-R3-POLARITY-EVAL.json`: raw cosine oppositeReturnedRate100% → r3 0%, Recall@5=100% сохранён, Top1=75% →100%. Это диагностика распознаваемых конструкций, **не независимая продуктовая/real-ASR приёмка** и не оценка всех русских отрицаний.

Отклонённый опыт: требование минимум двух общих terms для длинного запроса уменьшило false matches, но dev recall упал78.125% →35.9375%. Правило **удалено из конечного кода**; `SEMANTIC-R3-STRICT-REJECTED.json` / log сохранены. Промежуточный subset-only fallback также сохранён как `SEMANTIC-R3-SUBSET-EXPERIMENT.json`; конечный профиль требует большего числа подтверждающих terms только при наличии явного противоречащего соперника.

## Проверки / pending

- Targeted Jest48/4 PASS: polarity, ranking, shared index integration и text-search ACL/default-off. `semantic-r3-targeted.log`.
- Root `npm run lint` PASS,0errors,123 backend +100 frontend warnings. Final source build types PASS (`--noEmit --incremental false -p packages/backend/tsconfig.build.json`, semantic-r3-build-types-final.log), final scoped lint PASS0errors (`semantic-r3-scoped-lint-final.log`). Full `npm run test:backend` exit0:485 passed suites,4625 passed tests,1suite/27tests skipped (`semantic-r3-backend-full.log`); известный worker-teardown diagnostic сохранён, падений тестов нет.
- Shared full frontend `npm run test:frontend` PASS:12/12chunks,453files/2424tests, exit0, receipt владельца Autodial `supervisor-review-20261018/implementation/root-frontend-6-exit.json`, finished14:32:10UTC. Повторный runner не запускался; CDR r3 frontend/shared вообще не менял. Это cut6 snapshot, не полная приёмка последующих смежных source7 изменений. Точный receipt, log SHA256 и итог включены в `SEMANTIC-R3-VERIFICATION.json`; владелец уведомлён.
- Bounded CPU diagnostic:200 synthetic windows×4000chars,12 calls, p50≈814ms/p95≈1101ms чистого ranking (`SEMANTIC-R3-RANKING-TIMING.json`, reproducible semantic-r3-ranking-timing.cjs). Включает первый вызов, без embeddings/SQL/HTTP; не baseline comparison, archive/5M/SLA gate им не закрывается. Дальнейший inference/reranker внутри SQL transaction недопустим; текущая regex/stemming работа ограничена existing200-window cap.
- Browser/HTTP/обеSQL — **не перезапускались**: r3 меняет только чистую CDR ranking логику. Исторический r2 browser/HTTP и0054 SQL evidence не переименовывать в r3 live-verified. LAN и собственный SQL/UI runtime не запускались.
- Первоначальный root npm targeted вызов дал EUNKNOWNCONFIG до тестов; direct installed Jest прошёл. Spec-inclusive backend tsc снова дал старые rootDir/shared/spec diagnostics; formal build-source config прошёл. Неверный cwd для formatter исправлен, итоговый formatter и targeted PASS. Эти диагностические попытки не являются зелёными проверками.

## Следующее действие / handoff

1. Все own backend/lint/types/eval runners закончены exit0; shared frontend receipt получен exit0. Агрегированный результат — `SEMANTIC-R3-VERIFICATION.json`, source SHA256 сопоставлены с конечным кодом. Никаких собственных SQL/UI/LAN ресурсов в r3 нет; чужие ресурсы не останавливались. Следующее назначение — quality contract/corpus из пункта2, не повторение уже зелёных технических gates.
2. Следующий C3 quality slice: размеченный real-STT corpus с раздельными группами по звонку/теме/говорящему, временными изменениями решения, цитатами, double negation/no punctuation и hard no-answer. Старые112 запросов больше не использовать как независимую калибровочную приёмку. Зафиксировать precision/recall/abstention и стоимость latency отдельно.
3. Проверка утверждения должна учитывать actor/action/object/polarity/time, а relevance cross-encoder сам по себе не доказывает факт. Исследование отдельного CDR reranker из r2 остаётся вне production. До runtime integration нужны bounded CDR profile/ADR, эксперимент на новой отложенной выборке, inference вне SQL transaction и fresh reauthorization перед выдачей. Shared robot model остаётся read-only.
4. Archive/event indexing, real-STT, multiple recordings/player, E2/full-shell,5M/load и release остаются pending основного PLAN. Нет commit/stash/reset/deploy/закрытия C3 или milestone.
