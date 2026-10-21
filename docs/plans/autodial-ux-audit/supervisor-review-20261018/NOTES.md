# Супервизорский аудит — рабочие наблюдения 18.10.2026

Это новый аудит интерфейса после релиза 4.7.1.1 (427a5059), а не повторное выполнение исторического REPORT.
Координатор /root, codex-direct, без агентов. Продуктовый код не изменяется. Примеры клиентов синтетические.

## Уже проверено живьём

- Обычный парольный вход supervisor369: запрошенный /autodial после входа сменился /callcenter/supervisor. Source AuthLogin всегда resolveRoleStart, не восстанавливает deep link.
- Через UI создана база6 «SV-AUDIT-20261018-Должники», кампания6 «…-Долг», клиент19 (00991419, 15240.50 RUB).
- Мастер7шагов, шаблон базы, режим agentless, TTS70, DTMF→payment_promised, расписание пустое, 1канал,1попытка, выделенный внутренний loopback-транк.
- Предпрослушивание11.044s, media readyState4/errornull; текст с именем и русской суммой прописью.
- Внутренний тест bdb98f58-424a-4731-90cf-7332cf5bb78f: реальный TTS-текст, prompt7221d29069879cd644e5c0b8, Normal Clearing.
- Preflight6проверокPASS. Обычный запуск: attempt212/task22/ac-6-22-1, duration14/billsec13, PLAYBACKSTATUS SUCCESS, DTMF1, business_outcome payment_promised. Технический исход answered_short из-за success_min_sec20; задача completed/max_attempts. Не называть это отказом TTS или потерянным бизнес-исходом.
- Пауза и остановка через UI; журнал подтверждает369 и переходы. Кампания6 stopped.
- CSV/XLSX скачаны через реальные UI-ссылки. CSV1строка, XLSX2листа(detail+Provenance), business_outcome есть внутри JSON результата сценария.
- Редактор схемы на390×844/320×740 не выходит по горизонтали; footer полностью в экране. Все5полей раскрыты, много вертикальной прокрутки; кнопка закрытия16×16, не делать без проверки spacing вывод о нарушении WCAG.

## Подтверждённые проблемы/наблюдения для окончательного отчёта

1. TTS builder получает capabilities нового provider70, а общий StepSheet читает legacytts-engines: пустой disabledselect, неверный переход /settings/tts-engines. Реальная озвучка при сохранённомengine70 работает. Sources useSchemaRefs/text2speech.tsx.
2. Созданный клиент сразу не появился в таблице кампании; появился после переключения вкладок. Source campaignContacts providesTags idlessAutodialContacts, mutations invalidate base-specificid. Нужна единая адресация тэгов +репродукция тестом.
3. Поля базы уже вынесены в модалку. Осталась неоднозначная карточка: внутреннее имя выбирает базу, свободная зона открывает настройки; две разные операции без явного affordance. В20remсписке названия переносятся; нет поиска/сортировки баз.
4. 1440px: боковой список+огромные padding/card уменьшают таблицу,6полей уже горизонтально прокручиваются. Без выбора колонок/закреплённого имени/телефона и savedviews.
5. Схема5–6полей — повторяющиеся развёрнутые технические формы. Противоречит canon collapsedbydefault entities; key/var_name слишком рано. Выбранный шаблон сразу сбрасывается визуально.
6. Очереди в мастере отображаются q…_0 вместо пользовательских подписей. Trunkadd сразу выбирает первый реальныйspbx; placeholderс явнымвыбором лучше.
7. Длительности повторов в часах отображаются0.16666666666666666/0.08333333333333333. Даты/часовойпоясклиента — числоминутUTC, default0; требуется понятное название зоны +следующее разрешённое время.
8. Последний шаг мастера не содержит полной сводки «кому/что/когда/через что/какой результат». Редактор клиентской базы вложен в мастер. Названия7шагов технические; нет сквозных шаблонов бизнес-задач.
9. Startdialog первого запуска показывает полный список redialисходов без истории и количества выбранных задач; описание «по всем номерам базы» полезно, но желательно audiencecount+channels+schedule+revision+testsummary.
10. Технический success_min_sec20 и бизнес-цель раздельно сохраняются, но UI «Успешно0 / RPC0» приpayment_promised1 провоцирует неверный вывод. Source rpc=success/dials, это не подтверждение личности Right Party Contact. Нужен словарь KPI и бизнесцелей.
11. Монитор: healthкарточки ВСЕХ кампаний стоят выше общихKPI/активныхвызовов, повторяют таблицу. При5кампаниях активныевызовы уже за первым экраном. Драфт/остановленные тоже показаны. Диагноз «лимит транка» кратковременно рядом «доступные задачи обработаны» во время активного вызова — нужна главная причина+context+время данных.
12. Overview и некоторые счетчики обновляются polling15s; данныхнамоментвремени/возрастаданных везде нет. Во время звонка0из1 и фактически завершённаязадача воспринимаются как рассогласование; не называть доказанным постоянным багом.
13. Report detail не содержит клиента/телефона/external_id, в строке нет перехода к контакту/попытке. Запись есть в другом табе breakdown, не говорить «записей нет вообще». Настройка колонок тоже только вbreakdown, не отрицать её наличие.
14. UI бизнес-исход — technicalpayment_promised; XLSX JSON, не отдельныепонятныеколонки. Нужны label/category/goal+подсчётпоцелям. Нет основания подменять старую метрику при миграции молча.
15. Сводные/детальныеreports: hooksнепроверяютisError, ошибка может выглядеть «Нет данных» (source-only until live). Графики hardcoded#6366f1/#3b82f6/#22c55e, pieпоindex; расходятся с актуальнымtoken/statuscanon.
16. Integration API уже есть: динамические values, bulkupsert/expected_revision/Idempotency-Key, CSV/XLSXasync, DNC/webhooks/MCP. Раздел ключей только дляадмина внизу настроек любойкампании, scopeнаорганизацию, UI APIдокументации не найдена. Нужна discoverability, не «создать API с нуля».
17. JWT полного сеанса в queryURLexportlink (не включать его в отчёт/скриншоты/JSON). Нужен authorizedfetch/blob или краткий scopeddownloadticket. Во всех дальнейших DOMвыводах sanitization.
18. Journalactor#369, revisionnumbers, без humanname/diff/correlation с попыткой; сделать читаемуюоперационнуюисторию.
19. Headerimg /brand/aipbx-logo.png?v=2 complete+naturalWidth0 на живой странице. Global shell issue; HTTPstatusпоканеподтверждён. FloatingAIwidget частично занимаетобластьлоготипа наскриншоте. Не выдавать зауникальнуюавтообзвонполомку.
20. ОрганизационныеAPIkeys/privacyнастройки размешаны в per-campaignsettings. Роль3privacydisabledс пояснениемправ — правильно, scopeконтекст—слабый.

