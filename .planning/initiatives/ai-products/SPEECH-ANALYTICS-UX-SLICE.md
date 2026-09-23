# Речевая аналитика — детальный срез кабинета

Дата: 2026-09-22. Статус: разбор текущего кабинета, не план работ. Полный рефакторинг — корневая GSD Phase 18 (`.planning/phases/18-polnyy-refaktoring-rechevoy-analitiki/18-BRIEF.md`). Лицензию, SKU и публичный контракт загрузок не переписывать. Внутренние маршруты АТС, конструктор графиков и AI-insights в этот разбор не входили; для Phase 18 это не ограничение.

Опора: [ANALYTICS-SPEC](ANALYTICS-SPEC.md) AN-02, AN-04, AN-07, AN-08, AN-09, AN-10. Эталон поведения — проекты, журнал с загрузкой и дашборд aiPBX; биллинг, выбор клиента и конструктор оттуда не переносить.

## 1. Инвентаризация API

Сверено с `SpeechAnalyticsJwtController`, `SpeechAnalyticsService`, `SaReportingService`, `SaProjectConfigV1` и `speechAnalyticsApi.ts`.

| Нужно экрану | Уже есть | Чего не хватает |
|---|---|---|
| Список проектов, имя, статус, публикация, архив | `GET/POST /speech-analytics/projects`, `POST .../publish`, `PUT .../intake` (`enabled: false` ставит `archived`) | Поиска, шаблонов и удаления нет. Описание проекта в `sa_projects` нет: только `name`, `status`, `draft_revision`, `draft_config`, `active_version_id`. |
| Контекст и критерии мастера | `PUT /projects/:id/draft` принимает весь `SaProjectConfigV1` (`language`, ревизии STT/LLM, лимиты). `POST /projects/:id/metrics` публикует рубрику. `GET /capabilities` отдаёт контейнеры и три ключа `greeting_present`, `next_step_agreed`, `topic`. | В конфиге нет текста контекста бизнеса. Шаблона «пустой / продажи / поддержка» нет. Мастер собирает контекст в `draft_config` новым полем `businessContext` (строка, до 2000 символов) и перед публикацией вызывает уже существующий publish метрик. Отдельную колонку описания не добавлять. |
| Загрузка файла | `POST /uploads` → `{ id, expiresAt }`, `PUT /uploads/:id/content` `{ bytesBase64 }`, `POST /uploads/:id/complete` → `{ assetId, state: 'ready' }`, `POST /analysis-runs` (заголовок `Idempotency-Key`) → `{ runId, recordingId }`. Кабинетный пользователь проходит `analytics:upload`: `SaProjectResolver.canAct` пускает любой `analytics:*`, пока проект не в архиве. Прогон требует `active_version_id`; иначе `project_archived`. | Фронт эти маршруты не вызывает. `putUploadContent` пишет только sha256 и длину в `ai_media_assets` и не кладёт байты в `LocalObjectStore`. Плеер по такому asset невозможен. Тело JSON по умолчанию Nest не примет запись на сотни мегабайт, хотя сервис заявляет потолок 256 МБ. Для среза оставить allocate → complete → analysis-run, а `PUT .../content` принимать `application/octet-stream` (сырые байты, тот же метод сервиса) и сохранять объект по `storage_key`. Base64 оставить для маленьких фикстур. |
| Журнал разговоров | `GET /recordings?projectId=` — до 25 строк `sa_recordings`, без статуса прогона. `cursor` в сервисе игнорируется. | Список среза: те же записи плюс состояние последнего прогона (`state`, `runId`, `quality`). Фильтр `from`/`to` и курсор обязательны, иначе дашборд не сможет открыть ту же выборку. |
| Карточка и плеер | `GET /analysis-runs/:id` и `.../result` возвращают `{ run, recording, result }`. `GET .../transcript` возвращает строку `sa_transcripts` без сегментов. Сегменты лежат в `sa_transcript_segments` (`start_ms`, `end_ms`, `text`, `speaker_role`). Повтор и ручная проверка уже есть: `reanalyses`, `reviews`, `transcripts/:id/corrections`. | `GET /analysis-runs/:id/audio` есть только у публичного контроллера и тоже не отдаёт байты: `getRun` при scope `analytics:audio` возвращает те же модели. Для плеера добавить JWT `GET /speech-analytics/analysis-runs/:id/audio` (проверка `analytics:audio`, поток из object store, `Content-Type` по контейнеру). В ответ transcript добавить сегменты. Evidence метрик уже несёт `segmentId`, `startMs`, `endMs` — плеер перематывает по ним без нового контракта метрик. |
| Дашборд | `POST /dashboard` принимает `AnalyticsFilterSpec` (`projectIds`, `from`, `to`, `timezone`, `runSelector`, `view`). `dashboardRow` считает `ranking: insufficient_sample`, пока `scored < 20`. | `dashboard()` после проверки прав всегда передаёт нули. `calculatedAt` в `dashboardRow` зафиксирован как эпоха. Агрегации по `sa_analysis_runs` / `sa_results` нет. |
| CSV | `POST /exports` с `{ filter, rows }` нейтрализует ячейки и требует `analytics:export`. | Сервер сам строки не строит. Экран отчётов шлёт строки той же выборки, что и журнал. Планировщик и PDF не входят в срез. |
| Провайдер не настроен | Прогон всё равно ставится в `queued`, если лицензия есть. | UI не блокирует загрузку. Если у продукта нет провайдера распознавания, карточка показывает состояние прогона и текст, что распознавание не настроено, а не «успех с пустым текстом». |

