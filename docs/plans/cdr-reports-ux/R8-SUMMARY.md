# CDR R8: результат и проверка

Assignment: PLAN R8 revision1, 2026-10-22, coordinator /root chat01a161fb-89f8-7392-9f11-9f7177fa25b5, codex-direct, sole writer. Baseline main b03e97cf79ce19efac0f3cc05a48e98901ca2590. Existing dirty build metadata and unrelated untracked files preserved. No commits, migrations, deployment, provider calls, phone calls or message delivery performed.

## Выполнение запроса

| Пункты | Изменения |
|---|---|
| 1–3 | Навигация «Звонки», reset только при установленных условиях, календарная иконка закреплена справа |
| 4 | Подтверждённые BUSY / NO ANSWER / прочие неуспешные соединения показываются как «Занят» / «Нет ответа» / «Недоступен». Человек/робот/меню/голосовое/активный звонок остаются отдельными исходами; промежуточная неудачная нога не отменяет подтверждённый ответ |
| 5 | Личные сохранённые выборки сохраняют все новые условия и относительный период; исправлена доступность для реальной коробочной организации0. Ключ разделяет tenant и пользователя. Хранилище локальное, не серверное |
| 6–8 | Мультивыбор направлений и обработки, исторический фильтр транков, до30 полных номеров с выбором стороны. OR внутри группы, AND между группами. Направления в фильтре явно названы внешними входящими/исходящими |
| 9 | Явная настройка IANA-пояса организации администратором через существующий tenants.timezone. Все CDR-периоды, обзор, перезвоны и экспорт читают один resolver. CSV выводит локальное время вместо ISO UTC. Исходная временная зона legacy CDR не меняется |
| 10–11 | В строке запись открывается с autoplay и контролами, расшифровка открывает материалы сразу; голосовая почта сохраняет отдельное действие. Расшифровка расположена перед длинным анализом. Схема маршрута стала отдельной горизонтальной компоновкой с соединителями, хронология остаётся вертикальной |
| 12–13 | Раздел называется «Пропущенные и перезвоны». CSV/XLSX экспортируется по всей разрешённой выборке, включая закрытые случаи при выбранном режиме, а не только по первым20 строкам. Сохраняются ограничения31день/10000 исходных звонков, tenant/ACL, отметки неполноты и scope. PDF обзора включает KPI, автоматизацию и интервальную таблицу с диаграммами; кириллица локальная, переносы страниц проверены |
| 14–16 | Переключатель графики/таблицы, круговая диаграмма исходов, интервальные столбцы с drill-down без расширения cohort. Подсказки в InfoTooltip, shared-обёртки графиков/аудио/meter, Stack вместо нативной раскладки в новом CDR, SCSS/tokens, удалены длинные тире в CDR-текстах |
| 17 | Входящие, принятые роботами, и доля итоговой роботизированной обработки среди принятых человеком/роботом. Участие робота в середине цепочки не выдаётся за полную автоматизацию |

Рассылка: [исследование и предложение](R8-RESEARCH.md). Предлагается общий delivery pipeline КЦ с новыми источниками CDR, серверной сохранённой выборкой, IANA-расписанием, lease/идемпотентностью и проверкой текущих прав перед каждой отправкой. Автоматическая рассылка не включалась; пользователь запросил её исследование и предложение.

## Эксплуатационные условия

Версия call facts увеличена2→3: добавлены наблюдавшиеся tenant-bound trunk endpoints и нормализованный результат соединения. После установки кода штатный projection worker под существующим lease заново заполнит витрину; сырые CDR/CEL и результаты SA не переписываются. До завершения checkpoint-v3 интерфейс показывает неполную историю. Запросы отчёта не сканируют сырой CDR. Неизвестные legacy trunk channel names не угадываются: поддерживается канонический SIP/PJSIP t_*_<tenant> endpoint. Новая миграция не требуется.

Настройка пояса сохраняет существующую конфигурацию: автоматически заменять UTC на пояс разработчика нельзя. Администратор выбирает нужный пояс в «Часовой пояс организации». В API/хранении абсолютных моментов UTC остаётся корректным внутренним представлением. Изменение отображения не меняет PBX_CDR_TIMEZONE, время Asterisk или правила маршрутизации. Найденное отличие resolver time-groups описано в исследовании, соседняя подсистема в scope не изменялась.

## Проверки

External ARTIFACTS_ROOT: `C:/Users/Professional/.codex/visualizations/2026/10/22/01a161fb-89f8-7392-9f11-9f7177fa25b5/artifacts`.
Run locator: `runs/cdr-reports-ux/r8-20261022/`, через tools/artifacts/paths.cjs.

- `npm run test:backend`: final509 passed suites,5027 passed tests,27 conditional skips; exit0 (`backend-tests-final.log`). This is automated evidence, not live provider/SQL acceptance.
- Targeted backend6suites66tests passed before the final3 raw terminal-disposition cases; those cases are included in the full final suite.
- Frontend full file coverage:484 files/2644 tests. Sequential chunks1–4 covered320 files (390+461+468+551 tests); only the stale CallTranscript em-dash assertion failed. The exact owned sequential runner was stopped after chunk4 to avoid duplicating work. Remaining164 files ran with explicit sorted arguments, `--pool=forks --maxWorkers=4 --fileParallelism --reporter=dot` and found one stale MultiSelect aria-label em-dash assertion. Both expectations were updated to the requested hyphen convention. Final corrective5files/12tests pass (`frontend-correction-final.log`); all remaining cases passed in the broad runs. The interrupted root command and earlier failed receipts are retained, not described as exit0. Full file coverage + corrective reruns is PASS; there was no second uninterrupted root exit0 run.
- `npm run lint`: final pass,0 errors, existing123 backend/101 frontend warnings (`lint-final.log`).
- Frontend `tsc --noEmit --incremental false`: final pass (`frontend-types-final.log`).
- Backend `tsc -p tsconfig.build.json --outDir <external>/backend-dist`: final pass (`backend-build.log`).
- Frontend Vite production build: final pass after the dark-tooltip correction (`frontend-build-final.log`,2m51s). Existing chunk-size warnings retained.
- Actual PDF generated from the new renderer on synthetic data,2 A4 pages rendered with Poppler and visually inspected. Pagination cell alignment repaired; both final pages have aligned columns, readable Cyrillic and numbered footer (`overview-synthetic.pdf`, `overview-page-1.png`, `overview-page-2.png`). This is a test sample, not a customer export.
- Authenticated existing localhost3010 UI: journal/reset/save availability, date alignment, advanced filters and charts observed at600px and1440px. Source UI is current through HMR, but existing backend5010 was not restarted: new endpoint/trunk backfill/network audio acceptance is not claimed. Existing live R7 acceptance is retained separately, not relabelled as R8 evidence.

User correction: DashboardChart and DistributionChart tooltip labels and values now explicitly use the shared foreground token. Actual dark browser tooltip observed through keyboard navigation: text rgb(219,219,219), card rgb(21,28,31); screenshot `tooltip-dark.png`.

Source freeze:55 product source/test files, SHA-256 in `source-freeze.json`. Final checks completed, source hash comparison unchanged. Status implemented / automated-tests-passed / bounded frontend-live-verified; new backend HTTP/trunk replay/audio acceptance pending against an updated backend. No release or independent review claimed. Next action for runtime acceptance: rebuild/restart the local backend with these sources, verify new timezone/export endpoints and projection-v3 completion on an authorized dataset; no production deployment assigned.
