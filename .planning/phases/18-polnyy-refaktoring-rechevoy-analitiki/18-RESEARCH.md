# Phase 18: Полный рефакторинг речевой аналитики - Research

**Researched:** 2026-09-22
**Domain:** NestJS speech-analytics + Asterisk dialplan hangup → async STT/LLM journal; FSD cabinet UI; platform usage rates without wallet debit
**Confidence:** HIGH (in-repo seams + aiPBX behavior floor verified by file reads); MEDIUM on exact worker/queue wiring for file-wait (pattern clear, no production enqueue today)

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

Правило фазы: функциональность и информативность операторской аналитики aiPBX не урезать. Расширять можно. Оптимизировать только там, где текущая реализация aiPBX доказанно хуже. Перед развилкой смотреть код aiPBX, затем предлагать вариант.

### Включение и маршрут

- **D-01:** Авторазбор решает маршрут. Проект — перечень и редактор метрик, проект маршрут не задаёт. Проекта компании по умолчанию нет. Режимы inherit/off/on заменяются селектом. — **Reversibility:** costly — селект заменяет сохранённые режимы маршрута и ветку диалплана; откат снова разводит «наследовать / выкл / вкл» и проект
- **D-02:** В `RouteFormModal` рядом с записью: если модуль аналитики активен и запись не «Не записывать», показывается селект проекта. Запись выключена — селекта нет и авторазбора нет. Проект не выбран — авторазбора нет. Проект выбран — на маршрут вешается `hangup_handler`.
- **D-03:** После завершения звонка handler отдаёт уже закрытый файл в задание. Задание ждёт, пока файл есть и не пустой. Пустую или так и не появившуюся запись не разбирает. Распознавание внутри handler не выполняется и звонок не блокирует.
- **D-04:** Инструменты маршрутов в AI-чате: список проектов и текущий проект маршрута. Включить — карточка подтверждения «поставить проект». Выключить — карточка «убрать проект». Пока запись выключена, инструмент проект не ставит и говорит, что нужна запись. После подтверждения диалплан перечитывается.

### Журнал и панель

- **D-05:** Журнал «Разговоры» в своей базе аналитики. В CDR Asterisk посторонние файлы не пишутся. Дашборды и выгрузка считаются только по этой базе. Если звонок АТС разобран, в строке CDR есть кнопка «Аналитика» на ту же запись журнала. — **Reversibility:** one-way — записи аналитики и CDR Asterisk остаются разными хранилищами; перенос загрузок в CDR смешает чужие файлы со звонками АТС
- **D-06:** Разговор открывается sheet, не раскрытием строки. У разговора постоянный URL: кнопка CDR и строка журнала ведут на один адрес.
- **D-07:** Вкладки sheet, одинаково из CDR и из журнала: «Аналитика» (саммари, метрики, цитаты, темы и правка супервизора вместе, как `ReportShowAnalytics`), «Расшифровка», «Стоимость». На «Стоимости» посчитанная сумма с пометкой, что списания нет.
- **D-08:** У звонка АТС плеер только в CDR, в sheet плеер не дублируется. У загрузки и API CDR нет, плеер на вкладке «Расшифровка».
- **D-09:** Удаляют и пересобирают администратор кабинета и суперадмин платформы, когда открыт этот кабинет. Владелец проекта, супервизор, оператор и просмотр этого не делают.
- **D-10:** Оценки и темы правит существующий `UserLevel.SUPERVISOR`, плюс администратор кабинета и суперадмин в этом кабинете. Отдельной роли аналитика нет. Роль `analyst` в `sa_project_members` в эту фазу не переносить. Просмотр только смотрит. Оператор чужие разговоры не оценивает.
- **D-11:** Кто кого видит, задаёт существующий список доступа, вкладка CDR. Администратор и суперадмин видят всю компанию. Супервизор и просмотр: список без сужения или пустая вкладка CDR — вся компания; выбранные операторы или очереди — только они. Оператор видит свои разговоры и тех, кого список явно добавляет. Загрузка только с текстовым именем оператора видна загрузившему и тем, у кого список не сужен.
- **D-12:** Пересборка создаёт новый прогон. Строка и sheet показывают последний. Предыдущие прогоны и их суммы остаются на вкладке «Стоимость». Ручные темы и правки супервизора не сбрасываются. Пока новый прогон идёт, виден предыдущий готовый разбор с пометкой «идёт пересборка». Колонка стоимости в журнале — последний прогон.
- **D-13:** Удаление после подтверждения убирает разговор из журнала, дашбордов и выгрузки вместе с историей прогонов и посчитанными суммами. Возврата денег нет: списания в этой фазе нет, и при будущем включении списания удаление `SA-CHARGE-RUN` не сторнирует.

### Загрузка

- **D-14:** Одна форма на один файл и на пачку, как в aiPBX. Один файл — пачка из одного. Поля общие. Форматы mp3/wav/ogg/m4a, максимум 50 МБ. Оператор — пользователь кабинета, если он есть, иначе имя. Проект обязателен, один на пачку: общие оценки и метрики этого проекта. Язык и телефон клиента остаются общими необязательными полями.
- **D-15:** В форме статус «Загрузка...», затем полоса на журнале «сколько готово из скольких». Счётчик хранится в задании и переживает обновление страницы. Файлы разбираются по одному. Ошибка одного не останавливает остальные: этот файл — строка с ошибкой.
- **D-16:** Кнопка загрузки в журнале «Разговоры» и на странице CDR. Обе создают запись журнала, не строку Asterisk CDR.
- **D-17:** Кабинет всегда отвечает пачкой в фоне. Внешний API: один файл с `sync=true` ждёт результат; пачка и запрос без `sync` сразу возвращают пачку.
- **D-18:** «Получить аналитику» в CDR есть, только если у звонка есть запись и модуль аналитики активен. Берётся та же запись, второй копии нет. Проект — выбранный на маршруте этого звонка. Если на маршруте проекта нет, перед запуском его спрашивают.

### Пауза компании

- **D-19:** Пауза останавливает только новые автоматические разборы. Проекты на маршрутах не стирает. Ручная загрузка и «Получить аналитику» во время паузы работают. Снять паузу можно в настройках и той же карточкой подтверждения в чате.
- **D-20:** Уже поставленные и уже ушедшие провайдеру задания доделываются. Звонок, завершившийся после паузы, новое задание не создаёт.

### Покупка модуля

