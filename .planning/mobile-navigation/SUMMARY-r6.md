# Промежуточный N14 / r6 — заменён уточнением N15 / r7

Пользовательское задание 2026-10-10; /root, codex-direct, sole writer. Baseline main/7b12985c + неизменённые чужие endpoints/dialplan/tsbuildinfo files. Canonical [PLAN N14](PLAN.md). Исторический [r5 result](SUMMARY-r5.md).

## Реализация

- Expanded sidebar page links и footer «Модули» выровнены слева. Иконки имеют одинаковый X=34px от края sidebar, включая footer. Исправлен унаследованный justify-center от styled links.
- Текстовая footer кнопка «Свернуть» заменена отдельным icon-only ChevronLeft/ChevronRight. Контрол у левого края sidebar, ровно в центре высоты (измерено y=478px при viewport height 900px / topbar 56px). Размер 24x44px, reserved gutter предотвращает перекрытие ссылок; доступное название, keyboard Enter и focus сохранены.
- Новый shared AppBrand переиспользует existing /brand/aipbx-logo.png?v=2. Desktop top-left: logo + AI PBX Krasterisk. При свёрнутом sidebar текст отсутствует, logo получает доступный alt; при раскрытии текст возвращается. Logo остаётся inert branding, прежние route destinations сохраняются.
- Mobile left Sheet header показывает logo и AI PBX Krasterisk; доступный Sheet title «Разделы» сохранён отдельной строкой. На 320px подпись и close button не перекрываются. В закрытой мобильной шапке hamburger сохраняется.
- SCSS/tokens/shared primitives, public API и folder contract соблюдены. Registry/router/storage/backend/assets не менялись, новых зависимостей нет. Поведение expanded section menu N13 сохранено.

## Gates

| Gate | Результат |
|---|---|
| Targeted shell/menu/bottom | PASS: 4 files / 50 tests, targeted-r6.log |
| TypeScript noEmit incremental false | PASS, typescript-r6.log |
| Root lint | PASS: 0 errors; existing warnings 121 backend / 80 frontend, lint-r6.log |
| Full backend | PASS: 388 suites / 3662 tests; existing 1 suite / 11 tests skipped, backend-r6.log |
| Full frontend | PASS: 329 files / 1749 tests, frontend-r6.log; official runner, VITEST_MAX_WORKERS=4 |
| Local Chromium mock API | PASS: 18 сценариев dark/light, browser-r6-report.json |
| Screenshot review | self-reviewed, не independent |
| Real phone / screen reader / human UAT | pending, mocks не заменяют эти gates |
| Release | not-applicable, commit/push/deploy не назначены |

Browser: icon-only control hit target не перекрыт другими элементами; expanded left align и footer icon match; стрелка на левом краю и vertical midpoint; actual logo image loaded; compact/full brand switch и persistence after reload; expanded layouts 768/820/1024/1280px без document overflow; mobile branding/close/focus 320/390px, light/dark. Первоначально browser check выявил разницу footer icon на 1px из-за border; исправлена компенсация padding, повторный browser PASS. Targeted/type unaffected; full suite выполняется с финальными TSX и текущими SCSS.

[Browser report](browser-r6-report.json), [script](browser-r6-check.cjs), [log](browser-r6.log), [desktop dark](r6-desktop-dark-1280.png), [compact](r6-compact-dark-1280.png), [mobile light 320px](r6-mobile-light-320.png).

## Handoff

N14 intermediate implemented, automated/local-browser gates PASS; решения заменены последующим пользовательским N15. /root sole writer, новые tasks не назначены. Baseline foreign checksums: baseline-r6.json. Пользовательские servers не трогались; временный Vite 3017 остановлен после browser checks. Внешние phone/screen-reader/UAT остаются pending; не требуется новый execution workflow или повтор предыдущих фаз.

Решения N14 о левой стрелке/плоском sidebar заменены текущим пользовательским N15. Этот файл — historical intermediate evidence; текущий scope и результаты см. SUMMARY/PLAN N15.
