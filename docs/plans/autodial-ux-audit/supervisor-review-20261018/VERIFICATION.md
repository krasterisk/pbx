# Приёмка реализации PLANr2

Координатор: `/root`, чат `01a14365-0819-75a2-b04b-b2132bd65a45`, `codex-direct`.
Состояние на19.10.2026: **Реализация завершена; automated-tests-passed / live-verified для доступных сценариев / cleaned. Полная UX-приёмка остаётся частичной: настоящий browser200% недоступен текущему IAB; рабочий SA dashboard недоступен из-за locked лицензии. Не released; новой публикации не было.**
Текущие назначения и точные команды — в хвосте [EXECUTION](../EXECUTION.md); этот документ фиксирует evidence и gates, не заменяет PLAN.

## Проверяемая сборка

- Использован изолированный стенд `192.168.2.201:3181`, namespace `sv-autodial-impl-20261018`, схема0053. После успешных проверок все7собственных контейнеров/сеть/том/root удалены; соседние CDR/AI namespace сохранены.
- Backend25: `6b2af1f38408a787a4d0c578d5e202cc552be3b3bd42ca0e3df8a9ace253841c` (`runtime-cut-25.json`), verified before final teardown.
- Frontend29: `23d78954df6e9589ad2fda38e1f960237f791ac7eb334a91d58db56ca01dcdeb`, deployed and live-verified before final teardown; bundle main-BfX4s6Lt.js. Earlier speech/focus26/27 receipts remain separate, unchanged code/CSS inherited.
- Shared16: `dbd810387dda3b8f2c9f88e575175e39e6adfcaf5b8f9d03cac4605e34577826`.
- Backend упакован поверх frozen8 с заменой только `modules/autodial/**`. Shared — только `types/autodial.types.*`. Защищённый чужой AI фрагмент компилятора сохранён.
- Final source snapshot: `implementation/source-freeze-29.json`,2572hashes/F2063/CDR13/compiler unchanged. Types/lint/Vite29 and full frontend29b PASS;474files2598tests0skip/24chunks/exit0, fork1/chunk20. Backend25/shared16/schema0053 unchanged. Old27 is historical;28/first29 cancelled or failed NOTPASS.

## Автоматические gates

| Gate | Статус | Evidence / граница |
|---|---|---|
| `npm run test:backend` | pass | Additional current root gate executed by CDR owner:500suites passed/1skipped,4810tests passed/27skipped,exit0; all2907source hashes verified current,226own source29 B/shared overlap unchanged. The27skips are opt-in autodial-data.integration.spec.ts (AUTODIAL_DB_INTEGRATION not1), checked at line36; separate actual MySQL/PG receipts remain distinct. backend-peer-acceptance-29.json and peerreceipt/manifest; not independent code review/live integration. Historical deployed B25 snapshot4809 separate. |
| `npm run lint` | pass | Source29 exit0,0errors/123backend+101frontend warnings; root-lint29-exit.json, all2572hashes unchanged. |
| Frontend TypeScript | pass | frontend-types-29-exit.json,exit0,all2572before/after hashes unchanged. |
| Vite production build | pass | frontend-build-29-exit.json exit0; deployed SHA above, verified actual bundle in auth-live-29.json. |
| Mobile lifecycle regressions | pass | `frontend-mobile-19b.log`: 2 files / 7 tests. Нет nested whole-card button, отдельная навигация, отсутствие ложного current count после failed polling. |
| Calendar lifecycle regressions | pass | `backend-calendar-18-before.log` воспроизводит дефекты, `backend-calendar-18b.log`: 3 suites / 28 tests. CAS учитывает status/revision, manual pause побеждает stale scheduler. |
| Dirty route/focus regression | pass | `frontend-route-20b-before.log`: automatic tab focus сам открывает warning. `frontend-route-20c-full.log`: 3 files / 6 tests PASS, actual workspace + Radix + data router. Native UI20c Cancel/Enter/Escape/Confirm и сохранённый label/revision3: `route-draft-focus-20.json`. Старые пробные тесты с неверным предположением о mouse focus не используются как доказательство red/green. |
| Весь Autodial frontend | pass | Included in complete frozen source29 run474files2598tests;89targeted auth, prior own regressions and actual voice/UI receipts retained. |
| `npm run test:frontend` | pass | frontend-acceptance-29.json: root-frontend29b-exit.json exit0,474files2598tests0skip/24chunks/noUnhandledErrors, all2572hashes/current frontend inventory/CDR13/compiler unchanged. First29 worker failures and partial28 NOTPASS,27 historical. |
| SQL / command integration | pass, отдельные receipts | Реальные MySQL + PostgreSQL command clone/replay/rollback/tenant/actor проверки; schema frozen0053. Не выдавать unit mocks за эти прогоны. |
| Независимый review | not-performed, не отдельный gate | PLANr2 не назначает отдельного reviewer. Выполнена самопроверка координатора; она не называется независимой. Согласования владельцев не выдаются за независимое review. |