- **D-21:** Покупка и пробный период только открывают модуль: журнал, загрузка, селект проекта у записи, инструменты чата. Ни один маршрут проект сам не получает, авторазбор не стартует.
- **D-22:** Выключенный модуль оставляет проекты на маршрутах. Останавливаются авторазбор, загрузка, API, «Получить аналитику» и инструменты чата. Новые задания не создаются, уже стоящие доделываются. Журнал, дашборды и выгрузка уже посчитанного открываются для чтения. Редактор метрик, смена проекта маршрута, пересборка, удаление, загрузка и правка оценки недоступны. Селект на маршруте скрыт, сохранённый проект не стирается. Повторное включение поднимает те же проекты без новой настройки.

### Стерео и роли

- **D-23:** Стерео — один проход распознавания и роли по энергии каналов. Моно — роли назначает модель. Режим dual-stt выключен. Одинаковые каналы стерео не считаются. Если энергия роли не разложила, роли назначает модель по уже сделанной расшифровке, распознавание не повторяется.
- **D-24:** Запись маршрута (MixMonitor `D`): левый — абонент, правый — оператор. Загрузка и API: левый — оператор, правый — абонент, как в aiPBX. Поменять каналы можно только во внешнем API. Форма загрузки это не спрашивает.

### Публикация метрик

- **D-25:** Редактор сохраняет разделы aiPBX: шаблоны отраслей `real_estate`, `delivery`, `tech_support`, `banking`, `medicine`, `food`, `auto_service`, `insurance`, `ecommerce` и пустой `custom`; свои метрики; скрываемые стандартные шкалы; системный промпт; темы звонка; вебхук событий; дайджест; алерты. Подсказки у редактора, шаблонов, публикации и селекта маршрута. Шаблон заполняет черновик. Неопубликованные правки на звонки не влияют.
- **D-26:** Сначала черновик, затем публикация. Новая опубликованная версия действует только на следующие разборы, загрузки и пересборки. Публикация очередь пересчёта не создаёт. Старую версию отдельно не включают: возврат — правка черновика и новая публикация. Отметка версии — внутренняя, пользователь её не редактирует. Она растёт только когда меняются свои метрики, темы, промпт или видимые стандартные шкалы. Сохранение вебхука, дайджеста, алерта и бюджета отметку не увеличивает. Старые разговоры хранят отметку набора, которым их посчитали.
- **D-27:** Публикуют и удаляют проект администратор кабинета, супервизор и суперадмин в этом кабинете. Оператор и просмотр не публикуют. Чат меняет весь проект (метрики, темы, вебхуки, дайджест, алерты, бюджет) карточкой подтверждения. Подтверждение публикует, когда меняются метрики.
- **D-28:** Бюджет — мягкий лимит посчитанной суммы в валюте кабинета. Ноль — лимита нет. Превышение даёт алерт и вебхук `budget.exceeded`. Разборы не останавливаются. Списания нет. Сумма бюджета — все сработавшие `SA-CHARGE-RUN` за период, не колонка «последний прогон» и не инсайты.
- **D-29:** Получатели дайджеста и алертов — существующие интеграции со страницы «Интеграции» (`NotificationIntegrationsPage`: telegram, email, whatsapp, webhook, max, vk). Второго списка адресов в проекте нет. Если интеграций нет, в редакторе ссылка на эту страницу. Чат выбирает интеграцию карточкой подтверждения. Аномалии (падение CSAT, всплеск негатива относительно базы, минимум звонков и окно) остаются как в aiPBX. Событие вебхука `anomaly.detected` остаётся.
- **D-30:** Вебхук событий остаётся в проекте: URL, свои заголовки, события `analysis.completed`, `analysis.error`, `budget.exceeded`, `anomaly.detected`. Кнопка проверки шлёт реальный HTTP-запрос с этими заголовками и показывает, ответил ли сервер. Доставка постановляется в очередь вебхуков кабинета, разбор её не ждёт. Тело: `event`, `projectId`, `timestamp`, `data`. Отказы видны на существующей вкладке webhook-failures журнала событий.
- **D-31:** Удаление проекта оставляет разговоры с оценками и отметкой набора метрик. Если проект выбран на маршрутах, подтверждение снимает его, и авторазбор останавливается. Токены этого проекта отзываются.

### Токен внешнего API

- **D-32:** Один токен — один проект. Запрос другой проект не подставляет. Секрет показывается один раз, в базе только хеш. Список: имя, проект, время последнего использования. Можно отозвать и выпустить новый. Токен загружает и читает результаты своего проекта. Удаление и пересборка токену недоступны. Срока нет. — **Reversibility:** one-way — секрет показывается один раз и в базе лежит только хеш; откат к открытому хранению, как в aiPBX, уже выданные секреты не восстановит
- **D-33:** Выпускают токен администратор кабинета и суперадмин в этом кабинете. Супервизор не выпускает. Чат создаёт токен карточкой подтверждения: секрет показывается в карточке один раз и в историю чата не пишется. Выключенный модуль токен не удаляет: запросы не проходят, пока модуль снова не включён.

### Дашборд

- **D-34:** Конструктор виджетов aiPBX не переносится. Стандартный экран: верхние карточки, блок инсайтов, настроение, успех, шкалы, свои метрики, динамика. Клик по сегменту открывает журнал с этим фильтром. Цифры уважают список доступа. Разговоры с плохим распознаванием в средние не входят, их число показано. Карточки стоимости суммируют последние прогоны разговоров периода.
- **D-35:** Инсайты — кнопка, не автоматический запрос при открытии страницы. Модель читает уже посчитанные факты дашборда и системный промпт проекта как деловой контекст. Новый проход распознавания не делается. Меньше 10 разговоров — пунктов нет. Кэш до обновления. Типы и доказательства как в aiPBX: strength, gap, trend, outlier, quality; русский текст; клик по доказательству открывает отфильтрованный журнал. Посчитанная стоимость инсайта показана на блоке, в сумму разговоров и в среднее не входит, подпись что списания нет.
- **D-36:** Инструкция инсайтов — скил в репозитории. Кабинет скил не редактирует. Модель инсайтов — настройка модуля из списка платформы. Если не выбрана, берётся модель разбора звонка.

### Выгрузка журнала

- **D-37:** Отдельной страницы «Отчёты» нет. Кнопка Excel на панели журнала выгружает всю текущую выборку, не одну страницу. Те же фильтры и тот же список доступа. У кнопки есть состояние ожидания. Колонки: колонки журнала плюс саммари, расшифровка, качество распознавания, темы, обоснования метрик и все шкалы проекта. Колонки робота не входят (automation rate, escalation rate, cost savings, escalation reason, bail-out, frustration, average turns, dialog completion, entity extraction, context retention, intent recognition). Стоимость в файле — последний прогон. Длинная расшифровка может обрезаться лимитом ячейки Excel, как `truncateCell` в aiPBX.

