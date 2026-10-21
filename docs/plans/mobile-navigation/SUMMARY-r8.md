# N16 / r8 — нижнее меню мобильной навигации

2026-10-10; /root sole coordinator/executor, codex-direct. Baseline main/7b12985c + N14/N15 and foreign dirty changes. Previous sidebar result retained in [SUMMARY-r7](SUMMARY-r7.md).

## Реализация

- Bottom Sheet heading содержит только имя раздела. Начальный фокус на noninteractive heading, без обводки Close; Tab/Escape/focus return сохранены. Shared Sheet не изменён.
- Selected page centers within available page strip on route changes, resize and repeated selection from bottom Sheet or bar. CSS edge space permits first/last centering; single page is centered without horizontal overflow. No document scrollIntoView side effects.
- Native touch scroll, mouse drag, modified/keyboard links retained. Right overflow hint measures the last actual page, not blank edge spacing.
- Owned files: MobileBottomBar/MobilePageMenu TSX, SCSS and tests; architecture navigation paragraph and own planning docs/index/registry. Foreign endpoints/dialplan/tsbuildinfo SHA-256 matches all ten baseline-r6.json entries.

## Evidence

| Gate | Status / evidence |
|---|---|
| Implementation | implemented |
| Targeted | PASS 2 files / 20 tests, targeted-r8.log |
| Root lint | PASS exit 0; existing 121 backend / 80 frontend warnings |
| TypeScript | PASS exit 0, noEmit --incremental false; typescript-r8.log |
| Full frontend | PASS exit 0, 330 files / 1757 tests; frontend-r8.log; official Windows runner workers=4, chunk=80 |
| Full backend | PASS exit 0, 388 suites / 3662 tests; existing 1 suite / 11 tests skipped; backend-r8.log |
| Local Chromium, mocked API | PASS 30 checks; browser-r8-report.json / browser-r8.log / browser-r8-check.cjs |
| Screenshots | self-reviewed r8-single-dark-320.png and r8-menu-light.png; both themes retained |
| Human/device/screen reader/live authenticated API | pending external, not replaced by mocks |
| Release | not-applicable; commit/push/deploy not assigned |

Browser matrix: 320/390px, dark/light; first/last/middle/single, same-route reselection, viewport resize, real CDP touch swipe, heading-only title, heading initial focus, Tab to first link, Escape/trigger return, no document horizontal overflow. Report errors=[]; desktop/sidebar revision remains N15.

## Handoff

Next action: external real-device/screen-reader/human UAT when devices/participants are available; no further functional work assigned. Coordination idle; N16 implementation/automated/local-browser gates complete. No delegated writers. Self-review is not independent review. Temporary Vite 3017 stopped after browser verification; user dev servers untouched. Adjacent phases/root STATE/ROADMAP unchanged.
