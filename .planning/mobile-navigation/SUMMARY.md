# Левое меню с подразделами — r5 / N13

Пользовательский запрос: в левом Sheet показывать не только названия разделов, но и все подразделы. Coordinator/executor /root, codex-direct, один writer. [Canonical PLAN N13](PLAN.md); baseline main/e5a1e202. Результаты r4 сохранены в [SUMMARY-r4](SUMMARY-r4.md).

## Изменения

- Активный раздел — кнопка раскрытия с ChevronDown, aria-expanded/controls. Нажатие не меняет маршрут и не закрывает Sheet. Можно раскрывать несколько разделов независимо.
- Текущий раздел раскрывается при каждом открытии. На вложенном URL отмечается ровно одна most-specific текущая страница.
- Все разрешённые страницы берутся из итогового catalog/RBAC списка. Страницы — NavItem links с полными названиями и иконками; переход непосредственно на выбранную страницу, без промежуточной первой страницы раздела.
- Обычный переход закрывает Sheet, Ctrl/Cmd/middle-click сохраняют native semantics. Enter/Space переключают раскрытие, скрытые страницы исключены из focus/a11y tree. Escape закрывает и возвращает фокус на hamburger.
- Catalog order и статусы недоступных модулей сохранены. Locked/disabled ведут к своему Hub entry и не раскрывают запрещённые страницы. «Модули» — последний пункт.
- Весь длинный список прокручивается внутри Sheet; горизонтального переполнения нет. Shared primitives, SCSS/tokens, own folder/API сохранены, новых зависимостей нет.

## Проверки r5

| Gate | Результат |
|---|---|
| Menu/shell/bottom targeted | PASS: 4 файла / 50 тестов, targeted-r5.log |
| TypeScript noEmit / incremental false | PASS, typescript-r5.log |
| npm run lint | PASS: 0 errors; baseline warnings backend 121 / frontend 80, lint-r5.log |
| npm run test:backend | PASS: 388 suites / 3662 tests; 1 suite / 11 tests skipped, backend-r5.log |
| npm run test:frontend | PASS: 329 файлов / 1749 тестов, frontend-r5.log; official Windows runner, VITEST_MAX_WORKERS=2 |
| Local Chromium, mock API | PASS: 18 сценариев, 320/390/767px, dark/light, browser-r5-report.json |
| Визуальное чтение screenshots | PASS координатором; не independent review |
| Реальный телефон / screen reader | pending; локальный Chromium их не заменяет |
| Release | not-applicable: commit/push/deploy не назначены |

Browser: раскрытие без navigation; независимые списки; nested active page; native Ctrl/new tab; выбор не первой страницы; закрытие и новое раскрытие; keyboard/hidden/Escape/focus; 44px row targets; список высотой 2564px доступен через локальный scroll; Modules last; unavailable route без прямых страниц. [Report](browser-r5-report.json), [script](browser-r5-check.cjs), [dark](r5-expanded-dark-390.png), [light](r5-expanded-light-390.png).

Во время подготовки browser fixture исправлен selector списка: не обходить изменяющийся filtered locator по nth после раскрытия. Это дефект проверочного script, приложение не менялось после targeted/type/lint запуска.

## Handoff

N13 implemented / automated-tests-passed / local-browser-verified (mock API). Все назначенные автоматические проверки завершены, coordination idle. Next action: только внешний real-device/screen-reader/UAT gate при предоставлении соответствующих устройств/участников; повторять автоматические проверки без новых изменений не требуется. Исторические human/device/UAT ограничения r4 остаются pending. Чужие endpoints/dialplan/tsbuildinfo файлы не правились; сверка SHA-256 с baseline-r5.json — pass. Пользовательские серверы не трогались; временный Vite 3017 остановлен после browser verification.