### Модели разбора звонка

- **D-38:** Умолчание распознавания и модели оценок лежит в настройках модуля. Проект может заменить. Пустые поля проекта значат «как в модуле». Опубликованная версия запоминает, чем посчитан разговор. Старые прогоны не пересчитываются. По умолчанию администратор кабинета модели не меняет: суперадмин включает и выключает это право на тенанта. Суперадмин всегда может задать умолчание модуля и замену проекта, когда кабинет открыт. Супервизор модели не выбирает. Чат без этого права модели не меняет. Выключение права уже выбранную замену проекта не сбрасывает: она действует на новые прогоны, править её кабинет не может. Распознавание и модель оценок — две настройки под одним правом, список — allowlist платформы. Если модель проекта молчит, берётся умолчание модуля, когда оно другое. Если молчит и оно — прогон в журнале ошибка, его можно пересобрать. Запасной модели вне списка платформы нет. Это не D-07 фазы 15: то решение закрывает модель чата АТС, не модели аналитики.

### Разбор по ссылке

- **D-39:** Разбор по ссылке остаётся. Сервер сам скачивает файл в журнал, дальше тот же разбор, что у загрузки. Проект берётся из токена. Скачивается любой публичный адрес и любой адрес локальной сети, отдельного списка АТС нет. Самоподписанный сертификат принимается на любом адресе, как в aiPBX при `OPERATOR_ANALYTICS_ALLOW_INSECURE_SSL` по умолчанию.
- **D-40:** Одна ссылка и `sync=true` — запрос ждёт готовый разбор. Несколько ссылок или запрос без `sync` сразу возвращают пачку «в работе», скачивание идёт следом по одному.
- **D-41:** Запрос принимает те же поля, что загрузка: оператор, телефон клиента, язык. В API можно поменять каналы местами. Метрики и модель из проекта токена, запрос их не подменяет. Согласие, если его прислали, сохраняется у разговора и разбор не останавливает.
- **D-42:** Неполный файл не разбирается. Обрыв, таймаут, пустой ответ или меньше байтов, чем обещано, — ошибка этой ссылки, `SA-CHARGE-RUN` не наступает. Остальные ссылки пачки идут дальше. Файл больше 50 МБ — та же ошибка.

### Золотой набор

- **D-43:** Прогон эталонов — проверка при поставке и при следующей смене промпта или модели оценок. Обычный прогон тестов команду не вызывает. Команда читает готовый текст и вызывает модель оценок. Распознавание речи не нужно. В журнал кабинета строки не пишутся, кнопки в кабинете нет, `SA-CHARGE-RUN` не наступает, с кошелька не списывается. Токены провайдера тратятся.
- **D-44:** Три эталона. Клиники в текстах нет. Оценки эксперта те же, что у aiPBX. Первый — вопрос решён. Второй — нужного варианта сейчас нет, предложена замена, клиент её принял, звонок успешный. Третий — компания запрошенное не оказывает, вежливый отказ с пояснением, что компания делает, и подсказкой, куда обратиться; успех, решение вопроса и знание продукта из-за отказа не снижаются. Это правило `example-003-out-of-scope-service`, не медицинский сюжет.
- **D-45:** Проверка красная, только если разбор не получился: модель не ответила или ответ пустой. Расхождение баллов с экспертом печатается в отчёте (MAE, accuracy, kappa, как в aiPBX) и поставку не останавливает.

### Точки списания

Списание с кошелька в этой фазе не делается. Сумма считается, сохраняется и подписывается как не списанная. Будущая фаза списания ищет только имена ниже и включает кошелёк в этих швах. Новых мест списания по ходу реализации не добавлять: если разбор научился завершаться новым путём, этот путь вызывает тот же шов.

Цены — платформенные ставки Krasterisk для продукта `speech_analytics`, не таблица `Prices` aiPBX и не `decrementUserBalance`. Распознавание считается по `audio_ms`, модель оценок и модель инсайтов — по `provider_tokens`, валюта кабинета. Существующий теневой журнал `packages/backend/src/modules/ai-usage/shadow-settlement.ts` и идемпотентный ключ `packages/backend/src/modules/cloud-admin/billing/idempotent-charge.ts` — шов будущей фазы. В этой фазе `settleShadow` и `BillingBalanceService` на этих точках не вызываются.

- **D-46:** `SA-CHARGE-RUN` — один посчитанный итог на каждый успешно завершённый прогон. Шов вызывается сразу после того, как прогон сохранён со статусом успеха, и вызывается даже если сумма нулевая: нулевая ставка не прячет точку. В шов передаются идентификатор прогона, части `audio_ms` и `provider_tokens`, итог и валюта. Ключ будущей операции — идентификатор прогона, чтобы повтор того же прогона не списал дважды, а пересборка получила новый ключ. Точка наступает на всех путях успешного прогона: задание маршрута после hangup, каждый файл загрузки, файл API, ссылка после полного скачивания, «Получить аналитику», пересборка. Ошибочный прогон (пустой файл, обрыв ссылки, файл больше 50 МБ, молчание модели) точку не проходит. — **Reversibility:** costly — будущее списание найдёт сумму только если каждый успешный путь вызывает один шов; размазанные вызовы кошелька эту карту ломают
- **D-47:** `SA-CHARGE-INSIGHTS` — один посчитанный итог, когда модель инсайтов вернула успешный результат. Часть — `provider_tokens` этой модели. Сумма показана на блоке инсайтов и не входит в итог разговора, колонку журнала, карточки стоимости дашборда, Excel и бюджет D-28. Попадание в кэш шов заново не вызывает. Ключ будущей операции — идентификатор этого запроса инсайтов.
- **D-48:** Точками списания не являются: золотой прогон D-43, проверка и доставка вебхука, дайджест, алерты, публикация проекта, выбор проекта на маршруте, выпуск токена, чтение кэша инсайтов, покупка модуля в маркетплейсе. Покупка модуля — уже существующее списание маркетплейса, не плата за разбор.
- **D-49:** `SA-CHARGE-GATE` в этой фазе нет. В aiPBX `checkBalance` запрещает старт при пустом балансе. Когда включат живое списание, проверка баланса встанет перед приёмом нового платного прогона, отдельно от `SA-CHARGE-RUN`. Сейчас отсутствие баланса разбор не запрещает.

### Живой прогон

- **D-50:** План фазы включает живой UAT: несколько сценариев настройки, загрузка через веб и через API, mono и stereo из `Z:\temp\speech-analytics-samples`. Каталог в git не коммитить.