## Соответствие задачам и живые проверки

| PLAN | Реализовано / проверено | Оставшаяся граница |
|---|---|---|
| UX00–UX02 | Baseline/ownership/словарь состояний; user takeover3authfiles recorded in auth-takeover-28.json. | No ownership blocker remains; final source29 gates pending. |
| UX03 | Shared Routes/IVR provider3 preview PASS. Source26 actual supervisor4 selects TTS3 + speed1.0 in StepSheet, saves revision4/preflightready/internalcall ended/playback_completed/DTMF1/goal; originalactions restored revision5. `provider-context-live-25.json`, `live-acceptance-26.json`, screenshot42/43. Administrativecatalog403 preserved. | Source27 full frontend PASS. Routes/IVR smoke used disposable unsaved drafts; no productive traffic. |
| UX04–UX06 | Cache freshness, сохранённый draft, command reconciliation, authenticated blob export без JWT в URL; live CRM/schema/export/recording ACL. | Source27 full frontend PASS; auth return отдельно UX07. |
| UX07 | Explicit trunk/lines section plus safe one-time return implemented. Final29 actual cold18 and GET401+refresh401→login reload→ordinary password preserve tab/query/100%25/hash; user navigation not hijacked; normal logout confirmed. auth-live-29.json,auth-fault29-final.json,screens57/58;89targeted pass. | Role/locked-module actual negative evidence28, unchanged hook/catalog29; SuperAdmin and other negative cases tested in89targeted, no claim of live SuperAdmin session. |
| UX08–UX11 | Базы: отдельные Clients/Fields/Imports/Integrations/DNC; 12 typed fields, samples, UTF8/Windows1251/XLSX, normal API arbitrary fields/external_id, saved transforms/profile/errors/replay/ACL. | Global source27 PASS; все данные синтетические, финальная очистка после оставшегося auth gate. |
| UX12–UX15 | Цели/мастер/раскрытие правил, launch summary с ревизией/ограничениями/последним собственным тестом и stale warning. Calendar wait persisted as scheduled, ручная пауза сохраняется, новый тур не стартует вне окна. | Нет заявления о нагрузочной точности Predictive. |
| UX16–UX19 | Branch/outcome editor, typed speech, вход без записи, neutral wrong-party/no-input, survey, immutable snapshots, test timeline/limits/idempotency. Реальные debt/appointment/notification/operator/survey и DeepSeek unedited AI17. AMD NOTSURE продолжает сценарий; MACHINE завершает вызов без speech/goal. | Это синтетические ветви, не точность voice classification; robot transfers safe test не подтверждает. |
| UX20–UX22 | Приоритет active/waiting над drafts; 50 кампаний, future20 поднята с позиции32 на первую; монитор ARI/AMI/SSE/freshness, unknown вместо ложных нулей; объяснения без AI. Mobile19b компактнее, кнопки44px, без технического KPI wall. | Наблюдение координатора не равно пользовательскому тесту «определил за10сек». |
| UX23–UX26 | Business outcomes отдельно от technical success, human frozen labels, detail/inspector/current vs admitted data, report selection clone/CAS/export и authenticated recording player. | В Power/Predictive прогоне authoritative billsec0 сохранён, не подменён elapsed16sec; это не проверка тарификации PBX. |
| UX27 | Shared UI/Stack/Text/Table/Modal/FSD/SCSS tokens; live working CallCenterSupervisor compared, screenshot34. | SA catalog locked for both actor4level3 and5level1; working dashboard unavailable on provided configuration, no activation/purchase/license bypass. catalog-availability-28.json. |
| UX28 | RUdark/ENlight five pages and previous viewport/mobile/short-height/focus matrices retained. Actual system reduced-motion now true; base form and speech Sheet have animation none/duration0/transition0 and no visible moving elements. reduced-motion-live-28.json/reduced-motion-step-live-28.json,53 screenshot; CSS unchanged27→29. | True browser200% unavailable with exposed IAB controls; reflow remains separate. No screen-reader audio claim. |
| UX29 | Source29 targeted89, lint/types/Vite, complete frontend474files2598tests PASS; immutable owned backend25full4809/27skip. Guarded exact LAN/local cleanup and postcheck PASS. | True200% and workingSA benchmark remain environment limitations; no independent review or release claim. |
| UX30 | Schema usage/delete409/rename/CAS и сохранение производных SAY_DATE/MONEY refs; live schema10 с восстановлением данных. | Общие владельцы сохранены, чужие сценарии не переписывались. |
| UX31 | Existing secure-context/PBX16.28+20/LLM prerequisites retained. Final29 controlled actual GET401+refresh401→working/v4/login→reload→normalpassword→exact18encodedquery/hash PASS. Original proxy bytes restored,0errors. | Natural-expiry timing not claimed; rawAMI Follows unit-only. |
| UX32 | Cold/warm16.28 SIP received PCM, 20 real TTS/Read/DTMF; unavailable synthesis, no-input, invalid9, empty audio, invalid WAV PlaybackFAILED, slow35s response interrupted30.007s/TTS_FAILED. Empty text400 не создаёт кампанию. | Никакого скрытого fallback; ошибка не считается доставкой/целью. |
| UX33 | Нормальное create из отчётной выборки с source schedules без campaign_uid в input, частичный успех/replay/CAS, draft only. | Ни один clone не запускает аудиторию автоматически. |

