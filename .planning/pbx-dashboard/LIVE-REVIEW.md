# Независимая проверка Dashboard — r3

Дата: 2026-10-11. Исполнитель: /root/dashboard_independent_review. Координатор: /root, codex-direct. PLAN 2026-10-11-r3, D6-LIVE.

Проверка независима от владельцев реализации. Production sources и runners прочитаны без изменений; единственный записанный исполнителем файл — этот отчёт. Исполнитель не запускал внешние звонки, Asterisk, контейнеры или новую оркестрацию. Actual live acceptance выполняет root отдельно. Unit/source результаты ниже не заменяют live acceptance; отдельный аудит сохранённых actual records добавлен в конце. Исполнитель не выполнял звонки самостоятельно и не подтверждает deployment/release.

## Production closure

В назначенном scope подтверждённых незакрытых P1/P2 не осталось. Это ограниченный source/unit review, а не утверждение об отсутствии любых ошибок проекта.

- **Cold snapshot + Hangup replay — закрыто.** Completion, generation и overflow проверяются до замены каналов. После сборки полной карты отдельный проход сохраняет origin до buffered replay. Независимый in-memory replay фактического класса проверил оба порядка snapshot: root-first и peer-first сохраняют out, исходный src и locked origin после удаления caller. Неполный snapshot сохраняет последнюю сводку с соответствующей freshness.
- **Быстрый перевод до первой публикации — закрыто.** Peer arrival уточняет unlocked origin через channels.get(linkedid) с проверкой tenant. Первоначальные caller/start сохраняются. Отдельное событие не обходит все каналы; origin map ограничена 100000 записей. Persisted metadata v3 восстанавливается и исключается из public details.
- **Результат звонка — закрыто в проверенных сценариях.** Owned CEL Playback/VoiceMail сохраняет техническую причину через terminal Hangup/ANSWERED. Caller ANSWER не считается ответом сотрудника; early Answer + BUSY остаётся missed/busy. Known technical application на destination не даёт положительного human evidence. Реальный destination answer или разговор с distinct owned SIP peer перекрывает IVR и поздние неудачные попытки. Active call не учитывается как завершённый пропущенный.
- **Tenant и provenance — закрыто.** CEL evidence привязывается к owned CDR UID/channel, проверяет linkedid/tenant; при известных UID и channel требуется их согласование. Foreign/conflicting identities и чужие peer отклоняются. Сохраняются только positive v3:human/v3:ai markers. Старый outcome accepted сам по себе не восстанавливает ответ и допускает исправление ошибочного результата. Подтверждённый AI playback/human answer переживает последующее отсутствие transient evidence. Legacy AI без playback proof остаётся unknown.
- **Corrections и replay — закрыто.** putCall атомарно корректирует old/new bucket, participants и tenant revision. Checkpoints не опережают успешные writes. Pending/semantics replay ограничены партиями по 500, используют durable cursor/fencing. Semantics replay сохраняет fixed upper key до обработки, возобновляется после restart и входит в readiness. Индекс (node_id,call_key) соответствует обходу; public calculation version — 3.
- **CEL-index P2 — закрыто по исходникам миграций.** Evidence query содержит linkedid IN (...) OR uniqueid IN (...). Обе 0033 добавляют idx_dashboard_cel_chain(linkedid,id) к existing uniqueid index. Реальные SQL планы и performance после добавления индекса проверяет root отдельно; этот исполнитель не выполнял DB EXPLAIN.

Scope: dashboard-collector.service.ts, dashboard-classifier.ts, dashboard-projection.service.ts и соответствующие collector/classifier/projection/completion tests; необходимые пути dashboard-read-store.service.ts; обе MySQL/PostgreSQL 0033-pbx-dashboard.sql.

## Независимые проверки

Это счётчики отдельных запусков; их нельзя складывать как количество уникальных тестов.

| Проверка | Результат | Граница evidence |
|---|---|---|
| Collector service + AMI после cold snapshot fix | 2 suites, 62/62 PASS, 3.518 s | Jest unit/in-memory, AMI mocks |
| Classifier + projection + completion + read store | 4 suites, 91/91 PASS, 5.284 s | Jest unit/in-memory; не live CDR/CEL |
| Read store SQL replacement contracts | 1 suite, 2/2 PASS, 2.262 s | Реальный Sequelize lexer MySQL/PostgreSQL; DB query mocked |
| Dashboard migration contract | 1/1 PASS, около 250 ms | Manifest и обе SQL files; не применение к production DB |
| Adversarial cold-snapshot replay | PASS для обоих порядков snapshot | Фактический CollectorService с in-memory adapters; без сети |

Full repository gates и actual SQL/load/browser/Asterisk/AI/exporter evidence принадлежат root и фиксируются отдельно. Повторный полный запуск тестов исполнитель не выполнял.

## Узкий review изолированного SIP runner

