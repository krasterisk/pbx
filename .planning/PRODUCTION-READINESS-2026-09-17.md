# Подготовка Krasterisk к production

Дата: 2026-09-17. Это продолжение review-remediation, расширенное реальными запросами трёх компаний. **Production readiness пока не подтверждена.** Наличие 49 модулей, 92 MCP-инструментов и 27 skills не означает полное покрытие сценариев.

## Метод и стенд

- Локальный backend из рабочего дерева, текущая MySQL, разрешённый Asterisk `ipbx.krasterisk.ru`. Рабочий checkout сервера не заменялся.
- Реальные HTTP register/login, SSE AI chat, подтверждение сохранённой карточки, повторное подтверждение, чтение БД/API и CLI Asterisk. LLM — существующий OpenAI provider с `gpt-5-nano`; ключи скопированы между тестовыми тенантами SQL на стороне БД, без вывода наружу.
- `aipbx / qwen3.5:8b` указывает на localhost:5005; доступный сервис для этого endpoint не обнаружен. Качество этой модели не оценено.
- Новые организации: 356 «Студия Липа» (10), 357 «Сервис Вектор» (50), 358 «Группа Горизонт» (150). Создание через API регистрации; квоты пилотов 50/150 повышены тестовой фикстурой, **это не проверка покупки тарифа**.
- Контакты SIP-телефонов отсутствуют. Созданный endpoint не равен зарегистрированному телефону. 210 учётных записей не являются нагрузочным тестом на 210 одновременных звонков.
- Проверки ограничены собственными тестовыми объектами. Внешние транки/PSTN, рассылки, списания и реальные пользовательские записи не использованы.
- Локальные `.tmp/production-pilots.json`, SSE и trace содержат тестовые токены/данные и исключены из git. В отчёты ключи, пароли и токены не включаются.

## Подтверждённые результаты и обнаруженные дефекты

1. Три регистрации создали отдельного администратора, Tenant, внутренний и внешний Context в одной транзакции. Вход без email успешен; email требует активации. Сотрудник создаётся администратором существующей организации через users API/UI; новая регистрация создаёт новую организацию.
2. Реальная малая модель подготовила создание 10, 50 и 150 абонентов (150 — тремя пакетами по 50). Подтверждения применились. До подтверждения записей не было; повторное подтверждение проверялось. В трёх компаниях перекрываются номера 101 и далее.
3. Asterisk видит `e101_356`, `e101_357`, `e101_358` с разными context. API каждой компании показывает только её 10/50/150 абонентов, чужие Context UID отклоняются. Это проверка конкретных границ, не полный аудит всех REST endpoints.
4. На первом чтении Asterisk внутренние контексты отсутствовали: регистрация и создание endpoints сами по себе не развёртывают рабочую маршрутизацию. Нужны маршруты и проверка применённого dialplan.
5. Сложный IVR-запрос сначала провалился: модель выдала неверные `steps`. После исправлений был создан workflow группы 103–110 и меню с 1→101, 2→102, t→группа. Отдельно обнаружены пропущенный входной маршрут 700 и отсутствие timeout в AI-схеме. Поэтому первоначальный PASS применения **не считается полным PASS бизнес-сценария**.
6. В запросе очереди малая модель путала поля `exten`, `members.interface`, `timeout`. В skill было неверное объяснение timeout. Исправлены инструкции и возврат точной схемы при ошибке; первоначальный прогон FAIL сохранён как evidence.
7. Подсказка планировщика навязывала создание IVR любому запросу и календарь любому маршруту. Это приводило к лишнему рабочему расписанию. Проверочный allowlist отклонил лишнюю мутацию до применения. Подсказки сужены по намерению.
8. MCP повторно оборачивал полную JSON Schema в `properties`, что приводило к provider HTTP 400. Исправлено; добавлена регрессия. Ошибку схемы нельзя засчитывать как слабое качество модели.
9. Инструменты конференций, call-center и пользователей могли исчезать из фильтра из-за несовпадения имени домена и имени tool. Добавлены явные соответствия; конференциям добавлен proposal-gated create. Текстовое обещание «после подтверждения создам» без настоящей карточки больше не считается завершённой работой.
10. Диагностика регистрации добавлена через allowlisted AMI PJSIPShowEndpoint: проверка владения endpoint, ограниченный whitelist полей, без AuthDetail, секретов и contact URI. Skills `registration-support` и `call-support` требуют фактов и запрещают выдавать гипотезу за диагноз.
11. В workflow найдена та же опасность, что ранее в одиночных diff: write→reload без durable checkpoint. Теперь DB claim работает между экземплярами; reload retry не повторяет write; неопределённый исход записи сохраняет claim для разбирательства. Это staged execution, не атомарная транзакция через DB/AMI.
12. Закрыты видимость чужого пользователя при tenant=0, массовое присваивание tenant/activation/privilege полей, MD5 новых паролей, привязка MCP session только к tenant без пользователя, передача default actor вместо JWT actor, substring-сопоставление endpoint в диагностике. Context create/update используют allowlist.