### Claude's Discretion

Открытых развилок, отданных на усмотрение, нет. Незакрытое сравнение эталона с метриками проекта вынесено в Deferred, а не решено здесь.

### Deferred Ideas (OUT OF SCOPE)

- Живое списание с кошелька кабинета — отдельная фаза. Она включает кошелёк в `SA-CHARGE-RUN` и `SA-CHARGE-INSIGHTS` и тогда же добавляет `SA-CHARGE-GATE`. Удаление разговора по-прежнему не сторнирует списание.
- Золотой набор этой фазы сравнивает стандартные шкалы трёх эталонов. Добавлять ли в эталон метрики конкретного проекта — не решено. В фикстуры этой фазы метрики проекта не добавлять.
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| REQ-SA-PARITY | Паритет с операторской аналитикой aiPBX (журнал, sheet, редактор, загрузка/API, дашборд, диаризация, эталоны) | Разделы Standard Stack / Architecture Patterns / Code Examples; карта aiPBX → Krasterisk seams |
| REQ-SA-ARCH | Соответствие `packages/frontend/.idea/ARCHITECTURE.md` и backend ARCHITECTURE (FSD, Stack, SCSS/`var(--color-*)`, тенантность) | Project Constraints + Architecture Patterns |
| REQ-SA-UAT | Живой прогон `Z:\temp\speech-analytics-samples` (mono/stereo), файлы не в git | Environment Availability + Validation Architecture Wave 0 UAT harness |
</phase_requirements>

## Summary

Текущий модуль `speech-analytics` в Krasterisk — скелет (fake STT, узкий rubric v1, stub-страница «Отчёты», режимы маршрута inherit/off/on). Поведение нужно собирать заново до паритета с aiPBX operator-analytics, опираясь на уже существующие швы кабинета: запись маршрута / `krsk-hangup-handler`, CDR access lists, `WebhookQueueService`, `NotificationIntegration`, `ai_integration_*` токены с hash, `ai_price_revisions` для `speech_analytics`, AI confirm-card в `routes-ai.adapter.ts`. Списание с кошелька в фазе запрещено: только именованные швы `SA-CHARGE-RUN` / `SA-CHARGE-INSIGHTS`, сохраняющие посчитанную сумму.

Критический пробел авторазбора: hangup уже закрывает MixMonitor и может уведомить backend, но `handleOnHangup` сегодня только доставляет route-webhook и **не** ставит задание аналитики. Критический пробел схемы: `UNIQUE KEY uq_sa_run_initial (recording_id)` запрещает несколько прогонов на запись — противоречит D-12. Пол поведения UI — aiPBX `CallsTable` + `ReportShowAnalytics`, не SPEECH-ANALYTICS-UX-SLICE.

**Primary recommendation:** План волны 0 — схема (multi-run + charge columns + route project-only options) и hangup→enqueue без STT; далее реальный pipeline по aiPBX (energy stereo / LLM mono), журнал+sheet, редактор метрик, биллинг-persist швы, внешний API на `ai_integration_*`, UAT harness на env-path к `Z:\temp\…` без коммита аудио.

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Селект проекта на маршруте | Browser / Client | API / Backend | UI в `RouteFormModal`; persist в `routes.options` + dialplan reload |
| Hangup → enqueue job | API / Backend | Asterisk dialplan | CURL уже fire-and-forget; STT только в worker |
| STT / diarize / LLM score | API / Backend | Database / Storage | Долгие провайдеры; журнал `sa_*` |
| Журнал / sheet / дашборд / Excel | Browser / Client | API / Backend | FSD pages + RTK; фильтры и access на API |
| Внешний API токен | API / Backend | Database / Storage | Hash-only credential + grant на project |
| Digest / alerts | API / Backend | Browser / Client | Ссылки на `notification_integrations.uid` |
| Event webhook delivery | API / Backend | — | `WebhookQueueService` + `webhook_failures` |
| SA-CHARGE-* persist | API / Backend | Database / Storage | Сумма на run/insights; без wallet |
| Golden eval | API / Backend (CLI) | — | Transcript → scoring model; no journal |
| Live UAT samples | Environment / harness | — | Path outside git |

## Project Constraints (from AGENTS.md / .cursor)

- Монорепо: `packages/backend` (NestJS), `packages/frontend` (React FSD), `packages/shared`. Архитектуры MUST READ. [VERIFIED: AGENTS.md]
- Backend npm: перед новым пакетом — `npm show` version/peers; `synchronize: false`. [VERIFIED: packages/backend/.idea/ARCHITECTURE.md:19-60]
- Frontend: Stack (`VStack`/`HStack`), без layout-`div` flex в features/pages; дизайн-система `var(--color-*)`. [VERIFIED: packages/frontend/.idea/ARCHITECTURE.md:98-100]
- Verify перед «готово»: `npm run lint`, `npm run test:backend`, `npm run test:frontend`. [VERIFIED: AGENTS.md]
- `.cursor/rules/` в корне отсутствует — ориентир `AGENTS.md` + ARCHITECTURE. [VERIFIED: glob .cursor/rules → 0]

## Standard Stack

### Core

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| NestJS | 11.x (repo) | API modules | Уже стек кабинета [VERIFIED: packages/frontend/.idea/ARCHITECTURE.md:9] |
| Sequelize 6 | repo | `sa_*`, CDR, integrations | Existing models; migrations only |
| React 19 + FSD | repo | Cabinet UI | ARCHITECTURE |
| RTK Query | 2.x | API client | Existing `speechAnalyticsApi` |
| exceljs | 4.4.0 (installed `^4.4.0`) | Journal Excel export | Already in backend package.json; legitimacy OK [VERIFIED: npm view exceljs version → 4.4.0; packages/backend/package.json] |
| Jest / Vitest | jest 29.x / vitest 4.x | Unit tests | Existing scripts |
| axios | repo (WebhookQueueService) | HTTP webhook delivery | Reuse; do not reinstall |

### Supporting

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| `ai_jobs` / media assets | existing migrations | Job + asset spine | Enqueue analysis runs |
| `ai_integration_*` | migration 0005 | External API tokens (hash) | D-32/D-33 |
| `ai_price_revisions` | usage.models | Rate rows for SA-CHARGE calc | D-46/D-47 |
| Recharts | 2.x | Dashboard charts | D-34 |

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Persist charge on `sa_analysis_runs` | Call `settleShadow` now | Forbidden by D-46; wallet must stay future-only |
| New BullMQ queue for SA events | Separate Redis queue | `WebhookQueueService` already in-memory retry + DLQ; D-30 says reuse cabinet queue |
| SPEECH-ANALYTICS-UX-SLICE UI | Keep skeleton pages | Explicitly unsatisfactory example (CONTEXT) |