## Непроверенные/отложенные пункты

- Во время ручного ввода даты черезCua .fill DOMvalueбыло2026-10-25, Reactstateattributeпустой, APIнеполучилdate. Пока НЕклассифицировать какпродуктовуюошибку: возможнаособенностьавтоматизации нативногоdateinput. Проверитьклавиатурой/CSV/API.
- Agentless intentionally excludes toqueue: не считать отсутствующую кнопку ошибкой. Progressive/power/predictive ещёнепройденыживьём.
- 12:35–12:40 +07: API/auth504/healthtimeout, SSH handshake/publickeyдолго→timeout. PendingUIcreateбазы…-Приём; нельзя дублировать доинвентаризации. Причина стенда неизвестна, не приписывать модулю. Первый кампанийный звонок завершён/остановлен до проблемы.
- Appointment/CSVnegative/APIidempotency/DNC/recordingplayback/AIassist/globalreports/mobilewholepages ещё требуют живыхпроверок при восстановлении.

## Cleanup / next

### LAN continuation 13:50 +07

- Exact427a/schema48 own stack3181; normal users4/5. UI base1/campaign1,5contacts,1DNC. CSV3accepted/2rejected,
  profile1 and customcabinet created; API upsert/replay409/revision409/unknown400/date400/scope403/revoke401/async import PASS.
- Native date edit with keyboard saved2026-10-26; initial .fill issue is automation-specific, not a product finding. UI table
  briefly stale; later refreshed. Schema cabinet string→number applied with5archives, phoneIDs/externalIDs preserved.
- Derived date var rename defect reproduced via actual schema-preview/apply; old TTS token remained. Restored exact scenarioJSON.
- HTTP LAN IP crypto.randomUUID failure; localhost13181 SSH forward resolves secure-context requirement. No browser warning bypass.
- Existing own Asterisk16 rejected AMI Command Follows; first internal test failed. Switched own PBX to official Ubuntu24.04
  packaged Asterisk20.6.0 (image2e8c8c…); application bundle unchanged. Failed source-build attempts are setup, not app defects.
- Diagnostic dialplan CLI exposed own temporary internal key in tool output; rotated before actual20 calls, recreated only own
  backend with0activechannels; old key invalidated. Never store it in deliverables. Do not print runtime dialplan/config again.
- Rev4applied4; internal actest62e763d1… normal end, actualTTS text/prompt. Ordinary main attempt1 answered21sec/playbackSUCCESS,
  dtmfnull; attempt2busy;3ringing6s reportedfailed/Unknown;4answered10sec, dtmfnull. DNC023 not dialled. Pause/resume and automatic
  completion verified. Live lane observed with name/number/currentstep. Negative results retained, not declared business success.
