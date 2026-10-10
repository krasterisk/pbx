# Результат рефакторинга навигации r4

Дата: 2026-10-10. Plan: [PLAN](PLAN.md), 2026-10-10-r4, N5-N12. Coordinator/executor: /root, codex-direct. Code review выполнен координатором, не независимый. Read-only review планирования был отдельным; он не является code review.

## Реализованное поведение

- N5: единый most-specific page matcher в features/modules/lib/navigation; существующий moduleRegistry использует его. Sidebar, верхний переключатель и bottom bar согласованы на вложенных маршрутах. Hub/служебные URL не превращаются в Dashboard. useHubModules отдаёт canonical navigation order до Hub favorite sorting.
- N6: палитра имеет видимую шапку, доступное имя, combobox/listbox/option API, синхронизированный active descendant, видимый выбранный результат и устойчивость к сокращению/очистке выдачи. Keyboard wrap/Enter/Escape, реальные Dialog trap/restore проверены браузером. Icon actions именованы, закрытие палитры/Sheet 44px.
- N7: нижнее название раздела открывает bottom Sheet всех разрешённых страниц с полными названиями. 0/1/12 pages покрыты интеграционными тестами. Route links имеют href/anchor refs, поддерживают Ctrl/Cmd/middle click; primary mouse drag не активируется модифицированным кликом, release click подавляется, pointercancel сбрасывает drag. Touch scroll, fine-pointer scrollbar, overflow edge, 60px/safe-area сохранены. Верхний left Sheet без поиска, Modules последние.
- N8: глобальный индекс всех доступных страниц из любого раздела с section context и aliases. Дедупликация не скрывает название первой страницы («Абоненты» / «PBX»). Hub также доступен из поиска и последним пунктом desktop switcher, в том числе когда sidebar отсутствует.
- N9: canonical order не меняется от Hub favorites. Недоступные разделы имеют текстовые locked/disabled статусы и адрес /modules?module=known-code. Hub валидирует code по видимым строкам, выделяет/показывает/фокусирует нужную карточку после загрузки; позднее действие пользователя не перехватывается. Checkout/enable не запускаются. Favorite toggle находится рядом с route link, а не внутри неё.
- N10: один observer в shell, только canonical page IDs/paths, без entity URLs/query/hash/форм. Storage versioned и scoped user+tenant, impersonation отдельно; при неполной identity или storage denial используется память. Restore проверяет текущие license/visibility/RBAC/page ownership и fallback. Прямые URL/history/role-start не заменяются.
- N11: phone <768px; tablet 768-1023px rail 64px по умолчанию, desktop >=1024px sidebar 240px; явное preference имеет приоритет, resize его не перезаписывает. На мобильном язык/тема перенесены в профиль, глобальный поиск получил самостоятельную кнопку. Логика auth/impersonation согласуется в widget shell; feature history получает tenant context параметром.

Новые UI-компоненты имеют собственные папки/Public API/SCSS. Widgets используют shared NavItem/Button/Text/Flex, токены и общие z-index; новых зависимостей/cmdk нет. Frontend ARCHITECTURE обновлена принятыми navigation contracts. Backend/API/router/native packaging не менялись.

## Решения и ограничения UX

- Принята tablet rail: освобождает 176px относительно sidebar 240px; проверены 768/820px и сохранение ручного expansion при resize. Числа следуют измеренному/заданному layout, не являются исследованием скорости работы пользователей.
- Приняты отдельный mobile search и preferences в профиле: сокращают постоянные controls и сохраняют прямой вход в поиск. Для all-pages используется section-name button с ChevronDown, без дополнительного занятого слота.
- Группа названа «Недоступные разделы», поскольку disabled может быть и базовый PBX/System; статус «Не подключён» относится к locked.
- Active text/markers и status badges используют foreground для читаемости в обеих темах. Search labels/context переносятся на 320px; input 16px, options/close targets >=44px.
- UX-гипотезы (restore, порядок, rail, перенос controls) ещё требуют проверки с людьми. Реальные участники/телефон/скринридер не предоставлены; эффективность не выдаётся за измеренную.

