# CDR C3/C4 r5 — STT, факты и новая выборка

Coordinator `/root`, chat01a14cff, `codex-direct`; PLANv1.2 §12.18. Baseline main10308472/shared dirty сохранён. Новых агентов/commit/deploy/миграций нет. Общие robots/Nomic/SA/provider catalog и Autodial runtime не менялись.

## Повтор aiPBX STT

Глобальные назначения `/platform/tenants` прочитаны SELECT-only на primary ipbx.krasterisk.ru до и после проверки: STT66 `aipbx stt` → `https://aipbx.ru/api/whisper/transcribe`, LLM59 DeepSeek/`deepseek-flash`. Fingerprints не изменились: [начало](../../../.planning/cdr-reports-ux/SEMANTIC-R5-PLATFORM-PROVIDERS.json), [конец](../../../.planning/cdr-reports-ux/SEMANTIC-R5-PLATFORM-PROVIDERS-FINAL.json).

Проверен неизменённый production путь `toSpeechEngine` → `transcribeProviderAudio`, не просто health и не другой endpoint. Все16 новых MP3 распознаны: **813 сегментов с реальными ASR offsets**, HTTP200. Первый файл:24.187s,28 сегментов. Один запрос получил502; повтор того же файла тем же драйвером успешен за61.856s. Самый долгий успешный запрос89.824s. Никаких fallback/config/network/firewall изменений. Прежние HTTP502/health unavailable/timeout receipts сохранены как история, не текущее состояние всех запросов. [Batch receipt](../../../.planning/cdr-reports-ux/SEMANTIC-R5-STT-BATCH.json), individual `SEMANTIC-R5-STT-DRIVER-*.json` содержат только безопасные метаданные.

Оригинальные audio SHA проверены. Новые ASR JSON/сырой ответ/исходный звук/разметка лежат вне репозитория в private evidence `Documents/Codex/cdr-semantic-r5-20261018`; имена/телефоны/тексты в публичные receipts не выгружаются. Содержание аудио человеком не прослушано. Стерео не объявляется подтверждённой идентификацией голосов: speaker unknown. Производные IDs не являются native CDR/SA identifiers.

Дополнительная проверка декодированных MP3 выявила5 последних ASR-сегментов вне аудио, превышение0.96–4.152s: [audio timing](../../../.artifacts/legacy/.planning/cdr-reports-ux/SEMANTIC-R5-AUDIO-TIMING.json). Это дефект качества исходных offsets, а не успешная полная проверка всех813 временных границ. Все25 выданных holdout anchors и76 цитат внутри реальной длительности: [anchor timing](../../../.artifacts/legacy/.planning/cdr-reports-ux/SEMANTIC-R5-ANCHOR-TIMING.json). Хвостовые offsets не обрезались и frozen corpus не переписывался. Полная проверка/нормализация ASR bounds по известной media duration остаётся совместным gate с SA owner; нельзя заменять её длительностью целого CDR при нескольких записях.

## Что изменено в CDR

- `call-semantic-evidence-guards`: явно запрошенная аббревиатура должна подтверждаться этим разговором; допускаются явно произнесённая полная форма и ограниченные повторённые ASR буквы. Квота не приравнивается к ОМС. Полностью прописная фраза не превращается в список аббревиатур. Это ограниченный conservative guard, не универсальная языковая модель.
- Позднее исправление относительного дня проверяется по доверенному календарю самого звонка. Если «завтра» исправили на четверг, а call clock отсутствует, выдача воздерживается от узкого утверждения. Если календарь действительно связывает завтра с четвергом, совпадение сохраняется. Дата анализа/загрузки/имя файла не используются для угадывания.
- `call-text-search.service`: в evidence передаётся native authorized started_at/business timezone; после inference timezone перечитывается. Смена пояса, текста, run, node, grant, cohort или прав отменяет старую выдачу. LLM по-прежнему вне SQL transaction; audit — только в свежем конечном snapshot, без разговоров/запросов.
- Grounding-v4 уточняет конкретный объект/тип/специальность: наличие цены или фамилии не доказывает неназванный тип услуги. Общая модель роботов не меняется. Лимит полного разговора240 сегментов вместо160, общий бюджет40k символов/12 кандидатов/2 одновременных provider I/O сохранён; неполный источник явно ограничивает coverage. Один LLM-вызов на запрос остаётся: неуспешный эксперимент с повторной проверкой цитат не внедрялся.
- Nullable timing разрешён только как явный `unavailable` для отдельного external-transcript evaluation. Native search требует исходные числовые offsets. Это не разрешение выдумывать нулевые таймкоды в журнале.

## Два старых случая

[Диагностический replay](../../../.planning/cdr-reports-ux/SEMANTIC-R5-TWO-CASES.json) использует исходные сохранённые real DeepSeek responses и прежние source-hashed ASR. В обоих случаях раньше1 результат, теперь0; более широкие формулировки guard сохраняет. Это проверка guard на повторно использованных данных, не новый независимый quality score.

1. «Специалист уже перезвонил после заявки по ОМС»: обратный звонок по квоте упомянут; именно заявка по ОМС не подтверждена. Нельзя объявлять, что обратного звонка вообще не было.
2. «После переноса отменили на завтра»: оператор исправил день на четверг. Без достоверной даты звонка связь завтра/четверг неопределённа; это abstention, не доказанное отрицание события.

## Новая проверка качества

[Source freeze](../../../.planning/cdr-reports-ux/SEMANTIC-R5-SOURCE-FREEZE.json): новые SHA-sorted записи17–32, предыдущие16 исключены; split8/8 создан до ASR/чтения. Для каждого файла заново получены offsets; старые ordinal labels не переносились. Автоматические проверки exact text overlap с прежним audio corpus и уже просмотренной вспомогательной PG calibration пройдены; это не гарантия отсутствия всех похожих перезвонов.

