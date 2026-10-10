# Проверка унификации модалок

Дата: 2026-10-10. План: [PLAN r1](PLAN.md). Координатор: `/root`, mode `codex-direct`, один writer, без агентов.

## Реализовано

- Общий публичный FSD API: FormDialogContent / FormSheetContent, ModalBody, ModalSection, ModalTabs, ModalToggle. Геометрия и поверхности находятся в shared SCSS, а черновик, валидация и mutation остаются в фиче.
- Основные формы абонентов, транков, пользователей, IVR, очередей, контекстов и маршрутов используют общую оболочку. Поля разделены на смысловые карточки; адаптивные ряды и явно заданный stretch предотвращают центрирование.
- Остальные каталоги, шаблоны, аудиофайлы, autodial, cloud admin, колл-центр и аналитика получили общие оболочки/поверхности. Компактные подтверждения и специализированные viewers сохраняют свой сценарий. Нет искусственных вкладок в небольших формах.
- Переключатели заменяют булевые настройки; checkbox сохранён для выбора списка, прав и подтверждений. На основном табе маршрута Active является Switch. Статусы Dialplan объединены в одну Info с tooltip; его клик не открывает StepSheet.
- Транки и очереди перенесены с raw Radix на shared UI. AiAgentModal и TenantDrawer перенесены с собственной overlay-разметки на общую инфраструктуру.
- В формах контакта, прав оператора и загрузки аналитики footer отделён от прокрутки. Расписание отчёта разделено на параметры, время, фильтры и доставку. Создание токенов и вложенные редакторы аналитики оформлены общими секциями.
- Новые подписи/ошибки имеют RU/EN-ключи. Системные alert и сырые API-ошибки в проверенных редакторах заменены локализованными сообщениями; неуспешное сохранение сохраняет черновик.
- Согласованы frontend архитектура и backend §10. Пример использует фактический shared API; shell SCSS не предлагается копировать в фичи. Проверены 7 локальных ссылок backend-памятки.

## Покрытие

[INVENTORY](INVENTORY.json): 94 файла, 63 implemented, 30 covered общей Dialog/Sheet-поверхностью с существующим специализированным/компактным сценарием, 1 not-applicable (немодальная AssistantPanel).

`node .planning/modal-ui-standardization/audit-modals.cjs`: PASS. Feature-level raw Radix: 0; прямые title-дубли на tooltip trigger: 0; native alert в инвентаре: 0. Это воспроизводимый source-аудит, не доказательство визуальной корректности. Дополнительно проверено совпадение всех 13 новых RU/EN-ключей namespace modal.

Рефакторинг не является полной очисткой всего legacy JSX по FSD. Массовый codemod HTML/utility-классов не выполнялся после отклонения автоматической проверкой. Применялись ограниченные изменения проверенных форм. API, backend runtime, migrations, production, соседние планы и dirty baseline helpers/tests не изменялись.

## Gates

| Проверка | Статус | Evidence |
|---|---|---|
| Root lint | PASS | `npm run lint`, backend 121 warnings / frontend 82 warnings; 0 errors. Дополнительный frontend lint на окончательном коде PASS, 82 warnings / 0 errors |
| Backend tests | PASS | `npm run test:backend`: 388 suites / 3662 tests passed; 1 suite / 11 tests skipped. Backend runtime не менялся после проверки |
| Frontend types + production build | PASS | `npm run build --workspace=@krasterisk/frontend`: tsc -b и Vite/SCSS exit 0. Есть предупреждения о размере чанков и циклических DataTable re-export |
| Targeted latest UI slice | PASS | 7 files / 53 tests: contacts, queue, notifications, analytics projects, tenant drawer, dial modification, real shared ModalLayout |
| Full frontend | PASS | `npm run test:frontend`: 324 files / 1705 tests passed, 9/9 chunks, exit 0. Final log: `%TEMP%/krasterisk-modal-tests-final.log` |
| Diff whitespace | PASS | `git -c core.safecrlf=false diff --check` |
| Visual/browser | TOOL-UNAVAILABLE | CUA и node_repl не инициализировались из-за Windows sandbox helper. Нет screenshot/manual browser evidence |
| Release/deploy | NOT-APPLICABLE | Пользователь поручил локальный UI-рефакторинг |

Регрессии, покрытые тестами: отдельный scrolling body и footer/title, связанный label Switch, сохранение parent draft при смене вкладки и сворачивании секции, отсутствие implicit submit, сохранение payload/draft существующих create/edit/copy форм, единая информация о шаге без открытия editor. Проверки DOM не подтверждают фактические размеры viewport.

Ранние прогоны с неверным Sheet import и устаревшим SoftphoneContacts mock не считаются финальным evidence. Импорт и mock исправлены; targeted retry 53 tests PASS; полный чистый прогон завершён: 324 files / 1705 tests PASS.

## Следующее действие

Код реализован, обязательные автоматические gates завершены. Живую визуальную проверку выполнить, когда восстановится browser tool; проверить RU/EN, небольшую ширину/высоту, длинные поля, ошибку и раскрытые optional карточки.