## Ключевые receipts

Все имена ниже относительно `implementation/`.

- `calendar-live-18.json`: future20 resume scheduled/tour1 → duplicate start409 → own backend restart → persisted scheduled → manual pause/restart persisted → stop/start scheduled/tour2; 0 attempts. UI Pause после этого проверена отдельно. `portfolio-50-18.json`: только disposable UID20–51.
- `speech-negative-18.json`: campaign52, test `a124532f-0149-435b-8298-10f6d50ec461`, три observed failed шага, delivery playback_failed, no business goal, no ordinary attempts. `32-speech-failures-18.png`.
- `operator-modes-19.json`: Power53/attempt23 и Predictive54/attempt24; own internal operator AgentConnect, achieved business goal, answered_short; reported billsec0, answer-to-end16sec отдельно. Это ограниченный функциональный тест, не нагрузка/abandon SLA.
- `amd-live-19.json`, `amd-machine-live-19.json`, `verify-amd-19.py`: completed55/attempt25 NOTSURE → notification playback_completed/achieved; completed56/attempt26 MACHINE → amd_machine/2sec/no speech steps/no goal. Stock app_amd config из точной установленной версии official Debian package извлечён только в собственном контейнере. Классификация на synthetic silence и440Hz tone не заменяет оценку на человеческой речи.
- `survey-live-16.json`: campaign18 revision2, positive1/negative2/invalid9/silence; positive и negative дают полученный ответ на опрос, invalid/silence не цель. Campaign18 позднее вручную изменена до revision3; эти тесты остаются историческими revision2.
- `latest-live-17.json`, `ui-focus-revision-17.json`: actor4/5 раздельные latest, cross-actor404, missing404/anonymous401/no-store, stale revision2 vs3 visible.
- `compat-live-17.json`, `compat-voice-17-{cold,warm}.json`, `asterisk16-call17-final.json`: фактический16.28, cold/warm голоса+DTMF1+goal, restored own20/backend, 0 channels/restore_errors[].
- `ai-ordinary-15.json`, `ai-ordinary-voice-15.json`: созданная DeepSeek AI17 без ручной правки, ordinary attempt22, имя/дата/время, actual received PCM; полная greet корреляция .99990049, closing5.22/5.234s .99990439 с явным14ms trim. Нет заявления о человеческой расшифровке.
- `retry-cases-11.json`, `tour-live-15.json`: Busy/no_answer по2 с интервалом, новый тур/reset task counters/global attempt numbers продолжаются, история не переписана. Исторические ошибочные13/14 сохранены как fail evidence.
- `pbx-fault-16-final.json`, `26-monitor-unknown-counts-16.png`: own PBX offline/recovery, показатели неизвестны, browser Live не выдаётся за ARI/AMI.
- `mobile-layout-19b.json`, `mobile-matrix-19b.json`, `inspector-focus-19.json`: measured geometry/focus, не предположение по одному screenshot.
- `routes-tts-refs-19.json`, `ivr-tts-refs-19.json`: начальный engine пуст, выбор provider3 вручную; фактический IVR audio readyState4/currentTime=duration2.764/ended. Routes и IVR остались без созданных сущностей.