**Installation:** новые npm-пакеты **не требуются**. Excel — уже есть `exceljs`. Не ставить второй spreadsheet stack.

**Version verification:** `exceljs@4.4.0` confirmed via `npm view` and package.json (2026-09-22).

## Package Legitimacy Audit

| Package | Registry | Age | Downloads | Source Repo | Verdict | Disposition |
|---------|----------|-----|-----------|-------------|---------|-------------|
| exceljs | npm | years (publishedAt ~2023–2024) | ~10M/wk | github.com/exceljs/exceljs | OK | Approved — already dependency |
| axios | npm | seam flagged “too-new” on latest | high | github.com/axios/axios | SUS (seam) | Do **not** install; reuse existing in-tree import only |

**Packages removed due to [SLOP] verdict:** none  
**Packages flagged as suspicious [SUS]:** axios latest — не добавлять; использовать уже подключённый код `WebhookQueueService`.

## Architecture Patterns

### System Architecture Diagram

```text
[Route call]
  → MixMonitor (b / D, .wav|.raw) + hangup_handler_push
  → [krsk-hangup-handler]: StopMixMonitor → ffmpeg → CURL /internal/dialplan/on-hangup
  → DialplanWebhooksController.onHangup (HTTP 200 immediate)
       ├─ (existing) route on_hangup webhook enqueue
       └─ (NEW) if route has analytics projectId + entitled + !pauseNew:
              admit → create sa_recording/run → ai_jobs worker
                    → wait file non-empty → STT(+energy diarize) → LLM score
                    → persist result → SA-CHARGE-RUN (amount only)
                    → WebhookQueueService.enqueue(analysis.*)

[Cabinet upload / API / analyze-url]
  → sa_recording (journal only, never Asterisk CDR)
  → same worker path → SA-CHARGE-RUN

[Dashboard Insights button]
  → LLM on facts → SA-CHARGE-INSIGHTS → cache

[Golden CLI]
  → dryRunAnalyze(transcript) → MAE report; no journal; no SA-CHARGE-*
```

### Recommended Project Structure

```
packages/backend/src/modules/speech-analytics/
  charging/sa-charge-run.ts          # SA-CHARGE-RUN seam (persist only)
  charging/sa-charge-insights.ts     # SA-CHARGE-INSIGHTS
  pipeline/                          # replace fakeStt; channel-diarize port
  journal/                           # list/filter/export/access
  projects/                          # draft/publish editor config
  eval/                              # golden-set + runner
packages/frontend/src/
  pages/SpeechAnalyticsJournalPage/  # replaces Reports stub as journal
  features/speechAnalytics/ui/...    # sheet tabs, upload, dashboard, editor
  features/routes/...                # project select (drop inherit/off/on)
```

### Pattern 1: Hangup fire-and-forget → backend enqueue
**What:** Dialplan never runs STT; controller returns `"ok"` immediately; worker waits for file.  
**When to use:** D-03 auto-capture after recording closed.  
**Example seam (existing controller):**

```typescript
// Source: packages/backend/src/modules/routes/dialplan-webhooks.controller.ts:100-117
@Post('on-hangup')
@HttpCode(200)
async onHangup(...): Promise<string> {
  // ...
  void this.webhooksService.handleOnHangup({ ... });
  return 'ok';
}
```

### Pattern 2: AI confirm-card mutate + dialplan reload
**What:** `RoutesAiAdapter.proposal(..., includesDialplanReload: true)` + `propose` handlers.  
**When to use:** D-04 set/clear analytics project.  
**Example:**

```typescript
// Source: packages/backend/src/modules/routes/routes-ai.adapter.ts:461-477
private proposal(...): AgentDiffProposal {
  return {
    entityType: 'route',
    entityLabel: label,
    summary,
    before,
    after,
    applyPayload: { tool, args },
    includesDialplanReload: true,
  };
}
```

### Pattern 3: Capture pause only blocks new auto jobs
**What:** `pauseNew` → reason `pause_new` in `resolveCapturePolicy`.  
**When to use:** D-19/D-20.  
**Quote:** `if (input.pauseNew) return { enabled: false, reason: 'pause_new', ... }` [VERIFIED: packages/backend/src/modules/speech-analytics/reporting/capture-policy.ts:37]

### Anti-Patterns to Avoid
- **STT inside hangup_handler / CURL timeout:** блокирует teardown канала; нарушает D-03.
- **Писать загрузки в Asterisk CDR:** нарушает D-05.
- **Вызывать `settleShadow` / `BillingBalanceService` / `decrementUserBalance` в SA-CHARGE-***: запрещено CONTEXT.
- **Роль `analyst` в `sa_project_members`:** CHECK существует, но D-10 запрещает перенос; права через `UserLevel`.
- **Опираться на `fakeStt` / stub Reports page / SPEECH-ANALYTICS-UX-SLICE как продукт.**
- **`UNIQUE (recording_id)` на runs без миграции:** ломает D-12.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Webhook retry/DLQ | New Redis queue for SA events | `WebhookQueueService` + `webhook_failures` | D-30; already wired to system settings |
| API token crypto | Plaintext like early aiPBX | `ai_integration_credentials.secret_digest` | D-32 hash-only |
| CDR visibility SQL | Ad-hoc filters | `cdr-access-scope.ts` | D-11 |
| Excel cell overflow | Custom truncation invent | Port `truncateCell` from aiPBX `callsExportSheet.ts` | D-37 |
| Usage rate math | Hardcoded RUB prices | `ai_price_revisions` + `InsertUsageRateDto` | D-46 |
| Confirm mutations | Free-text «да» in chat | Phase 15 D-18/D-19 confirm card | D-04/D-27 |
| Stereo dual-STT | Second STT pass | aiPBX `channel-diarize` energy mode only | D-23 |

**Key insight:** Фаза — сборка продукта на существующих кабинетных швах, не зелёный микросервис.

## Runtime State Inventory

