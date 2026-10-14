# U7: IVR UI, 2026-10-13

Coordinator /root, codex-direct, sole writer. PLAN revision 2026-10-13-r2, U7. No agents, commit, deploy, backend/API/DB changes. Baseline HEAD 7263d4996928bb58bc4b21f9b45995374725b805; unrelated dirty files preserved, including IvrsTable.

## Реализовано

- FormDialogContent/ModalTabs/ModalBody/ModalSection: единый каркас и отступы, Active Switch в шапке параметров, адаптивная сетка таймаутов, отдельная секция донабора.
- Пункты меню и фразы: сворачиваемые карточки, целый заголовок переключает раскрытие; удаление/прослушивание отделены от toggle. Новые пункты открываются. Исправлен индекс открытого пункта при удалении предыдущего.
- Перетаскивание фраз вынесено в shared SortableRegion с pointer/keyboard sensors; черновик и идентичность фраз сохраняются после перестановки. TTS/text/settings/audio функции сохранены.
- Схема: только FlowchartCanvas; DryRunForm, подсветка результата проверки и служебные баннеры удалены. Параметры диаграммы не изменены.
- Где используется: существующий UsageTab оформлен секцией; передаются kind=ivr и uid текущего IVR. Вкладка доступна только для сохранённого IVR в edit; create/copy не показывают ссылки оригинала.
- RU/EN: 8 новых ivrs.editor ключей, одинаковые наборы. Используется существующий references.tab.
- Save: локализованная ошибка, сохранение черновика, busy/inert и защита от повторного Save. Проверка пустого имени/невалидных TTS доступна по нажатию Save с переходом на нужную вкладку.

## Gates

| Gate | Status | Evidence |
| --- | --- | --- |
| root npm run lint | PASS | exit 0, backend 123/frontend 111 warnings, 0 errors |
| final targeted lint | PASS | exit 0, 0 warnings/errors, после корректировки эффекта phraseCount |
| npm run test:backend | PASS | exit 0, 414 suites / 4010 tests passed, 1 suite / 11 tests skipped; teardown warning |
| frontend types | PASS | npx tsc -b, exit 0; финальная incremental проверка также exit 0 |
| frontend build | PASS | npm run build --workspace=@krasterisk/frontend, exit 0; 4707 modules, Vite/SCSS compile; chunk-size/dynamic-import warnings |
| npm run test:frontend | PASS | exit 0, 348 files / 1942 tests, 9 batches, VITEST_MAX_WORKERS=2 |
| targeted IVR+Usage tests | PASS in final full run | IVR+Usage включены в полный успешный прогон; первоначально 27/28, затем исправлен тест удаления, который ошибочно считал option в селекте карточкой |
| static/source review | PASS | feature layout на shared UI/Stack, DnD DOM/styles в shared, Schema без DryRun; RU/EN keys equal; scoped git diff --check exit 0 |
| browser/mobile visual | tool-unavailable | две инициализации CUA timeout/kernel reset; нет screenshot/DOM/live-verified evidence |
| release/deploy | not-applicable | не входит в поручение |

Журналы текущей сессии: Windows TEMP/krasterisk-ivr-ui-{lint,final-lint,backend,frontend,build,types,final-types,regression}.log. Автотесты не являются живой визуальной проверкой. Shared callback перестановки покрыт тестом сохранения идентичности; настоящий drag в браузере не заявляется.

## Handoff

U7.1–U7.4 implemented / automated-tests-passed. Активных writers и незавершённых code/automated gates нет. После восстановления браузерного инструмента: визуальная проверка RU/EN, mobile/длинных заголовков, раскрытия/удаления/drag/playback и вкладки Где используется. Не возобновлять соседние инициативы.

Frontend full содержит существующие stderr warnings (act/key/i18next/jsdom navigation), без проваленных тестов. Build проверил итоговые SCSS и shared UI; после эквивалентной правки зависимости эффекта phraseCount прошли final types/lint/full frontend. Визуальная приёмка не заявляется.