## Cleanup и передача

Промежуточная очистка портфеля **pass**: `portfolio-cleanup-20.json`, удалены ровно UID20–51, 18 исходных кампаний и все базы сохранены; оставлено23 текущих собственных кампании. HTTP429 обработан через Retry-After без обхода лимита.

Финальная LAN очистка **pending**: семь контейнеров/сеть/root, disposable users4/5/extensions/trunk/queue/providers/keys/bases/campaigns, новый AMD receiver28 и synthetic wave, локальный TTS PID902996 и SSH helpers ещё нужны для оставшихся gates. Удалять только точные собственные IDs/prefix/label, после завершения живых проверок; CDR namespace и общие images/source сохранять.

Частичная очистка доступов24 **pass**: `cleanup-access-24.json`, отозваны три точных tracked integration-key UID (writer/reader/TTL), повторный read401, секреты удалены из private tracking; посторонние строки keys не изменились. Own operator5 normal logout, ready_agents0; активных/scheduled кампаний нет. Accounts/stand/providers/helpers остаются для auth gate. Ошибка первого prefix guard остановила helper до любых изменений, затем исправлена только проверка существующего LAN prefix.

Прежняя primary/ipbx очистка закрыта отдельными receipts. На primary этот этап не выкатывался; нового commit/push/release нет. Текущий dirty baseline содержит чужие AI/CDR/shell изменения, их нельзя включать общим `git add`.

## Дополнение source21–23

- Async schema focus: `schema-focus-22.json` — actual720×450, 12Tab внутри nested dialog, Apply bottom399<450, Escape возвращает Preview button, parent Cancel возвращает Editor, base12 revision8 unchanged. Live pass.
- TTS availability: `provider-catalog-negative-23.json` — normal admin5 disable3/readbackfalse/preflight17false → finally restoredtrue/preflight17ready. `provider-admin-ui-23.json`: saved UID3 preserved, disabled option/aria-invalid, correct `/v4/settings/tts-engines`; `provider-disabled-ui-23.json`: own Library no providers/Apply disabled and supervisor4 explicit403. No ordinary calls/config saves.
- `catalog-link-after-23.json`: corrected URL renders actual TTS settings/provider3 enabled; previous missing basename blank-page evidence retained.
- Actual restored3 cached-disabled after close/reopen exposed refresh gap; source23 adds TTS-only refetchOnMount and Retry in unavailable states, no draft rewrite. `frontend-refresh-23c-before.log` valid3fail/6pass → `frontend-refresh-23-after.log` 2files20PASS. Initial threads runner hung at RUN and exact owned PID746300 tree was stopped; wrong relative node path failed before tests; neither counted as product red.
- Initial build23 used wrong environment name VITE_API_BASE_URL and was stopped by exact PID761580/creation/command before package/deploy; build23b uses VITE_API_URL=/api. Wrong build not accepted. Source23 lint/types/build/live/global gates pending their receipts. Backend18/shared16/schema0053 unchanged.

