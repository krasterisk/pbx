# CDR v1.2 C3/C4 r2 — раскрытие и качество поиска

Координатор прежний /root, chat01a14cff-e054-7ba0-931d-95fd94bfb3e8, codex-direct. Назначение: PLANv1.2 §12.9 slice5 и §12.14; продолжение по прямому поручению пользователя. Общий dirty baseline main10308472 сохранён. Новые migrations/manifest/catalog/shared model/robots/knowledge не менялись. Autodial подтвердил свою область LAN3181/frozen0053; получил сообщение о нашем frontend run20:19, повторный тяжёлый прогон не запускает. Его source6 изменяется параллельно; результаты snapshot прогона не означают приёмку всех последующих смежных изменений.

## Реализация

- Поиск раскрывается нативным HTML `details/summary`; видимость формы больше не зависит от обработчика click пользовательской кнопки. `onToggle` синхронизирует подписку RTK с фактическим открытием; закрытая форма останавливает поиск/проверки. Нативная клавиатура, `aria-controls`, `aria-expanded`, видимый фокус, область нажатия ≥44px. Введённый запрос сохраняется при сворачивании. Прежний отказ custom-button был browser evidence; отдельная ошибка React runtime не доказана, не приписывать ей выдуманную причину.
- Длинный найденный фрагмент ограничен четырьмя видимыми строками в выдаче; полное чтение доступно в карточке. Сам reader не обрезан.
- CDR-only `call-semantic-ranking.ts`: NFKC/ё/Unicode, установленный `natural` Russian Porter stemmer (только чистый submodule, без загрузки root natural с sentiment/DB side effects), query IDF support и fusion70% vector/30% lexical. Никаких словарей с именами тем тестового корпуса. Вычисляются все текущие разрешённые векторы, буквальный отбор кандидатов перед embeddings отсутствует.
- Отсечение: cosine≥0.55 и lexical support≥0.15 либо strong cosine≥0.88 с margin≥0.04 относительно других звонков. Overlap того же звонка не считается конкурентом. Явные числовые токены должны присутствовать. Это предварительная калибровка, не вероятность и не доказанная семантическая эквивалентность. В частности, отрицания полноценно не понимаются.
- Общий shared Nomic,256d, document/query prefixes, vector storage/cache key и robots runtime сохранены. `CDR_SEMANTIC_PREVIEW_ENABLED` остаётся **default-off**.

## Качество: улучшение порядка, незакрытая приёмка

`SEMANTIC-R2-EVAL.json`, semantic-r2-eval.cjs. 80 фиксированных русских development запросов (64 positive/16 no-answer) плюс32 дополнительных заранее записанных запросов (16/16). Настоящие shared ONNX Nomic vectors; cache SHA256 f2d42c7dd2e747bbefcd2e8821d602f55e9d655749a11833c6bf899672b8f69e. Дополнительные32 при первом запуске были held-out; последующие повторения — regression evidence, не новая независимая выборка. Все тексты synthetic, реальный ASR не заявляется.

| Метрика | dev cosine | dev hybrid | additional cosine | additional hybrid |
|---|---:|---:|---:|---:|
| Top1 |32.81%|68.75%|37.50%|75.00%|
| Recall@10 после отсечения |85.94%|78.13%|93.75%|75.00%|
| nDCG@10 |0.5704|0.7415|0.6787|0.7500|
| Запросы без ответа, получившие ложное совпадение |100%|50%|100%|31.25%|

Цена более строгого отказа — потеря части полезных перефразировок. **Quality targets FAIL**, C3 не закрыт и производственное включение не выполнено. Исследование centering не улучшило баланс; exploratory artifacts сохранены отдельно, их лучшая метрика не выдаётся за конечную выдачу.

## Дополнительный локальный reranker — только исследование