| Category | Items Found | Action Required |
|----------|-------------|------------------|
| Stored data | Tables `sa_*` (0011), `ai_integration_*`, `ai_price_revisions`, `webhook_failures`, `notification_integrations`; route `options.analytics` `{mode,projectId}`; CHECK `sa_project_members.role IN ('owner','analyst','viewer')`; UNIQUE `uq_sa_run_initial (recording_id)` | Migration: drop/replace unique for multi-run; add charge columns; replace route analytics shape to project-only; do not promote `analyst` role in product paths |
| Live service config | Asterisk generated dialplan `krsk-hangup-handler`; env `DURABLE_CAPTURE`; records under `/usr/records/{vpbx}/calls` | Dialplan regen when project select changes; ensure hangup_handler when project set even without route webhook |
| OS-registered state | None — verified by absence of SA-named scheduled tasks in research scope | none |
| Secrets/env vars | Dialplan API key; JWT; `CC_AI_KEY_SECRET` for notification credentials; future insecure-SSL flag like aiPBX | Code may add SA allow-insecure default true; no rename of existing secret keys required for charge persist |
| Build artifacts | Frontend pages under `SpeechAnalytics*`; hub seed paths `/speech-analytics/reports` | Remove/replace reports hub entry per D-37; rebuild frontend |

**Nothing found in category OS-registered:** None — verified by scope (no SA Windows tasks/systemd units in repo).

## Answers to Planner Research Questions

### 1. Hangup → enqueue after file closed (no STT in handler)

`[krsk-hangup-handler]` уже: StopMixMonitor → sync ffmpeg → CURL on-hangup. [VERIFIED: packages/backend/src/shared/utils/dialplan-subroutines.util.ts:83-109]

Контроллер отвечает `"ok"` сразу; работа async. [VERIFIED: dialplan-webhooks.controller.ts:100-117]

`handleOnHangup` **только** route webhook delivery — SA enqueue отсутствует. [VERIFIED: dialplan-webhooks.service.ts:160-193]

**Plan:** расширить `handleOnHangup` (или соседний internal hook) после закрытия файла: resolve route project → `resolveCapturePolicy` / `admitInternalAssetReady` → enqueue `ai_jobs`; worker ждёт non-empty file на `record_path`. Не вызывать STT из dialplan.

### 2. MixMonitor flags / stereo / project select attach

Flags `b` / `D`; stereo → `.raw`. [VERIFIED: route-recording.util.ts:13-18,44-45]

`recordingDialplanLines` + `hangup_handler_push` when durable or hangupWebhook. [VERIFIED: route-recording.util.ts:90-93]

UI сейчас inherit/off/on + project text field. [VERIFIED: RouteGeneralTab.tsx:170-188; RouteFormModal.tsx:87-88,199-201]

**Plan:** заменить на project select (D-01/D-02); при выбранном проекте всегда push hangup_handler даже без `on_hangup` webhook; channel map route: left=customer, right=operator (D-24) — отдельно от upload default в aiPBX `DEFAULT_MAP` left=operator. [VERIFIED: aiPBX channel-diarize.ts:45]

### 3. Tables / journal / runs / tokens / charges

Существуют: `sa_projects`, `sa_project_versions`, `sa_recordings`, `sa_analysis_runs`, transcripts/results/metrics, capture policy, recording relations. [VERIFIED: speech-analytics.models.ts; migration 0011]

Tokens: `ai_integration_credentials.secret_digest` Blob + grants `resource_kind=project`. [VERIFIED: integration-credential.models.ts:18-30,33-41]

**Gaps:** нет колонок суммы/`audio_ms`/`provider_tokens` на run; `UNIQUE KEY uq_sa_run_initial (recording_id)` [VERIFIED: 0011-speech-analytics.sql:87] ломает D-12; `SaProjectConfigV1` слишком узкий (не aiPBX editor) [VERIFIED: speech-analytics.types.ts:17-27]; CHECK role includes `analyst` [VERIFIED: 0011:44] — не использовать (D-10).

### 4. Routes AI confirm-card registration

`this.registry.register(this)` + tool factories with `propose` → `proposal(..., includesDialplanReload: true)`. [VERIFIED: routes-ai.adapter.ts:93-102,219-232,461-477]

**Plan:** добавить tools list/set/clear analytics project в этот же adapter (не новый домен).

### 5. NotificationIntegrations storage

Table `notification_integrations`: `uid`, `channel` enum `telegram|email|whatsapp|webhook|max|vk`, `config` JSON, `encrypted_credentials`, `user_uid`. [VERIFIED: notification-integration.model.ts:9-33]

**Plan:** в draft/publish config проекта хранить `integrationUid[]`, не вторые адреса (D-29).

### 6. Platform rates + shadow settlement shape (persist without debit)

`InsertUsageRateDto`: `product: 'speech_analytics' | 'ai_voice_robots'`, `unit: 'audio_ms' | 'provider_tokens'`, `moneyPolicy: 'shadow' | 'local_byok'`. [VERIFIED: platform-prices.dto.ts:47-65]

`AiPriceRevision` columns include `rate`, `currency`, `money_policy`. [VERIFIED: usage.models.ts:18-31]

`settleShadow` returns `{ charged: false, amount }` and asserts wallet untouched. [VERIFIED: shadow-settlement.ts:119-144]

`usageChargeOperationKey(reservationId)` → `ai-usage:${reservationId}`. [VERIFIED: idempotent-charge.ts:20-22]

**Plan:** SA-CHARGE-* считают сумму через latest rates, пишут на run/insights (`charged=false` / label «не списано»); **не** вызывать `settleShadow`/`BillingBalanceService`; future key = run id / insights request id (D-46/D-47).

### 7. CDR access lists for journal

`parseCdrAccessBlob`, `isCdrUnrestricted` (empty → whole tenant), `buildCdrAccessClause` / linkedid variant. [VERIFIED: cdr-access-scope.ts:1-137]

**Plan:** journal list/export/dashboard reuse same scope resolution as `CdrService.resolveCdrAccess` (D-11).

### 8. Webhook queue + webhook-failures log

`WebhookQueueService.enqueue` + `getFailures` / retry on `WebhookFailure` model table `webhook_failures`. [VERIFIED: webhook-queue.service.ts:27-66; webhook-failure.model.ts:23-69]

HTTP: `system-settings` `GET webhook-failures`. [VERIFIED: system-settings.controller.ts grep]

**Plan:** SA event webhooks через `enqueue`; failures видны на существующей вкладке (D-30). Note: model comments mention BullMQ; implementation is in-memory setTimeout (file header).

### 9. Golden-set runner must call

aiPBX: `OperatorAnalyticsService.dryRunAnalyze(transcription)` — real LLM, **no** BillingRecord / balance. [VERIFIED: operator-analytics.service.ts:4090-4117; eval/README.md:57-59]

Exit non-zero only if case errored; MAE/accuracy/kappa printed. [VERIFIED: eval/README.md:42-59]

Fixture rule `example-003-out-of-scope-service` exists but clinic transcript must be rewritten (D-44). [VERIFIED: example-003 JSON id/description]

