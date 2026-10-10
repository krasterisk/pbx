# N17 / r9 — устойчивый список страниц мобильной навигации

Started 2026-10-10, completed 2026-10-11; /root sole coordinator/executor, codex-direct. Baseline main/7b12985c + N14-N16 and foreign endpoints/dialplan/tsbuildinfo diff. [SUMMARY-r8](SUMMARY-r8.md) archived. N16 compulsory exact centering explicitly superseded by this user request.

## Анализ и выбранный подход

Причина визуального дефекта r8: полуширинные псевдоэлементы создавали искусственные пустые зоны у концов списка; каждое переключение переустанавливало центр, CSS snap двигал список после ручного свайпа. Математический центр не обеспечивал устойчивое положение соседних кнопок.

| Primary reference | Observed approach | Adaptation |
|---|---|---|
| [MUI Tabs docs](https://mui.com/material-ui/react-tabs/) and [source scrollSelectedIntoView](https://github.com/mui/material-ui/blob/master/packages/mui-material/src/Tabs/Tabs.js) | Fixed vs scrollable; consistent placement, reveal only when selected item is clipped | Minimal bounded reveal; visible selection does not shift neighbors; oversized link leading alignment avoids oscillation |
| [Material Android TabLayout source](https://github.com/material-components/material-components-android/blob/master/lib/java/com/google/android/material/tabs/TabLayout.java), MODE_AUTO and calculateScrollXForTab | Center fitting group / switch to scrolling when it outgrows width; selected centering is an alternative strategy within natural scroll view | Center fitting group including single page; no physical half-width edge spacers |

This is a project-specific choice, not a claim that all systems follow one universal rule. The bottom strip contains section route links; preserve native NavItem semantics rather than introducing tab/tabpanel roles or UI dependencies. No human performance improvement measured yet.

## Реализация

- Short list centers as a whole using auto margins, including one page. Overflowing list starts at natural leading edge with normal 4px spacing.
- Selection/resize/reselection reveals only a clipped link with bounded minimal scrolling and small safe inset. Already visible links and neighboring positions remain stable. No fake edge spaces or CSS snap.
- Manual touch/mouse scrolling stays where the user scrolled; fading edges show both overflow directions. Native/modified/keyboard links, bottom Sheet name/heading focus/Escape/focus return and role/license filtering retained.
- Owned: MobileBottomBar TSX/SCSS/tests, architecture navigation paragraph and own planning docs/index/registry row. Shared Sheet/ModuleShell/backend/router untouched. Foreign baseline SHA-256 matches all ten original files.

## Evidence

| Gate | Status |
|---|---|
| Implementation | implemented |
| Initial targeted | PASS 24 tests, targeted-r9.log; subsequent oversized guard covered by final full frontend gate |
| Root lint / TypeScript | PASS exit 0; existing 121 backend / 80 frontend lint warnings |
| Full backend | PASS exit 0, 388 suites / 3662 tests; existing 1 suite / 11 skipped |
| Full frontend | PASS exit 0, 330 files / 1762 tests; official Windows runner workers=4/chunk=80; final navigation tests 25 |
| Local Chromium mock API | PASS 54 matrix + 3 history/resize checks, errors=[] |
| Screenshots | self-reviewed dark first/short, light last at 320; r9 screenshots retained |
| Human/device/screen-reader/live authenticated API | pending external |
| Release | not-applicable; commit/push/deploy not assigned |

Logs: lint-r9.log, typescript-r9.log, backend-r9.log, frontend-r9.log. Browser [matrix](browser-r9-report.json), [history](browser-r9-history-report.json), replayable scripts browser-r9-check.cjs / browser-r9-history.cjs and logs. 320/390/640 both themes; stable visible and same-page selection, natural first/last boundaries, single/short center, native CDP swipe without snap/backforcing, mouse drag no navigation, heading/Tab/Escape/focus return, reduced-motion history/back/forward/resize, desktop hidden, document no horizontal overflow. Mock API evidence is not real-device/live-backend verification.

## Handoff

Next action: external real-device/screen-reader/human UAT when devices/participants are available; no functional work remains in N17. Coordination idle, automated/local mocked browser gates complete. No delegated writers; self-review not independent. Temporary Vite 3017 stopped; user servers untouched. Adjacent initiatives and root STATE/ROADMAP retained.