Проверен официальный [cross-encoder/mmarco-mMiniLMv2-L12-H384-v1](https://huggingface.co/cross-encoder/mmarco-mMiniLMv2-L12-H384-v1), pinned1427fd652930e4ba29e8149678df786c240d8825, ONNX model_quint8_avx2 через уже установленный Transformers.js. Cache только в own `../../.artifacts/legacy/.planning/cdr-reports-ux/reranker-cache`; никаких изменений общего embedder/env/robots, отправки разговоров провайдеру или нового production loader.

`semantic-r2-crossencoder.mjs` / `SEMANTIC-R2-CROSSENCODER.json`: все16 документов на112 synthetic запросах, CPU2threads, p95 batch16≈2192ms. При raw-logit threshold0 dev Recall/Top1=43.75%, no-answer false6.25%; additional Recall/Top1=87.5%, false6.25%. Без отсечения Top1=89.06%/100%. Явные противоположности «согласился на запись» и «не согласен» модель считает релевантными. Нулевой logit не является вероятностью или доказательством согласия. Результат **не прошёл** приёмку и не интегрирован в сервис. Прогон всех документов не доказывает качество shortlist/200окон/архива или p95 production API.

Следующий quality slice: отдельно измерять relevance и соответствие утверждению/отрицанию, расширить реальные размеченные русские разговоры и queries; CDR-specific reranker/entailment contract и калибровку отказа оформить до интеграции. Не менять shared Nomic/model/profile роботов. Не включать CE с низким recall лишь из-за красивой метрики первых результатов.

## Проверки этого среза

- Targeted backend18/3 PASS, плюс final ranking4/1 PASS после нормализации stop-word словоформ. Первичная попытка импортировать root natural упала на ESM sentiment dependency в Jest; исправлена глубоким импортом существующего pure stemmer, без изменения test runner или mock его алгоритма.
- Native disclosure UI3/1 PASS; final UI11/3 PASS: open/collapse, query subscription, result context, explicit semantic mode/unavailable, reader/journal regression. Полный frontend452 files/2422 tests PASS, runner exit0; завершающие scoped backend/frontend lint PASS без вывода ошибок. Логи semantic-r2-ui-final/scoped-*-lint/frontend-full.
- Full backend482 suites/4590 PASS,27 skipped; worker teardown diagnostic сохранён в логе. Lint0errors (backend123/frontend100 warnings). Backend/frontend typecheck exit0. Эти проверки относятся к зафиксированному срезу, не закрывают смежный Autodial source6.
- HTTP `SEMANTIC-R2-HTTP.json` PASS: actual JWT/MySQL/ProductAccess/shared Nomic, async cache ready2/2, anonymous401, noSA403, foreign tenant empty, invalid mode400. SQL statements/schema не менялись; обеСУБД0054 evidence предыдущего среза остаётся исторической, новым PG прогоном его не называть.
- Browser: журнал8звонков, буквальный поиск «фраза100», переход на Materials/точный найденный segment100, «Читать с начала» показывает segment0, chronology/graph switch, mobile390 dark и320 light, semantic ready2/2/result проверены в собственном runtime. Телефонные CDR/CEL — неизменённый actual192.168.2.201 cohort;101 ASR segments/config/accounts synthetic. Screenshot evidence в этой папке. Full-shell/navigation to SA/audio/realSTT/release не проверены.
- На320px dialog width320, client319/scroll319, document client/scroll320: горизонтального переполнения карточки нет. Открытие поиска pointer и keyboard подтверждены; несколько tool click/CDP/webview timeouts сохранены как проблемы проверки, действия продолжались только после свежего состояния. Не выдавать их за root cause продукта. Scoped101 видит7звонков, поиск по содержанию отсутствует. Receipt SEMANTIC-R2-BROWSER.json; viewport reset, собственная вкладка закрыта.

## Handoff / остающееся

Own temporary runtime14227/3512 штатно остановлен командой `stop`, exit0/SQL cleanup подтверждены BROWSER-RUNTIME-CLEANUP.json (13:41:48UTC), listener3512 отсутствует. После прерывания non-TTY запуска остался один own MySQL PID585344, exact datadir `C:/Users/Professional/AppData/Local/Temp/krasterisk-cdr49-mysql-kKxdNT`, port27866/loopback, start20:19:34+07; Node parent отсутствовал, in-memory password потерян. Повторно проверена точная identity, остановлен только этот disposable процесс, каталог **сохранён**, SQL-graceful shutdown для него не заявляется: SEMANTIC-R2-ORPHAN.json. Это другой ресурс, старые rejected MySQL/PYrP0s не затрагивались. Новых процессов/ресурсов Autodial не останавливали.

Следующее действие: C3 quality contract/отрицания/калибровка и реальный размеченный STT corpus; shared model остаётся read-only, отдельный reranker только после доказанной приёмки. C1 multiple recordings/player, archive indexing/retention/events,5M/load, E2 LLM/full-shell и release остаются pending по основному PLAN. Source/evidence этого среза сохранены, без commit/stash/reset. Никакого deploy/release/закрытия C3 или milestone.