**Plan:** Krasterisk CLI/script calling scoring-only API; three fixtures without clinic; no journal rows; no SA-CHARGE-RUN.

### 10. Live UAT harness + Z:\temp samples

Samples present: mono **58** files, stereo **49** files under `Z:\temp\speech-analytics-samples\{mono,stereo}` (probed 2026-09-22). Do not commit.

Existing harness patterns: `harness/database/run-11a-uat.cjs` / `run-10a-smoke.cjs` hit skeleton SA HTTP; `harness/scenarios/manual/autodial-uat-live-*.cjs` shows JWT mint + evidence JSON under `.planning/evidence/`.

**Plan:** new `harness/scenarios/manual/speech-analytics-uat-*.cjs` reading `SPEECH_ANALYTICS_SAMPLES_DIR` (default `Z:\temp\speech-analytics-samples`), upload mono+stereo via web API path, write evidence JSON; add `.gitignore` guard if needed; never stage sample audio.

## Current Module Map (replace, do not ship as product)

| Asset | Status | Disposition |
|-------|--------|-------------|
| `pipeline.ts` `fakeStt` | Deterministic fixture STT | Replace with real STT+diarize |
| `SaProjectConfigV1` / 3 metrics | Pilot rubric | Replace with aiPBX-parity editor config |
| `SpeechAnalyticsReportsPage` stub | Title + muted export text | Remove page; Excel on journal (D-37) |
| Route analytics inherit/off/on | Wired in UI/dialplan options | Replace with project select (D-01) |
| `capture-policy` default project | Company default | Remove default project concept (D-01) |
| SPEECH-ANALYTICS-UX-SLICE | Initiative example | Do not implement as plan |
| Hub `/speech-analytics/reports` | Seeded | Retarget/remove |

## Common Pitfalls

### Pitfall 1: Enqueue before StopMixMonitor / empty file
**What goes wrong:** Jobs fail or charge incorrectly.  
**Why:** Race with MixMonitor close.  
**How to avoid:** Handler order already StopMixMonitor→ffmpeg→CURL; worker still waits for size>0 (D-03).  
**Warning signs:** Immediate `failed` with missing file.

### Pitfall 2: Leaving `uq_sa_run_initial`
**What goes wrong:** Reanalysis D-12 cannot insert second run.  
**Why:** Migration 0011 unique on `recording_id`.  
**How to avoid:** Wave 0 migration drops unique; latest-run pointer on recording or query by `created_at`.  
**Warning signs:** 409/unique errors on regenerate.

### Pitfall 3: Wallet debit sneak-in via aiPBX copy-paste
**What goes wrong:** Phase ships live charges.  
**Why:** aiPBX `chargeCost` calls `decrementUserBalance`. [VERIFIED: operator-analytics.service.ts:3943-3947]  
**How to avoid:** Named seams only; tests assert no BillingBalanceService calls.

### Pitfall 4: Dual channel maps confused
**What goes wrong:** Operator/customer swapped on route vs upload.  
**Why:** aiPBX default left=operator; route MixMonitor D is left=customer (D-24).  
**How to avoid:** Explicit map per source in diarize call.

### Pitfall 5: Insights auto-fetch on dashboard mount
**What goes wrong:** Surprise cost and latency.  
**Why:** Easy RTK `useEffect` habit.  
**How to avoid:** Button-only (D-35); cache key.

## Code Examples

### MixMonitor flags

```typescript
// Source: packages/backend/src/modules/routes/route-recording.util.ts:13-18
export function buildMixMonitorFlags(opts: RouteRecordingOptions): string {
  let flags = '';
  if (opts.record_all !== true) flags += 'b';
  if (opts.record_stereo === true) flags += 'D';
  return flags;
}
```

### UserLevel (no ANALYST)

```typescript
// Source: packages/shared/src/enums/index.ts:1-7
export enum UserLevel {
  SUPERADMIN = 0,
  ADMIN = 1,
  OPERATOR = 2,
  SUPERVISOR = 3,
  READONLY = 5,
}
```

### SA scopes on integration tokens

```typescript
// Source: packages/backend/src/modules/integration-credentials/integration-credentials.service.ts:22-26
speech_analytics: { kind: 'project', values: new Set([
  'analytics:upload', 'analytics:read', 'analytics:transcript',
  'analytics:audio', 'analytics:cancel',
]) },
```

### aiPBX dry-run (golden)

```typescript
// Source: aiPBX_backend/.../operator-analytics.service.ts:4097-4117
async dryRunAnalyze(transcription: string, opts?: {...}) {
  const { metrics, ... } = await this.analyzeTranscription(...);
  return { metrics, ..., promptVersion: PROMPT_VERSION };
}
```

### Insights types (behavior floor)