## Source24: устойчивость открытого редактора

`frontend-polling-24-before.log`: actual component при429/504/FETCH_ERROR теряет textbox (3fail/4pass). Ограниченное исправление оставляет currentData только для временных ошибок, показывает stale+Retry, блокирует lifecycle/reapply/start confirmation;401/403/404 скрывают cache. `frontend-final-24.log`:3files27PASS, включая сохранение черновика после recovery и прежние Cancel/Escape regressions. Последующий guard StartDialog24 проверен типами/сборкой/full suite.

Live `polling-fault-24.json`: normal GET own18, bounded22 requests stopped on first429, RetryAfter60;200 restored/revision3 unchanged. `polling-ui-24.json`: draft retained, warning explicit, Start disabled; automatic polling recovered after cooldown before Retry click, draft still retained, explicit Cancel restored original label. Manual Retry dispatch подтверждён unit; не выдаётся за live click recovery. Screenshot40. Source23 TTS `tts-refresh-live-23.json` independently records successful actual Retry click→same UID3 enabled/aria-invalid absent after caretaker25 restore; screenshot39.

Source23 types/lint/build passed, source24 frontend-only supersedes it. Final full24 currently running; source/backend/shared/peer hashes are frozen. No new calls, config saves or foreign writes during these UI cases. UI failure screenshot38 is failure evidence, not TTS acceptance screenshot.

Финальная очистка подготовлена, но **не выполнена**: `cleanup-namespace-24.py` по умолчанию делает только inventory; `cleanup-namespace-inventory-24.json` pass — точные7 контейнеров/own label, собственная сеть, точный Redis volume с проверкой отсутствия других подключений, все bind paths внутри собственного root,0calls/channels. Built-in host network не удаляется; shared images/source сохраняются. `--apply` ждать оставшихся auth/live gates и завершения full suite. Первый dry run остановился на неименованном Redis volume/host; оба случая проверены явно до разрешения инвентаризации, никаких удалений не было.

CDR owner подтвердил отсутствие подходящего live SA dashboard screenshot: `shots/07-sa-conversations-1440.png` фактически login, R6 browser evidence — CDR карточка с SA результатами. В качестве доказательства рабочего dashboard не используется. Новых активаций/проверок у соседней задачи не запрашивали.

`deployed-frontend-24.json`: по обычному HTTP проверены HTML и `/v4/assets/main-DbUA80Er.js`; байты совпали с frontend-dist24,200, index SHA `2c4a9b3e7e2e2a2ec006e368cbe76d83c5647347a4e020ce032e86e6786e8e22`. Это проверка развёрнутых файлов отдельно от Vite exit и UI.

`cleanup-deepseek-24.json`: удалён только own LAN provider4 с точной меткой `SV-IMPL-LAN-20261018 DeepSeek` после завершённых AI-прогонов; других provider rows не изменили. Primary provider59 в этом cleanup не запрашивали и не меняли. Исторические AI receipts остаются, повторное AI создание на очищаемом стенде сейчас требует новой конфигурации; её отсутствие после cleanup не дефект.

**UX03 дополнительный функциональный gap:** `tts-forbidden-ui-24.json` фиксирует корректное объяснение403, но supervisor4 всё ещё не может выбрать engine в отдельном StepSheet, хотя Library использует разрешённый `/autodial/capabilities`. Source25 согласован с владельцем общего редактора: контекстный TTS catalog только для autodial, без расширения API/ролей, Routes/IVR/AI-robot не менять. Пока full24 выполняется, исходники не меняются; это planned, не implemented/pass. До live проверки source25 UX03 не считать полностью принятым.

## Source27: подтверждённый возврат фокуса