Прочитаны актуальные live-asterisk-lab.py и live-asterisk-lab-sip.test.py. Новые внешние действия и повторные production tests не выполнялись. Локальный UA test suite, заявленный владельцем, здесь не представлен как независимо запущенный.

- Contact parser (41–53) полностью разбирает единственный именованный или userless Contact. Назначение строго 127.0.0.1 и lab SIP port; URI parameters ограничены UDP subset. DNS, другой порт, maddr, TCP, Route query, несколько Contacts и CRLF отвергаются. SIP packets принимаются только с точного lab loopback socket.
- 2xx ACK использует remote Contact и новую branch; failure ACK/CANCEL сохраняют initial URI/CSeq/branch. BYE увеличивает local CSeq, ждёт фактический ответ и retransmits тот же transaction. 2xx, пересекающий outgoing CANCEL, получает ACK и затем BYE.
- busy.ulaw (371–373) создаётся только в contained private UUID spool через exclusive create: 144000 bytes конфигурационного приветствия. VoiceMail(101@lab,bs) исполняется настоящим Asterisk. Файл не является fabricated CDR/CEL event или AI proof и не затрагивает production voicemail.

**Low, ограничение тестового UA:** incoming CANCEL branch (live-asterisk-lab.py:208–213) пока не различает ringing и уже sent 2xx: отправляет 487 на INVITE и завершает локальный dialog даже после final response. Поздний CANCEL должен оставлять established dialog до BYE. Это не подтверждённый P1/P2 production dashboard и не доказанный дефект текущего sequential live-run; учитывать при добавлении race-сценариев. Root уведомлён; активный runner исполнителем не изменялся.

## Handoff

Root сохраняет владение production изменениями и actual run6. Следующее действие координатора — завершить isolated live acceptance/cleanup, отдельно зафиксировать фактические результаты и оставшиеся gates. Этот отчёт не заменяет live/release acceptance.
## Actual-record audit: завершённый isolated run6

Аудит выполнен 2026-10-11 по сохранённому live-dashboard-report.json и соответствующему runner коду, после сообщения координатора о завершении run6. Внешние звонки или другие действия повторно не запускались. Это независимая проверка записей выполненного координатором запуска, а не самостоятельно инициированный live-run. Раздел обновляет предыдущий handoff: run6 завершён, production deployment и отдельные непокрытые gates остаются за root.

**Сохранённый результат:** pass, 08:33:20.774–08:42:02.023 UTC, 12/12 сценариев и 27/27 проверок; errors пуст. Дополнительно исполнены один UI-звонок и один звонок для AMI outage. Реальные SIP UAs и временный второй Asterisk работали в изолированном loopback lab; dashboard API/UI использовали actual AMI и imported actual CDR/CEL в disposable MySQL 8.4.11. Telephony fixture=false, browser apiMocked=false. Tenants/users/rights/static endpoints — явно обозначенные конфигурационные fixtures; JWT identity подписана harness, actual guard/strategy/validateJwtPayload исполнены, login endpoint не проверялся.

### Raw provenance и согласованность

- Независимо пересчитано 16 raw CDR и 187 raw CEL, 14 уникальных tenant+linkedid logical groups: tenant910001 — 13, tenant910002 — 1. Runtime imported counts, SQL sourceCounts и lab rawCounts совпадают. SourceKey содержит private lab UUID, тип и номер CSV строки: линии CDR1–16/CEL1–187 непрерывны, дубликатов нет. Набор находится ниже evidence cap, признаков truncation нет. Все 14 групп имеют LINKEDID_END.
- Original raw_start_epoch/raw_eventtime_epoch сохранены. CDR UTC wall timestamps согласованы с исходным epoch в пределах секундной точности CDR; CEL UTC timestamps — в пределах миллисекундной нормализации. Преобразование времени явно описано runner; app/disposition/channel/uniqueid/linkedid не заменены ожидаемыми значениями.
- Final tenant910001: total13, incoming8, outgoing3, internal2, external0. Принятые/пропущенные здесь относятся к входящим: accepted4, missed4, unknown0. Это не число всех принятых звонков всех направлений. Независимая сумма SQL projected rows и 105 graph buckets даёт те же показатели. Final detail содержит 13 уникальных строк, total13; overview historyVersion совпадает с detail version. Final live activeCalls0; lab final channels0.
- Final overview составляет 18509 байт JSON без сжатия, 105 временных bins, в пределах заданных50KiB/300. Это размер данного небольшого функционального набора, а не повторное доказательство worst-case metadata budget.

### Проверенные actual сценарии