## Итог живых прогонов и проверки изменений

| Компания | Подтверждено на стенде | Итог сценария |
|---|---|---|
| 10 абонентов, tenant 356 | AI создал 101–110, IVR 23, группу и маршрут 700; отдельным AI-запросом установлен timeout 5. Реальный Local-звонок после исправления hop counter входит в IVR, получает Answer и через 5 секунд выбирает `t`. | **PARTIAL:** переход в `group_16_356,start,1` завершается ошибкой отсутствующего контекста. DTMF с SIP-телефона и разговор не проверены. |
| 50 абонентов, tenant 357 | AI создал 101–150, очередь 600 с 10 участниками и конференцию 750. Asterisk показывает правильные tenant endpoints в очереди. | **PARTIAL / FAIL маршрутизации:** повторные реальные запросы маршрутов к очереди и конференции не дали настоящую карточку применения. Сквозные звонки очереди/конференции не приняты. |
| 150 абонентов, tenant 358 | AI создал 101–250 тремя пакетами по 50, маршрут 799 и выполнил диагностику без изменений. После исправления playback и повторного применения Local-звонок ответил и воспроизвёл `beep.gsm`. | **PARTIAL:** это проверка базовой настройки и Local media, а не всех модулей, SIP/RTP и нагрузки 150 телефонов. Недостающие операции перечислены в capability audit и плане ниже. |