## 2. Экраны

Навигация модуля `speech_analytics` в сайдбаре, в этом порядке:

1. Обзор — `/speech-analytics` (как сейчас: лицензия и статус провайдеров). Под статусом явные ссылки: Разговоры, Проекты, Подключения, Отчёты, Дашборд.
2. Разговоры — новый маршрут `/speech-analytics/conversations`.
3. Проекты — `/speech-analytics/projects`.
4. Подключения — `/speech-analytics/connections`.
5. Отчёты — `/speech-analytics/reports`.
6. Дашборд остаётся `/speech-analytics/dashboard` и доступен из обзора и из карточки проекта.

Карточка проекта `/speech-analytics/projects/:id` и карточка разговора `/speech-analytics/recordings/:id` в сайдбар не дублировать.

Пустые, загрузочные и ошибочные состояния на каждом экране. Проверка вёрстки на 360 и 1440. Тексты в `ru.ts` и `en.ts`.

### Проекты

Список: поиск по имени на клиенте (выборка и так ограничена 100), статус «черновик / опубликован / архив», кнопка создания.

Мастер из трёх шагов, без отдельного конструктора:

1. Название и контекст. `POST /projects` с именем, затем `PUT /draft` с текущим `draft_revision` в `If-Match` и конфигом по умолчанию плюс `businessContext`.
2. Критерии. Три готовых ключа из capabilities как шаблон «базовый»; пустой шаблон оставляет черновик без метрик. Редактор рубрики остаётся, но внутри шага, а не единственным содержимым страницы.
3. Публикация. `POST /publish`. Пока нет `active_version_id`, загрузка в этот проект недоступна, и мастер прямо говорит, что пробная запись появится после публикации.

Архив — явное действие «В архив» (`intake` с `enabled: false`), не безымянный переключатель. Архивный проект читается, новые загрузки и прогоны сервер отклоняет.

Карточка проекта открывает журнал с `projectId` этого проекта.

### Разговоры и загрузка

Фильтры: проект (обязателен), период. Таблица: внешний идентификатор, время, состояние прогона, качество. Строка ведёт на `/speech-analytics/recordings/:runId`.

Загрузка на этой же странице, только для опубликованного неархивного проекта:

1. Файл WAV, FLAC или MP3 в пределах `capabilities.maxBytes`.
2. `POST /uploads` с `projectId` и `expectedBytes`.
3. `PUT /uploads/:id/content` сырым телом, на экране — доля отправленных байт.
4. `POST /uploads/:id/complete`.
5. `POST /analysis-runs` с новым `Idempotency-Key`, `assetId` и `externalCallId` из имени файла.

Ошибки `project_archived`, `checksum_mismatch`, `upload_overflow` показываются текстом, список не затирается. Повтор того же ключа идемпотентности не создаёт второй прогон.

### Карточка разговора

Сверху состояние прогона. Если провайдер распознавания не подключён и прогон не `completed`, это сказано отдельно.