| Сценарий | Recorded projection | Raw corroboration |
|---|---|---|
| Incoming staff endpoint answer | in/accepted | destination AppDial ANSWER и реальный SIP bridge |
| Incoming no answer / busy | in/missed, noAnswer / busy | Dial NO ANSWER / BUSY, terminal CEL |
| Incoming IVR / voicemail only | in/missed, ivr / voicemail | CDR Playback / VoiceMail ANSWERED, owned CEL ANSWER соответствующего приложения |
| Internal staff endpoint answer | internal/accepted | e101→e102, destination AppDial и bridge |
| Outgoing staff endpoint answer | out/accepted | e101→trunk, owned conversational bridge |
| Internal IVR caller Answer | internal/missed/ivr | caller e101 ANSWER appPlayback, без destination answer |
| Early caller Answer + busy trunk | out/missed/busy | одна группа с Dial/BUSY и Hangup/ANSWERED; caller ANSWER appAnswer без разговора |
| Employee blind transfer | один in/accepted logical call | 2 CDR legs, один linkedid, BLINDTRANSFER и ответы e101→e102, один SQL projection row |
| Autodial-tagged answered call | out/accepted, originautodial | фактический loopback Dial с dialplan userfieldautodial_lab; engine не запускался |
| Second tenant, same extension101 | отдельный in/accepted | tenant910002 suffix/binding и отдельный logical row |

Все expected direction/outcome/reason/origin полей 12 сценариев совпадают с recorded actual. Для всех шести accepted сценарных звонков исходный SIP participant имеет RTP sent>0/received>0, established talking dialog и завершение BYE с ответом200. Это фактические SIP/media signals тестовых UAs, не участие живого оператора. Реальный userless Asterisk Contact sip:127.0.0.1:15606 сохранён в UA diagnostics.

**Граница IVR evidence:** successful run6 прерывает звонок во время Playback/VoiceMail; его raw lastapp — Playback/VoiceMail, а не terminal Hangup. Ветка IVR terminal Hangup/ANSWERED после завершившегося приложения проверена отдельно source/unit review и прежним actual failure record; нельзя заявлять, что run6 заново live-проверил именно эту вариацию.

### Access, UI, HTTP и отказ источника

- Restricted101 и overlapping101102 дали по9 уникальных звонков, summary=detail и без повторов. Этот access checkpoint выполнен после 12 основных сценариев, когда tenant910001 имел11 звонков; он предшествует дополнительным UI/outage звонкам и не является final-scope total при13. Final tenant isolation подтверждается 13/1 раздельными projected rows; actual linkedid collision между tenants в этом run не создавался.
- UI на390 и1280 показывает реальные historical metrics/drilldown; дополнительный actual call проходит ringing→conversation→одна active detail row→hangup→согласованный historical counter. Browser errors пуст, API не подменялся. Dark/light/прочие mock-browser gates находятся в отдельной evidence.
- 100 одновременных actual HTTP overview requests используют одну admin test identity/JWT: p95=407.54ms, окно около429.72ms, additional AMI bulk actions0. Это небольшая functional dataset и HTTP burst; не100 независимо аутентифицированных пользователей, не100 постоянных UI/socket sessions и не large-CPS/high-channel capacity test. Background history recomputation delta отдельно этим check не измерялся.
- AMI paused через реальный TCP disconnect: recorded manager connected=false, actual remote call оставался жив с2 каналами. Runner actual HTTP assertion дождался stale, сохранил activeCalls1 и прежний callsSource.updatedAt2026-10-11T08:41:31.055Z. Resume восстанавливает complete snapshots и talking; final history учитывает outage call один раз.
- **Граница outage evidence:** exact stale HTTP body в JSON не сохранён. amiPause.sources является ранее cached ok diagnostics, тогда как stale проверен успешно завершившимся runner assertion169–172 и check с исходным timestamp. Это различие не скрывается и не заменяется invented stale data.

### Cleanup и оставшиеся границы

Local runtime cleanup=pass. Remote cleanly recorded: cleaned, mainUnchanged, ownPidStopped, directoryRemoved, portsReleased — все true; дополнительно directoryContainmentVerified=true. Runner требует эти пять booleans для pass; private UUID spool/PID/ports убраны. Этот аудит не выполнял отдельную remote проверку после cleanup.

productionAppDeployed=false и productionConfigChanged=false: новая production application не развёрнута, основной Asterisk не reload-ился и production CDR/DB не использовались для тестовых записей. Сохранённый lab bootstrap содержит ошибки отсутствующих optional configs; функциональный PASS не означает отсутствие любых диагностических сообщений Asterisk.

Работоспособный AI с реальным provider/runtime, AI→staff, actual autodial engine, high-CPS/events/sec/channel concurrency и первоначальный10k/1000/5m dedicated profile этим run не доказаны. Large seeded SQL и unit collector gates, dual-dialect/live exporter проверки принадлежат отдельным отчётам. Run6 исполнялся на MySQL; его данные не являются live call acceptance на PostgreSQL. Release/full installed application acceptance остаются отдельными решениями.

**Итог actual-record audit:** сохранённый run6 внутренне согласован и подтверждает заявленные ограниченные loopback сценарии и API/UI integration. Новых подтверждённых P1/P2 по проверенным records не найдено. Evidence limitations выше должны сохраниться в итоговых документах координатора.