`live-focus-27.json`: supervisor4 foreground actual390×844 and720×450,12Tab/0escapes, Speed auto-scroll, footer426<450, Escape returns exact step; Save disabled/no scenario edits. Default Routes admin5 foreground1280×720: nested Sheet Enter/Escape andfooter close return exact step, parent remains open, text+engine3 retained; draft cancelled, routes0. Backgroundtab17 mixed-state attempt is inconclusive and not acceptance. `StepSheet.focus.test.tsx` uses real shared Sheet/Radix; earlier legacy UI-mock probes are not red evidence. Byte-equal source26 restored before validreal red4, final source27 green7 focus +15legacy +2Campaign=24PASS. Deletedopener fallback andexplicitreturnRef coveredintegration, no runtime entity deletion needed. Source27 changes only2sharededitor files+newtest, no payload/registry/compiler/AI semantics.

## Итог автоматической приёмки source27

`frontend-acceptance-27.json` принят21:44UTC:470files2529tests0skip,12chunks,exit0; все2566файлов снимка, новые frontend-файлы отсутствуют,13CDRr6c+wholecompiler unchanged. Backend25/shared без изменений,4809backend tests PASS/27skipped; lint/types/build27 PASS. Это не полная приёмка PLAN: UX07 возврат после входа не реализован из-за ownership,200%/OSmotion/рабочийSA benchmark не подтверждены. `cleanup-namespace-inventory-27.json`:7собственных контейнеров/0activecalls+channels, inventory-only; окружение сохранено для authgate, финальная очистка не объявлена выполненной. Нового commit/push/release в этом назначении нет.

CDR владелец отдельно принял exact source27 automated gate после чтения обоих receipts и собственной сверки13r6c со снимком и текущими байтами. [Его receipt](../../../../.planning/cdr-reports-ux/SEMANTIC-R6C-FRONTEND27-ACCEPTANCE.json). Это подтверждение его13файлов, не независимый review всего Autodial и не release.

## Current source29 checkpoint 2026-10-19T01:50:56.696365+00:00

Source28 auth live PASS, reduced-motion actual PASS, SA locked availability confirmed. Source29 targeted89 PASS; only helper/test delta after lint fix. Full28 cancelled-not-pass, no receipt can accept it. Sequential required gates29 pending; old source27 full remains historical. Final teardown not yet performed.

## Финальный принятый результат — 2026-10-19T03:27:56.241569+00:00

Реализация завершена; automated-tests-passed / live-verified для доступных сценариев / cleaned. Полная UX-приёмка остаётся частичной: настоящий browser200% недоступен текущему IAB; рабочий SA dashboard недоступен из-за locked лицензии. Не released; новой публикации не было.

Final29 source SHA/deploy/main bundle/live proof recorded above. Complete clean rootfrontend29b is474files2598tests0skip/24chunks; source29 remained unchanged, prior failed/cancelled runs are not acceptance. Rootlint/types/Vite29 exit0,89targeted. Backend25 full4809PASS27skip retained only for unchanged owned backend/shared; parallel initiatives outside scope were not revalidated as current backend. Self-review performed; not independent.

Final cleanup PASS: cleanup-final-29.json removed exact7containers labelledsupervisor-audit=20261018, ownnetwork/exactRedisvolume/root; hosthelpers0, calls/channels0. Foreign container inventory unchanged=True; no sharedimages removed. cleanup-local-29.json stopped exacttracked3helpers and removed exactprivatefixture; userSSHkeys and anonymised evidence retained. cleanup-postcheck-29.json: rootabsent,0owncontainers, SSHalive, local/remote3181+15013closed, privatefixtureabsent. Disposable users4/5/extensions/trunk/queue/providers/bases/campaigns are removed with ownSQLdata; primary and foreign namespace untouched. Own browser logout/tab19closed.

True200% zoom NOTRUN (unsupported current browser control), workingSA-dashboard benchmark NOTRUN (catalog locked for both testroles); CallCenter live comparison and actual system reducedmotion pass remain separate evidence. No request for purchasing/bypassing SA license. No blanket commit/stash/reset/push of the mixed dirty workspace.