Плеер: `GET /analysis-runs/:id/audio`. Под ним транскрипт по сегментам; клик по сегменту ставит `currentTime` на `start_ms`. Метрики из `result.metric_results`: значение, статус, основание. Клик по основанию перематывает плеер на `startMs`.

Повторный анализ и ручная правка остаются под результатом, не вместо него.

### Дашборд

Выбор одного проекта и периода (не длиннее 366 суток — сервер ответит `range_too_wide`). Запрос — существующий `POST /dashboard` с `runSelector: latest_completed`, `view: ai`, `timezone: Europe/Moscow`.

Три числа из ответа агрегации, не из заглушки:

- coverage — `scored / eligible`, знаменатель виден;
- quality — доля результатов с пригодным `quality` среди применимых;
- score — среднее по scored-метрикам выборки.

Пока `ranking === 'insufficient_sample'`, рядом подпись, что для ранжирования мало scored (порог 20 уже в `RANKING_MIN_SCORED`). Клик по числу открывает `/speech-analytics/conversations` с тем же `projectId`, `from`, `to` и признаком показателя (`coverage`, `quality` или `score`), чтобы список совпал со знаменателем.

Пауза новых записей остаётся второстепенным переключателем политики, не содержимым страницы.

### Отчёты

Кнопка «Скачать CSV» строит строки по текущему фильтру журнала (проект, период) и отправляет их в `POST /exports`. Пустая выборка даёт файл только с заголовком. Ошибка прав показывается как отказ экспорта.

## 3. Агрегация дашборда

`SaReportingService.dashboard` перестаёт передавать нули. После `validateFilterSpec` и `analytics:read` сервис считает выборку и отдаёт её в `dashboardRow`.

Правила выборки:

- Записи `sa_recordings` тенанта, `project_id` из `filter.projectIds`, `occurred_at` в `[from, to)`.
- На каждую запись один прогон: при `latest_completed` — последний `sa_analysis_runs` со `state = completed` по `updated_at`; если завершённого нет, запись остаётся в `eligible` и не входит в `scored`.
- Результат — `sa_results` по `run.result_id`. `metric_results` разбирается как массив `SaMetricResult`.
- `eligible` — число записей в фильтре.
- `applicable` — записи, у которых есть завершённый результат и хотя бы одна метрика не в `not_applicable`.
- `scored` — применимые результаты, где есть метрика со статусом `scored`.
- `unknown`, `notApplicable`, `unscorable` — записи, у которых все рассмотренные метрики в этом статусе и нет `scored`.
- `revision` — `project_version_id` выбранных прогонов, если он один; иначе `mixed`.
- `qualityRate` и `score` добавить в ответ рядом с полями `dashboardRow`: `qualityRate` = доля `quality`, пригодной к показу, среди `applicable`; `score` = среднее boolean (истина = 1) и числовых scored-метрик. Строковые метрики в среднее не входят.
- `calculatedAt` — время расчёта, не эпоха. Чистую функцию `dashboardRow` не менять для старых тестов; время проставляет сервис при сборке ответа.
- Drilldown использует тот же отбор. `GET /recordings` получает `from`, `to` и необязательный `signal` (`coverage` | `quality` | `score`). Без `signal` возвращаются все `eligible`. С `signal` — только строки, вошедшие в числитель этого показателя. Курсор по `(occurred_at, id)` наконец читается, лимит страницы остаётся 25.

Тесты: фикстура из двух записей, один completed с метрикой `scored` и один queued. Ожидание `eligible: 2`, `scored: 1`, `ranking: insufficient_sample`. Третья фикстура на 20 scored даёт `ranking: ok`. Drilldown с `signal=score` возвращает только scored-запись.

## 4. Порядок работ

1. Сохранение байтов и JWT-аудио, сегменты в transcript, поле `businessContext`, фильтры журнала.
2. Агрегация `dashboard()` и drilldown.
3. Экраны: навигация, мастер проектов, журнал с загрузкой, карточка с плеером, дашборд, CSV.
4. Пустые и ошибочные состояния, ширина 360 и 1440.

Проверка: `npm run test:backend` на speech-analytics и reporting; `npm run test:frontend` на новые страницы. Сквозной сценарий в браузере: создать проект, опубликовать, загрузить короткий WAV, открыть карточку, увидеть плеер и честный статус распознавания, открыть дашборд и CSV по тому же фильтру.