- Три владельца зарегистрированы через настоящий API регистрации; дополнительно созданы три обычных сотрудника. Проверены отсутствие password/hash в ответах и отрицательные REST-проверки чужих contexts. Одинаковый номер 101 существует в трёх отдельных endpoint/context пространствах Asterisk. Это ограниченная проверка изоляции, не исчерпывающий security audit.
- Работала модель **gpt-5-nano**. Провайдер aipbx / qwen3.5:8b недоступен на настроенном адресе; его качество не оценено. Простые запросы проходят, надёжность сложных базовых рецептов ещё недостаточна.
- Исправлены дополнительные живые дефекты: неточные поля каталога dialplan apps, ошибочный tenant-путь для системного `beep`, пустая арифметика счётчика переходов и чтение inherited counter с `__` на стенде. Финальный счётчик пишет `__KRSK_HOPS`, читает `KRSK_HOPS`, явно подставляет 0 до первого перехода. Live evidence подтверждает `__KRSK_HOPS=1` и успешный `GotoIf` в IVR. Наследование каналов описано в [официальной документации Asterisk](https://docs.asterisk.org/Configuration/Dialplan/Variables/Channel-Variables/Variable-Inheritance/).
- **Новый P0: CDR теряются.** Оба Local-сценария дают `Column 'usrc' cannot be null` и `CDR failed`. На живой legacy БД `cdr.usrc` — NOT NULL без корректного default для этих вызовов. Trigger `bi_cdrEvents` переносит поле в производные таблицы и ищет пользователей по `exten` без tenant scope. Нужна отдельная миграция всей цепочки cdr/cdr_clean/cdr_clean_last и tenant-scoped attribution, включая пустой caller ID и обе Local-ноги. Изменение одного столбца не считается исправлением; legacy trigger на сервере не изменён.
- **Новый P0: зависимость есть в БД, но не развернута.** Группа IVR отсутствует в загруженном dialplan. Нужны обязательное применение зависимостей, проверка результата в Asterisk и surfaced failure вместо успешной карточки. До этого IVR-сценарий нельзя принимать.
- Диагностические skills читают разрешённые AMI/DB данные и отделяют гипотезу от установленной причины. Безопасная tenant-фильтрованная выдача сырых логов Asterisk модели **ещё не реализована**; SSH-логи в этом аудите собраны агентом вручную, это не возможность продукта.
- Проверки последней версии: backend **236 suites / 2804 tests PASS**; frontend **240 files / 1370 tests PASS** (fork pool; установлен как default на Windows); lint **0 errors**, существующие предупреждения 99 backend / 84 frontend. Backend и frontend build PASS. Последнее изменение hop counter повторно проверено полным backend suite и lint; frontend после своего полного прогона функционально не менялся. CI-конфигурация исправлена, удалённый CI в этой сессии не запускался.
- Формы входа и регистрации проверены в браузере на desktop и ширине 390px, RU/EN. Создание организации/владельца проверено API. Покупка тарифа не проверялась: квоты тестовых компаний 50/150 выставлены fixture-скриптом.
- Воспроизводимый opt-in runner: `harness/scenarios/manual/three-company-pilot.cjs`, описание рядом. Компании и применённые сущности оставлены для проверки; неиспользованные pending drafts отклонены. Пароли/токены находятся только в ignored `.tmp`, в отчёт не включены. Production checkout сервера не заменялся.
- Свидетельства: [изолированные компании](evidence/production-pilots-2026-09-17/pilots-isolation.txt), [beep](evidence/production-pilots-2026-09-17/pilot-beep-call-evidence.txt), [IVR после исправления](evidence/production-pilots-2026-09-17/pilot-ivr-call-v8.txt), [неразвёрнутая группа](evidence/production-pilots-2026-09-17/pilot-ivr-group-gap.txt), [CDR](evidence/production-pilots-2026-09-17/pilot-cdr-errors.txt).

Полная приёмка трёх компаний и готовность к production **не достигнуты**. Следующий обязательный этап — P0 deployment/CDR/isolation, затем типизированные AI-рецепты и повторение трёх сквозных сценариев с зарегистрированными SIP-клиентами.

## Глобальный план с критериями приёмки

### P0 — границы tenant и надёжность исполнения

| Работа | Что сделать | Проверяемый результат |
|---|---|---|
| Единое пространство имён Asterisk | Неизменяемый tenant prefix/UUID для contexts, endpoints, trunks, queues, conference rooms, MOH и файлов; migration существующих имён с таблицей соответствия. Убрать небезопасную эвристику endsWith(tenantId). | Генеративные проверки коллизий tenant 2/12/112 и одинаковых display names; отрицательные SIP/Local/REST/MCP/ARI вызовы между компаниями. |
| Provisioning state machine | Создание организации → квоты/модули → внутренние маршруты → применение → чтение Asterisk → ready. Возвращать pending/failed/ready с причиной; transactional outbox. | После регистрации тестовый внутренний звонок работает; отказ AMI не выглядит как ready, повтор не создаёт дубли. |
| Исполнение и reconciliation | Распространить checkpoint на сервисы, которые сами пишут и вызывают reload; убрать swallowed apply errors конференций. Не удалять активный workflow при удалении чата; отдельная безопасная операция reconciliation. | Fault injection перед/после commit/checkpoint/reload, два backend worker, crash/restart. Ни одного повторного write; виден partial deployment. |
| Авторизация и сессии | Убрать refresh-secret-default, сильные независимые secrets в production, одноразовая атомарная ротация refresh, отзыв при смене роли/пароля/блокировке, hash refresh tokens. Проверять active membership для чувствительных запросов. | Параллельный refresh даёт ровно одного победителя; украденный старый токен и revoked role не действуют. |
| Регистрация и квоты | Unique normalized login, concurrency test настоящей БД, проверка company/email, resend/retry mail, режим CLOUD с контролируемым signup/invite, лимиты и trial policy, штатная смена тарифа. | Два одновременных signup не создают дубли; rollback не оставляет owner без tenant; quota нельзя обойти bulk API. |
| Общий security contract | Tenant/actor только из JWT, query scope во всех сервисах; schema allowlist DTO; MCP session TTL/cap и protocol negotiation; live-ops с ролью и подтверждением. | Матрица admin/operator/readonly × свои/чужие UID для каждого транспорта; CI отрицательные тесты. |

### P1 — AI, который выполняет пользовательскую задачу

| Работа | Что сделать | Проверяемый результат |
|---|---|---|
| Полная capability matrix | На основе [инвентаризации](AI-CAPABILITY-AUDIT-2026-09-17.md) вести module/entity/read/create/update/delete/live-op/skill/test. `configure` не равно CRUD. | CI не допускает tool без schema, роли, skill и теста; UI показывает реальные доступные возможности. |
| Недостающие настройки | update endpoint/trunk/route; создание и изменение voice robot, prompt/TTS/STT, MOH playlist, autodial campaign/base, voicemail; интеграции только с безопасным вводом секретов. | Для каждой операции diff/revalidate/apply, tenant isolation, delete-reference check, live smoke. Платформенные тарифы и привилегии остаются вне tenant AI. |
| Типизированные recipes | Бизнес-рецепты «офис», «поддержка», «конференция», «номер не работает» с checklist фактов. Компилятор строит зависимости и проверяет результат относительно запроса, включая входной маршрут/таймаут. | 10/50/150 сценарии проходят с обычными формулировками; никакого добавленного календаря/транка/записи без запроса. |
| Надёжные символические ссылки | Валидировать steps.id.result.field, существование зависимости, тип и доступность результата; создавать ресурсные ID до compiled preview или применять typed handles. | Неверная ссылка блокируется до записи; route на создаваемый IVR проходит; partial plan не маскируется как complete. |
| Eval малого LLM | Версионируемый набор перефразировок, исправлений, неоднозначностей, инъекций и provider failures. Проверять gpt-5-nano и поднятый aipbx, а не один удачный ответ. | Предлагаемая цель: ≥95% базовых задач, 100% запрет несанкционированных writes/cross-tenant; отдельные cost/latency/retry метрики. Это целевые значения, ещё не достигнутые результаты. |
| Ошибки и интерфейс AI | Публичный понятный итог при исчерпании попыток вместо тихого done; различать configured/deployed/registered/verified. Ссылки на изменённые сущности и failed step. | После network/model/AMI failure пользователь знает, что записано и что безопасно повторить. |

### P1 — поддержка, логи и эксплуатация

- Собирать Asterisk full/queue_log/AMI/CDR/CEL на сервере с immutable tenant mapping по channel/endpoint/linkedid. Не отдавать общий tail файла модели. Исключить события без надёжной tenant-атрибуции, редактировать Authorization/password/contact/IP по политике, ограничить период, объём и роли.
- Инструменты `get_call_timeline`, `get_registration_history`, `get_media_summary`, `get_deployment_status`, `collect_support_bundle` с correlation ID и объяснимым отсутствием данных. Bundle должен иметь audit, TTL и явный список данных; выгрузка наружу — отдельное подтверждение.
- Диагностические recipes: не регистрируется; нет входящего/исходящего; односторонний звук/NAT/RTP; неверный маршрут/календарь; очередь не звонит/агент на паузе; conference audio/guest access/recording; TTS/STT/provider outage; запись отсутствует; задержки/websocket/reconnect.
- Автоматическое исправление только через минимальный diff после диагноза. Никаких глобальных restart, firewall flush, logger debug on или открытого SIP доступа по подсказке LLM.
- Разделить управляющий API и runtime worker, AMI/ARI credentials с минимальными правами, outbox+очередь, tenant quotas, per-tenant rate limits, secret manager, backup+restore rehearsal, migration rollback, metrics/traces и alerting.

### P2 — дизайн и инфраструктура

- Мастер новой организации: компания → нумерация → сотрудники → сценарий → проверочный звонок. Кнопка «пригласить сотрудника» отдельно от создания новой компании. Показывать trial/лимиты и статус применения в каждом шаге.
- Общий статус АТС: конфигурация в БД, версия на Asterisk, registration, live call. Не использовать один зелёный индикатор для разных состояний.
- В diff показывать реальные последствия: какие номера заработают, какие перестанут, расписание, запись, затронутые активные вызовы. Для 150 абонентов — сводка и раскрываемые группы, поиск и экспорт обезличенного отчёта.
- Разделить source-of-truth и derived runtime config; проверять checksum drift. Canary apply одного tenant перед rollout. Нагрузочные профили отдельно: 210 endpoints, регистрации/сек, одновременные звонки, очередь, конференция/SFU, записи, AI concurrency.

## Release gates

1. P0 закрыты тестами настоящей БД и Asterisk; rollback/restore проверены.
2. Три бизнес-сценария проходят end-to-end с перекрывающимися номерами; DTMF IVR, queue distribution/timeout, conference participants/recording, RTP в обе стороны проверены реальными SIP-клиентами.
3. Полный набор модулей 150-компании имеет собственные acceptance сценарии. До появления недостающих mutation tools и подключённых speech/messaging/trunk сервисов такой результат помечается blocked/partial.
4. Линтер, backend/frontend/shared тесты и сборки проходят; live harness запускается вручную на отдельном разрешённом стенде с удалением/учётом фикстур. Обычный CI не использует текущую рабочую БД и реальные provider keys.
5. Мониторинг, инструкции поддержки, ротация секретов, ограничения тарифа и disaster recovery проверены оператором.

## Источники и сверка

Внутренние: обе ARCHITECTURE.md, CANONICAL_REFS.md, ROADMAP/STATE, module-coverage.registry, реальные адаптеры и skills; `.docs/QUEUES_MODULE.md`, `.docs/CLOUD_ADMIN_MODULE.md`. В старом QUEUES_MODULE указана PostgreSQL, фактический стенд — MySQL: документация не считается доказательством реализации.

- [Asterisk: contexts, extensions and priorities](https://docs.asterisk.org/Configuration/Dialplan/Contexts-Extensions-and-Priorities/) — основание разделения dialplan; изоляцию конкретной реализации доказывают отрицательные тесты.
- [Asterisk PJSIP troubleshooting](https://docs.asterisk.org/Configuration/Channel-Drivers/SIP/Configuring-res_pjsip/Asterisk-PJSIP-Troubleshooting-Guide/) — endpoint/AOR/identify и сбор свидетельств регистрации.
- [Queue()](https://docs.asterisk.org/Latest_API/API_Documentation/Dialplan_Applications/Queue/) и [queues.conf sample](https://github.com/asterisk/asterisk/blob/master/configs/samples/queues.conf.sample) — различие общего ожидания и ring timeout.
- [Queue logs](https://docs.asterisk.org/Operation/Logging/Queue-Logs/) — события CONNECT/TRANSFER/EXIT/TIMEOUT для timeline поддержки.
- [OWASP multi-tenant security](https://cheatsheetseries.owasp.org/cheatsheets/Multi_Tenant_Security_Cheat_Sheet.html) — проверять tenant boundary на каждом слое.
- [MCP security best practices](https://modelcontextprotocol.io/docs/2025-11-25/tutorials/security/security_best_practices) — session не заменяет авторизацию и идентичность пользователя.

Архитектурные предложения выше — выводы аудита, а не утверждение, что соответствующая инфраструктура уже внедрена.