```typescript
// Source: aiPBX_backend/.../insights-prompt.ts:32-37
'type MUST be one of: strength, gap, trend, outlier, quality (English only).',
'title, observation, recommendation MUST be in Russian.',
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| aiPBX live `decrementUserBalance` | Krasterisk persist-only SA-CHARGE-* | Phase 18 CONTEXT | Future wallet phase plugs same names |
| inherit/off/on route analytics | Project select only | D-01 | Dialplan + UI rewrite |
| BullMQ webhook queue | In-memory `WebhookQueueService` | Prior routes work | Reuse; don't resurrect BullMQ for SA |
| Skeleton fakeStt | Real STT + energy diarize | This phase | Product parity |

**Deprecated/outdated:**
- `RouteAnalyticsOptions.mode: 'inherit'|'off'|'on'` as product contract — replace.
- Page `/speech-analytics/reports` as primary export surface — D-37.
- Role `analyst` in members CHECK for UI — D-10.

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | Worker должен poll/wait файл на диске Asterisk host path after hangup (точный backoff не зафиксирован в коде) | Q1 | Нужен checkpoint на таймаут пустого файла |
| A2 | Для Excel на backend достаточно уже установленного `exceljs` (без frontend export) | Standard Stack | Если UI-only export — другой wire |
| A3 | `DURABLE_CAPTURE=1` в prod желателен для UUID filenames, но analytics enqueue должен работать и в legacy ffmpeg-hangup mode | Q1/Q2 | Dialplan ветки разъедутся |

## Open Questions

1. **Backoff / timeout ожидания файла после hangup**
   - What we know: D-03 требует wait for non-empty; exact seconds not locked.
   - Recommendation: planner picks finite retry (e.g. 30–60s) as implementation detail under Claude discretion absence → use aiPBX-like practical timeout and document in PLAN.

2. **Project metrics in golden set**
   - Deferred: only standard scales this phase.

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Node.js | tests/harness | ✓ | v24.19.0 | — |
| npm | scripts | ✓ | 12.0.2 | — |
| `Z:\temp\speech-analytics-samples` | D-50 UAT | ✓ | mono 58 / stereo 49 mp3 | Block UAT task if path missing |
| exceljs (in package) | D-37 | ✓ | 4.4.0 | — |
| Live Asterisk /ffmpeg | hangup path UAT | harness-dependent | — | Unit tests without live PBX; live UAT separate plan gate |
| LLM/STT providers | scoring / STT | env-dependent | — | Golden needs LLM; mark live gate |

**Missing dependencies with no fallback:** none for planning docs; live UAT needs samples path (present) + running API/STT.

**Missing dependencies with fallback:** live Asterisk — unit/integration without dialplan; hangup path verified in harness later.

## Validation Architecture

### Test Framework

| Property | Value |
|----------|-------|
| Framework | Backend Jest 29 + ts-jest; Frontend Vitest 4 |
| Config file | `packages/backend/package.json` `jest` key; frontend `scripts/vitest-run-src.cjs` |
| Quick run command | `npm run test -w @krasterisk/backend -- --testPathPattern=speech-analytics --no-coverage` |
| Full suite command | `npm run test:backend` && `npm run test:frontend` |

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| REQ-SA-PARITY | Multi-run + latest display; SA-CHARGE-RUN persist no wallet | unit | jest `sa-charge` / `ingest` / `pipeline` | ❌ Wave 0 |
| REQ-SA-PARITY | capture-policy pauseNew vs manual upload | unit | existing `capture-policy` + extend | ✅ partial (`capture-policy.ts` tested via reporting specs) |
| REQ-SA-PARITY | channel map route vs upload | unit | port channel-diarize tests | ❌ Wave 0 |
| REQ-SA-PARITY | CDR access reuse for journal | unit | extend `cdr-access-scope.spec.ts` consumers | ✅ scope util |
| REQ-SA-PARITY | dryRun golden exit codes | integration/CLI | `npm run eval:speech-analytics` (new) | ❌ Wave 0 |
| REQ-SA-ARCH | Route project select UI; no inherit modes | frontend unit | vitest RouteFormModal / RouteGeneralTab | ❌ Wave 0 (modes still present) |
| REQ-SA-ARCH | Sheet tabs / journal table FSD | frontend unit | vitest journal/sheet | ❌ Wave 0 |
| REQ-SA-UAT | Upload mono+stereo from samples dir | manual/harness | harness script + evidence JSON | ❌ Wave 0 (samples on disk ✓) |
| D-46/D-47 | Zero-rate still invokes seam; insights separate | unit | jest charge seams | ❌ Wave 0 |
| D-32 | Token hash-only; one project grant | unit | extend integration-credentials specs | ✅ partial |

### Sampling Rate
- **Per task commit:** targeted jest/vitest for touched module
- **Per wave merge:** `npm run test:backend` + relevant frontend vitest
- **Phase gate:** full lint + test:backend + test:frontend; live UAT evidence; golden CLI green-on-errors-only

### Wave 0 Gaps
- [ ] Migration dropping `uq_sa_run_initial` + charge amount columns on runs/insights
- [ ] Tests for `SA-CHARGE-RUN` / `SA-CHARGE-INSIGHTS` (no wallet mocks called)
- [ ] Hangup admission enqueue unit test (mock CURL → service)
- [ ] Replace/ignore `fakeStt` as acceptance path
- [ ] Harness `speech-analytics-uat` reading `SPEECH_ANALYTICS_SAMPLES_DIR`
- [ ] Golden fixtures (3) without clinic + runner script
- [ ] Frontend tests for project select (recording gated) and removal of Reports page

## Security Domain

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | yes | JWT cabinet; integration token selector+digest |
| V3 Session Management | yes | Existing JWT sessions |
| V4 Access Control | yes | `UserLevel` + CDR access lists + tenant `vpbx_user_uid` |
| V5 Input Validation | yes | Nest DTO / class-validator; upload size 50MB; URL download limits |
| V6 Cryptography | yes | `secret_digest` for tokens; `encryptSecret` for notification credentials — never store API plaintext |

### Known Threat Patterns for speech-analytics stack

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| Cross-tenant journal read | Information Disclosure | Always filter `vpbx_user_uid` from JWT (Phase 15 D-22) |
| Token reuse / plaintext leak | Spoofing | Hash-only credential; one-time show (D-32) |
| SSRF via analyze-url | Elevation | Intentional open download (D-39) with size/timeout caps; document risk; insecure SSL default like aiPBX |
| Webhook header injection | Tampering | Store headers server-side; deliver via queue; failures audited |
| Prompt injection in transcript | Tampering | Bounded schema scoring; evidence must reference segments (existing validateResult pattern) |

## Sources

### Primary (HIGH confidence)
- `.planning/phases/18-.../18-CONTEXT.md` — locked decisions
- `packages/backend/src/modules/routes/route-recording.util.ts`, `dialplan-subroutines.util.ts`, `dialplan-webhooks.*`
- `packages/backend/src/modules/speech-analytics/**`, migration `0011-speech-analytics.sql`
- `packages/backend/src/modules/ai-usage/shadow-settlement.ts`, `cloud-admin/billing/idempotent-charge.ts`, `platform-prices.dto.ts`
- `packages/backend/src/modules/reports/cdr/cdr-access-scope.ts`
- `packages/backend/src/modules/notifications/notification-integration.model.ts`
- `packages/backend/src/modules/integration-credentials/**`
- aiPBX `operator-analytics.service.ts` (charge/dryRun), `channel-diarize.ts`, `insights-prompt.ts`, `eval/README.md`, `example-003-*.json`
- aiPBX `CallsTable.tsx`, `ReportShowAnalytics.tsx`, `callsExportSheet.ts` (`truncateCell`)

### Secondary (MEDIUM confidence)
- Hub seed paths for speech-analytics pages (`hub-modules.seed.ts`)
- Harness SA smoke scripts (skeleton API, not product UAT)

### Tertiary (LOW confidence)
- Exact production `DURABLE_CAPTURE` default on customer PBX — treat as env-dependent [ASSUMED]/ A3

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — reuse in-repo packages; exceljs verified
- Architecture: HIGH — hangup/webhook/CDR/token seams read with line evidence
- Pitfalls: HIGH — unique key + wallet copy-paste + channel map verified

**Research date:** 2026-09-22  
**Valid until:** 2026-10-22 (30 days; schema/UI may move fast during execution)
