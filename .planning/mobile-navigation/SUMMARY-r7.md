# Навбар — N15 / r7

Последнее уточнение пользователя во время N14: правая стрелка, изменение ширины мышью, общий раскрывающийся список разделов/подразделов, удаление цепочки после логотипа. /root sole coordinator/writer, codex-direct; baseline main/7b12985c + preserved foreign endpoints/dialplan/tsbuildinfo diff. [Canonical PLAN](PLAN.md). N14 intermediate [r6](SUMMARY-r6.md); previous [r5](SUMMARY-r5.md).

## Конечное поведение

- Collapse/expand — одиночный ChevronLeft/ChevronRight по центру высоты у правой границы. Кнопка расположена на границе панели, иконка доступна с клавиатуры и имеет имя состояния; текстовой footer кнопки нет.
- Правая граница sidebar — mouse resize handle. Диапазон 200px..min(480px, viewport/2); default 240px. Отдельное persisted preference для ширины, collapse preference не заменяется. При уменьшении viewport применяется временный clamp, saved width восстанавливается при расширении. Compact rail 64px.
- Keyboard separator: ArrowLeft/Right ±16px, Home/End min/max. Pointer capture, primary mouse only; исключены touch/secondary-button drag. Pointer cancel/lost capture/window blur откатывают незавершённую ширину; mouse-up сохраняет. Body cursor/userSelect восстанавливаются после завершения/отмены/unmount, storage denial безопасно остаётся memory-only.
- Общий ModuleNavigation применяется в desktop sidebar и мобильном Sheet. Независимые раскрывающиеся разделы со всеми разрешёнными страницами; current section открыт при первом показе, новые маршруты раскрывают свой раздел. Разрешённые страницы и статусы берутся из итогового catalog/RBAC data, active most-specific page единая. Недоступные строки ведут к своему Hub entry, без обхода license.
- В compact rail нажатие на раздел раскрывает sidebar и нужный список. «Модули» — последний footer пункт desktop / последний пункт mobile. Native page links сохранены.
- Header section/page breadcrumbs/switchers полностью удалены. После logo нет навигационной цепочки. В desktop sidebar теперь есть глобальный доступ к разделам также на Hub/dashboard/profile, поскольку header switchers удалены. Global search и действия header сохранены.
- Existing logo + AI PBX Krasterisk сохранены из N14; compact desktop — только logo, mobile Sheet — полный brand. Navbar labels выровнены слева, длинные названия переносятся. Без новых packages/backend/router/contracts.

## Gates

| Gate | Результат |
|---|---|
| Targeted tree/shell/phone/bottom/resize | PASS: initial 5 files / 56 tests; final 6 files / 116 tests including AssistantPanel, targeted-r7-final.log |
| TypeScript noEmit incremental false | PASS after final root-width change, typescript-r7-final.log |
| npm run lint | PASS: 0 errors; existing backend 121 / frontend 80 warnings, lint-r7.log; final changed-scope lint PASS lint-r7-final.log |
| npm run test:frontend | PASS: 330 files / 1755 tests, exit 0, frontend-r7-final.log; official runner maxWorkers=4 / chunk=80 |
| npm run test:backend | PASS: 388 suites / 3662 tests, existing 1 suite / 11 tests skipped; backend-r6.log из текущей сессии. С N14 backend не менялся, после frontend-only уточнения повтор не требовался |
| Local Chromium / mocked API | PASS: 30 checks, browser-r7-report.json |
| Screenshots | self-reviewed; не independent review |
| Real phone / screen reader / human UAT | pending, local mocks их не заменяют |
| Release | not-applicable, commit/push/deploy не назначены |

Browser dark/light: current nested STT match; independent section expansion without navigation; right-edge midpoint/hit target; actual mouse drag 240→340 with persisted reload; min/max; blur rollback; keyboard resize; compact section expansion; viewport clamp 1024/820/768 preserving 480px preference; real page/Hub/profile global sidebar; mobile 390/320 shared-tree/current page/brand/Escape/focus/no search/Hub last. Initial checker исправлен для учёта 1px sidebar border и ожидания React/lazy-route commit после URL update; Первый полный frontend run выявил несовместимость с existing CSS-variable contract в AssistantPanel test. Width hook/expanded-width CSS variable перенесены в ModuleShell root, shared sidebar variable снова имеет единый root normal/collapsed контракт. Финальные targeted/type/lint и 30 browser checks PASS, Повторный официальный full frontend run завершён exit 0, все 330 файлов/1755 тестов PASS. Первый failed run сохранён в frontend-r7.log; его ошибка не скрывается и не используется как pass.

[Report](browser-r7-report.json), [script](browser-r7-check.cjs), [final log](browser-r7-final.log), [desktop dark 480px](r7-desktop-dark-480.png), [desktop light](r7-desktop-light-480.png), [mobile dark 320px](r7-mobile-dark-320.png).

## Handoff

N15 implemented / automated-tests-passed / local-browser-verified (mock API). Coordination idle, текущая реализация и автоматические проверки завершены. Next action: только real-device/screen-reader/human UAT при предоставлении устройств/участников; новые functional assignments требуют сверки baseline/ownership. Временный Vite 3017 остановлен после browser checks; пользовательские servers не трогались. Foreign checksums совпадают с baseline-r6.json. N14 stale choices заменены N15; root STATE/ROADMAP/соседние инициативы не изменялись. Real-device/screen-reader/UAT остаются внешними pending gates.