- Read without prompt on packaged20.6 returns immediately READSTATUSOK with empty digits; need compatibility coverage. Secondcall
  uncached TTS exceeded5s dialplan HTTP budget and used beep; technical success still recorded. Real SAPI generated correct audio
  afterward. Added actual synthesized-audio memoization to own provider helper, warmed known synthetic texts; subsequent positive
  cases must be labelled warm-provider, explicit Read prompt. No product code change. Tone prompt1 is a synthetic0.2s440Hzfile.
- ipbx cleanup connectivity retry failed again (HTTPtimeout/SSHconnecttimeout); no restart/newcases there. Old fixtures pending.
- Current localTTS session19908 (old83377 ended), LANreverse2527, localUIforward89591, AMIwatch in ownbackend (20min and8minTTL).
  All own containers/buildimages/dirs require cleanup after evidence. CDR allowed SELECT-only completed synthetic facts; do not
  promise nonempty rawCDR if PBX persistence wasn't configured. CDR runs locally now, no LANload.

Own provider70, users369/370/endpoints00991419/20, base6/campaign6/contact19, возможнаяpendingбаза…-Приём,
own /etc/asterisk/krasterisk/autodial/sv-audit-20261018.conf, recordingdir…/acceptance/sv-audit-20261018,
TTS15013(session83377), reverseSSH47126, AMI53398. Private tracking внеrepo, пароли/ключи не печатать.
Сохранить safe evidence, удалить только exactownfixtures и сессии, проверить baseline4кампании и0activecalls.

## Итоговый handoff 18.10.2026 — заменяет next/pending в старых заметках выше

Аудит завершён с40замечаниями U01–U40. Канонические результаты — REPORT.md, предлагаемый PLAN.md ревизия2, DESIGN-CONCEPT.html; продуктовый код не менялся. A0–A7 выполнены в явно указанной матрице покрытия. A8 LAN PASS, ipbx pending.

- Контрольная campaign2 создана через обычный API после выявленного UI400 при clone расписания (U40). Явный prompt для Read и прогретый реальный SAPI,1канал/1попытка/2синтетических адресата: attempt5 DTMF2/visit_reschedule, attempt6 DTMF1/visit_confirmed, NormalClearing, completed. Отрицательные U38/U39 не закрыты этим условным положительным прогоном.
- Получены5приёмных SIP MixMonitor WAV; для attempt5/6 проверены SHA256 и корреляция PCM0.99990 с фактическим синтезом. Нет заявления о ручной расшифровке. Доказательства и SAPI refs находятся в recordings/ и sapi-cache/; архивы audit-evidence.tgz/voice-evidence.tgz проверены.
- CRM results по external_id PASS; повторный импорт профилем0accepted/5rejected без дублей, XLSX ошибок проверен, кириллица цела. Глобальный CSV2строки и XLSX6попыток+Provenance, бизнес-исходы в JSON, JWT внутри XLSX не найден. Экспортный URL с session JWT остаётся U06.
- Реальный монитор active lane и отчёты/сравнение/разрезы просмотрены. UI воспроизведение записи не аттестовано: у изолированного PBX нет CDR/CEL persistence/index. Настроенной LLM на LAN нет; U36 — ошибочная диагностика отсутствия модели. Power/Predictive с операторами/AMD/робот/нагрузка — отдельные необходимые кейсы будущей приёмки.
- LAN cleanup07:10:39UTC: удалены9ownконтейнеров, сеть, runtime image tag, точный root со своей БД/секретами. Финальная SSH-проверка:0ownконтейнеров, root/networkfalse, own_ports_listening[]. Остановлены локальные helpers, отозваны APIключи, приватный LAN файл удалён. Чужие ресурсы не мутировались; из-за исправленной ошибки full/short DockerID и усечённого events не объявлять полный foreign before/after-ID diff PASS.
- CDR thread01a14cff-e054-7ba0-931d-95fd94bfb3e8 получил итоговое сообщение об освобождении3181/15013 и namespace по прямому разрешению пользователя. Его0049/0050 и исходники не менялись.
- RU/dark восстановлены, viewport override сброшен. Последующие попытки закрыть две собственные вкладки CUA завершались stale/focus timeout; новых браузерных действий для завершения аудита не требуется, runtime уже отсутствует.
- Оставшаяся работа — только точная очистка прежних ipbx fixtures при восстановлении доступа. Следовать CLEANUP-PENDING.md; сохранить private ipbx tracking вне repo до receipt. Не повторять create неизвестной базы/звонки и не перезапускать чужие службы. Никакой дополнительный рефакторинг не назначен.

Полные suites текущего чужого dirty baseline не запускались: изменения этого задания только в артефактах. Исторические CI/релиз4.7.1.1 остаются отдельным evidence. Следующий координатор читает текущий header и final handoff существующего EXECUTION.md, не продолжает старые next из промежуточных заметок.