32 calibration queries размечены до model output. V3: recall16/16, один false/no-answer из16 (6.25%). Найден вывод неназванной специальности из контекста лечения. После явного примера concrete-object в prompt-v4: recall15/16 (93.75%), false0/16, precision1, без verifier ошибок и partial reasons. Потеря одного нужного результата сохранена в receipt, а не скрыта. [V3](../../../.planning/cdr-reports-ux/SEMANTIC-R5-CALIBRATION.json), [V4](../../../.planning/cdr-reports-ux/SEMANTIC-R5-CALIBRATION-V4.json).

[Algorithm freeze](../../../.planning/cdr-reports-ux/SEMANTIC-R5-ALGORITHM-FREEZE.json) предшествует просмотру восьми holdout ASR. Затем48 запросов (24 positive/24 no-answer) исчерпывающе размечены по8 кандидатам до первого model score: [holdout freeze](../../../.planning/cdr-reports-ux/SEMANTIC-R5-HOLDOUT-FREEZE.json). Код/пороги/gold после этого не меняются. [Итог](../../../.planning/cdr-reports-ux/SEMANTIC-R5-HOLDOUT.json): recall24/24=100%, no-answer false0/24, NDCG@10=0.9846; ошибок verifier/partial reasons нет, новых потерь противr3 нет. Baseline r3 recall83.33%, no-answer false95.83% на той же новой выборке.

Есть **один спорный лишний результат на положительный запрос**:25 hits,24 по frozen gold, micro precision96% (macro Precision@10=97.92%). Модель сочла вопрос «есть ли направление?» подтверждением обязательного требования направления. Frozen label отличает наличие документа от явно названного условия; трактовка нуждается в независимой проверке. [Разбор](../../../.planning/cdr-reports-ux/SEMANTIC-R5-HOLDOUT-REVIEW.json) не меняет gold и первоначальный score. Поэтому нельзя писать «вообще нет ложных совпадений». Offline provider p50=2.577s/p95=3.171s/max=6.989s исключают embeddings/SQL/HTTP/UI; не являются пользовательским SLA.

Все labels agent-authored. Нулевой observed false rate на24 отрицательных запросах не доказывает такой же процент на промышленном архиве. Проверка source citations измеряется отдельно от recall и первой точки перехода. `modelBeforeGuards` — ablation того же текущего prompt/ответа, а `r3` — прежний vector/polarity baseline; это не выдаётся за прямую live A/B-проверку всей прошлой production версии.

## Проверки и границы

- Frozen CDR:8 suites/99 tests PASS; source/ACL/timezone race, conservative guards, quoted offsets, provider selection, queue limits, ranking/index regressions.
- Corpus validators:27 unit tests PASS (synthetic fixtures только валидируют harness, не входят в quality metrics).
- Production build-types (`tsconfig.build.json --noEmit --incremental false`) PASS, root lint PASS0 errors (123 backend/101 frontend warnings), final scoped lint PASS.
- `npm run test:backend`: exit0,492 passed suites/1 skipped;4745 passed tests/27 skipped. Snapshot старт16:42:34.990UTC по новому redirected log, финиш16:45:44.741; до финального prompt-v4. Последние CDR дельты закрыты frozen99/types/scopedlint и реальными model runs. `semantic-r5-backend-full-corrected.log`.
- Первая попытка root script с relay `--runInBand` отклонена npm, не PASS. Прямой tsc общего tsconfig включил многочисленные существующие соседние spec/rootDir ошибки и собственный `never[]` inference; свой inference исправлен, производственный config проверен отдельно. Ошибочный запуск не подменяет production types gate.
- Frontend r5 не менялся. Единственный текущий fullFE12 выполняет Autodial owner; отдельный конкурирующий heavy run не запускался. Исторический r4 fullFE не считается acceptance его новой версии.
- Native CDR/SA SQL+HTTP/browser новой verifier integration, независимые audio/human labels, industrial recall/latency/quota/5M archive и release **pending**. Default-off сохраняется. Offline real ASR+реальный DeepSeek не являются production rollout.

## Вспомогательный PG источник

`aipbxru@aipbx.ru` с имеющимся ключом доступен; root login прежде отклонялся. SELECT-only PG inventory нашёл48783 completed Whisper rows. Детерминированно экспортированы16 из одного user/project;5 имеют сохранённые ASR offsets,11 не имеют. Текст хранится как сериализованный JSON реплик: decoder проверяет именно содержимое реплик, а не JSON field names. Роли из старого источника не подтверждены; в eval остаются unknown. Analysis timestamps не превращаются в call clock. Просмотрены только8 calibration, quality evaluation PG не запускался. После восстановления global STT основной новый corpus — NAS, PG не подменяет его.

Итог ограниченного поручения: implemented / automated-tests-passed / global STT+LLM live API verified / fresh offline quality measured. Полная C3 acceptance/release не закрыты. [Verification/handoff](../../../.artifacts/legacy/.planning/cdr-reports-ux/SEMANTIC-R5-VERIFICATION.json).

Следующее действие этого же PLAN: согласовать с SA owner native authorized CDR/ASR end-to-end и media duration/bounds gate, независимо разобрать требование направления vs его наличие и calibration miss; затем quotas/latency на native cohort. Conservative acronym guard использует явное прописное написание query anchor; регистр/варианты ASR требуют отдельной проверки recall до принятия этой защиты как общей языковой гарантии. Повторное использование этой holdout выборки считать development regression, не новым тестом. Секрет provider-transfer после проверок удалён; для повторного запуска globals читаются заново. Сохранять default-off и чужой rollout; общий frontend12 gate у Autodial owner.
