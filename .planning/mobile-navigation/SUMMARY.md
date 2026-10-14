# N19 / r11 — доступная стартовая страница и рабочее меню разделов

2026-10-11, /root sole coordinator/executor, codex-direct. Baseline main/7263d499 + foreign endpoints/dialplan/tsbuildinfo and user attachment preserved. [Previous r10](SUMMARY-r10.md).

## Cause and implementation

The login role default used / without validating the final tenant catalog. The root guard deliberately stayed at / even when overview was suppressed or had no page. The footer then had no current module and rendered inert catalog text. Previous empty-catalog fixtures did not reproduce the user's selected-module setup.

- resolveAvailableStartPath validates visible, active, role-permitted catalog pages. Login waits for catalog/role-start and keeps an eligible configured URL including query/hash. An unavailable module start uses the first available page in catalog order, or /modules when none exist. Explicit service/custom starts and the public /ai-robots landing retain their behavior. SUPERADMIN platform start retained.
- Root/deep-link guard shares this resolver, defers to a pending login target and validates the role-default fallback. Pages reassigned from a suppressed baseline section remain available under their current section. No menu module is artificially enabled and no catalog/backend setting is changed.
- AppLayout controls one mobile left Sheet for header and no-page footer. The footer always has an actionable section trigger; standalone composition uses a real Hub link. Sheet heading receives initial focus and Escape returns focus to its surviving opener. Existing single-page static labels and multi-page scrolling/accordions retained.
- Owned files: available-start helper/tests, role-start/license hooks/tests, AppLayout/ModuleShell composition, MobileModuleMenu and MobileBottomBar/tests/SCSS, navigation architecture and own planning/index/registry rows. Shared registry/router/API/backend and foreign dirty paths untouched.

## Gates

| Gate | Status |
|---|---|
| Implementation | implemented |
| Targeted UI/modules regression | PASS 20 files / 147 tests, targeted-r11-final.log |
| Extended root/role gate cases | PASS 7 tests, gate-r11-final.log |
| Final available-start cases | PASS 13 tests, start-r11-final.log |
| Root lint | PASS exit 0, lint-r11.log; existing 121 backend / 80 frontend warnings |
| Final scoped lint | PASS exit 0, lint-r11-confirmed.log |
| TypeScript | PASS exit 0, typescript-r11-confirmed.log (--noEmit --incremental false) |
| Full frontend final revision | PASS exit 0, 334 files / 1799 tests, frontend-r11-final.log; official Windows runner workers=4/chunk=80 |
| Full backend | PASS 388 suites / 3662 tests; existing 1 suite / 11 skipped, backend-r11.log |
| Local Chromium with API mocks | PASS 34 checks, browser-r11-check.cjs / browser-r11-report.json / browser-r11.log; errors=[] |
| Screenshots | self-reviewed r11-selected-PBX-dark-390.png and r11-selected-PBX-light-320.png |
| Real Android/device/screen-reader/live authenticated API/human UAT | pending external |
| Release | not-applicable; commit/push/deploy not assigned |

Browser catalog explicitly disables all unassigned sections and varies overview hidden/off/empty/disabled. At 390 dark, 320 light, 1280 dark, root lands on /endpoints and selects its page. Phones also open the one left Sheet from the footer on /profile, restore focus and navigate to Trunks with a selected bottom link. Delayed pending-login fixture reproduces the literal Sections footer and verifies it works; valid configured /trunks query/hash survives catalog loading, empty catalog leads to Hub without looping, enabled Dashboard keeps its single label, catalog error leads to actionable Hub/retry. Reassigned page and operator fallback are covered by units, not browser matrix.

The first component run exposed an actual focus restoration issue from capturing body; fixed and targeted regression passed. Two initial browser fixture failures came from a hidden /reports route being correctly guarded and reseeding a login flag on every document load; fixtures corrected to /profile and one login per session. Initial logs retained; final browser report passed. No independent review is claimed.

## Handoff

Coordinator remains /root; no delegated writers. N19 implemented and automated/local mocked gates passed; coordination idle. Next action: external real-device/live authenticated API/human acceptance when available; publication remains unassigned. Real-device/live API gates remain distinct. Foreign ten SHA-256 hashes match baseline-r6.json; git diff --check PASS. Temporary own Vite 3017 stopped after browser checks; user servers unchanged. Adjacent initiatives/root STATE/ROADMAP untouched. No publication assigned.