## Gates и фактические команды

| Gate | Результат |
|---|---|
| Targeted navigation | PASS: 20 файлов / 118 тестов, targeted-r4-final.log |
| Последние UI изменения и Hub regression | PASS: 2 файла / 29 тестов, last-ui-r4.log; покрывает добавленный после broad suite тест Hub без sidebar |
| npm run lint | PASS, exit 0; 0 errors, существующие warnings: backend 121, frontend 80 |
| Frontend TypeScript | PASS, tsc --noEmit --incremental false; tsbuildinfo baseline не переписывался |
| npm run test:backend | PASS: 388 suites / 3662 tests; существующие 1 suite / 11 tests skipped |
| npm run test:frontend | PASS: official runner, 329 files / 1742 tests, exit 0; VITEST_MAX_WORKERS=2 |
| Browser основной | PASS: 28 сценариев, mocked API; 320/360/390/640/767/768/820/1024/1280px, longest route, 27-result palette, aliases, restore, links/new tab, drag/touch, focus/resize cleanup, Hub target (cold+warm), profile theme |
| Browser длинный индекс / обе темы | PASS: 320px, 43 результатов, без horizontal overflow, выбранный option виден, close 44px; active label contrast dark 10.07:1 / light 17.48:1 |
| Visual self-review | PASS: новые sections/all-pages/mobile light/tablet screenshots просмотрены; не independent review |
| Real phone/native WebView, screen reader, human UX-UAT, live authenticated backend | PENDING; local Chromium/API mocks их не заменяют |
| Full WCAG certification / release | Not claimed / not-applicable к текущему scope |

Команды обязательных checks: npm run lint; npm run test:backend; npm run test:frontend; node node_modules/typescript/bin/tsc --noEmit --incremental false -p packages/frontend/tsconfig.json. На Windows использовался npm.cmd. После небольших последних UI правок повторены lint/type и целевые 29 tests; повторный broad suite не требовался для всего доменного кода.

Промежуточный full frontend запуск остановлен после добавления отдельного MobilePageMenu test file и перезапущен с новым списком 329 файлов; промежуточный лог сохранён отдельно. Browser выявил схлопывание списка bottom Sheet из-за flex-basis:0 в auto-height container; исправлено flex-basis:auto и проверено обычным кликом. Дополнительный fixture сначала перехватывал Vite /src/shared/api imports; после ограничения mock реальными /api/ путями проверка прошла. Это не ошибка приложения.

## Evidence

- [Основной browser report](browser-r4-report.json), [script](browser-r4-check.cjs), [log](browser-r4-final.log).
- [Обе темы / длинный индекс](browser-r4-extra-report.json), [script](browser-r4-extra.cjs), [log](browser-r4-extra.log).
- [Все страницы 390px](r4-all-pages-390.png), [разделы 390px](r4-sections-390.png), [mobile light](r4-mobile-light-390.png), [tablet 820px](r4-tablet-820.png).
- Logs: targeted-r4-final.log, last-ui-r4.log, lint-r4-final.log, typescript-r4-final.log, backend-r4.log, frontend-r4.log. Исторический [r3 summary](SUMMARY-r3.md) и старые browser/log artifacts сохранены.

## Handoff

N5-N11 implemented; N12 automated/local-browser subset accepted. Next action: на реальном устройстве/скринридере проверить focus/keyboard/landscape/safe areas/zoom, с администратором и оператором — найти последнюю страницу без подсказки, перейти/вернуться в раздел, найти чужую страницу поиском, понять unavailable module. Записать outcome/time/errors; отдельно проверить активный conference overlay/экранную клавиатуру на реальном устройстве. Полную WCAG/реальную скорость пользователя пока не подтверждать.

Baseline main/6fa6c41904497046a510ad9969f3d36e9cdd067a + сохранённый незакоммиченный r3. Чужие endpoints/dialplan/tsbuildinfo изменения не правились/не откатывались. Commit/push/deploy не назначены. Временный Vite 3017 остановлен после проверки; серверы пользователя 3010/backend не трогались.
