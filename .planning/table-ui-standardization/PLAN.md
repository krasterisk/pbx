# Shared tables — 2026-10-12-r1

User assignment: make shared/ui/Table reusable with endpoint-style surfaces/selection, configurable search and CSV export (enabled by default), apply across project sections.

- T1: shared Table SCSS/primitives and TableToolbar with showSearch/showExport, controlled search/export handlers, action slots, accessible icon tooltips and stable sizing. Raw markup tables retain compatible ref/HTML props and gain functional local search/export defaults; data tables delegate these operations to their row model.
- T2: DataTable internal search, controlled onGlobalFilterChange, configurable toolbar and shared CSV serialization preserving selected rows across filters/pages; explicit server loaded-page scope. Keep public ref, pagination, selection/banner, expansion and row-action behavior.
- T3: migrate every existing business table to shared presentation. Replace direct native table markup with primitives. Use external shared toolbar where a feature owns search/filter/cards; turn off the duplicate internal tools. Support mobile-card CSV with the same column accessors. Keep server/report filters and backend export handlers where already available. Settings matrices/technical previews may opt out of inappropriate tools explicitly; still share table styles.
- T4: regression tests for defaults/flags, local/controlled search, CSV selection/filter/cell escaping, header/action exclusions, raw rows, server scope and representative desktop/mobile consumers. Typecheck, lint, backend/frontend suites and browser verification. Document coverage, exceptions and final evidence; no release or record mutations.

Required reads: AGENTS.md, frontend/backend ARCHITECTURE.md, CANONICAL_REFS, HYBRID-WORKFLOW, EXECUTION-REGISTRY, current Table/DataTable and endpoint design baseline. No packages added.

Acceptance status: T1–T3 implemented; T4 targeted tests/typecheck/lint/backend passed, representative local desktop/mobile browser verified. Full frontend historical run had one corrected fixture failure; corrective reruns passed. Detailed honest gate status and handoff are in [EXECUTION](EXECUTION.md).

## Revision 2026-10-12-r2 — current assignment

- T5: fix clipped surface shadows in Contexts and other section wrappers. Horizontal scrolling belongs inside shared Table, outside wrappers keep overflow visible. Keep application shell scroll/containment unchanged; centralize page/table wrapper styles.
- T6: all entity lists open existing edit form via row/card activation; remove edit actions. Shared TableRow/TableCard handle pointer and Enter/Space activation while excluding checkboxes, their labels, switches, links, action groups and other interactive controls. Preserve read-only/permission guards, copy/delete/connect/audio actions and existing confirmation flows.
- T7: migrate editable desktop tables, semantic rows and mobile cards; use shared presentation tokens, no feature-specific row formatting. Update architecture examples to current user requirement. Preserve embedded form editors/report-only tables where entity edit does not exist.
- T8: meaningful shared interaction tests and representative consumer tests; lint, typecheck, backend/frontend suites; browser Contexts shadow and editing, action isolation and mobile samples. No record saves/delete/deploy. /root sole writer; no agents. Prior r1 evidence remains historical.

r2 acceptance: T5–T7 implemented; T8 automated gates passed with recorded corrective frontend fixture reruns. Local desktop Contexts shadow/edit/selection and Trunks presentation verified; live mobile tool unavailable, RTL mobile activation/guard checks passed. Detailed evidence and limitations in EXECUTION. Coordinator idle; next user review.

## Revision 2026-10-12-r3 — T9 toolbar follow-up

User requested actions before search and stable search geometry when selecting rows. /root sole coordinator/executor, codex-direct. Owned only shared TableToolbar JSX/SCSS and this initiative records. Keep action semantics and conditional clear/delete visibility. On wide containers, tools are left of a fixed 24rem search field anchored right; on narrow containers, tools have their own row before full-width search. Existing consumers inherit the shared change.

User explicitly requested no full suites/lint for small changes. T9 acceptance: targeted existing shared Table/endpoint regressions, rendered desktop search bounds before/after selection and narrow layout inspection; no new implementation-mirroring tests, no repeated full project checks.

T9 final acceptance: implemented, 19 targeted tests PASS; live desktop search/table bounds unchanged on selection, 320px narrow layout no overflow; evidence in EXECUTION. Writer idle.

## Revision 2026-10-12-r4 — selection actions, T10–T13

User assignment: no edit/copy/delete buttons in entity rows or mobile cards. Edit remains row/card activation; copy is a toolbar action available only for one selected entity; delete uses selected entities and existing confirmations. Establish this as the canonical frontend pattern.

- T10: typed shared TableToolbar selection-action API and mobile TableCard selection support; selected identity comes from stable IDs and full data, not a filtered/page index. Preserve search/export position and row activation guards.
- T11: migrate all editable entity tables, column hooks and cards to toolbar copy/delete, preserve existing permission/read-only/built-in restrictions and special domain actions. Add mobile selection where absent. Existing bulk confirmations stay in features; no new backend APIs.
- T12: replace outdated architecture instructions/examples for row copy/delete with the selected-entity toolbar pattern; create final migration inventory.
- T13: targeted meaningful tests for zero/one/multiple selection, copy identity across filters/pages, readonly restrictions, mobile selection isolation, deletion confirmation and representative consumers; typecheck/scoped lint/source review and local browser proof. Full checks only when justified by this broad change; the user's small-change check policy remains in force.

Coordinator/sole executor /root in chat 01a12e83-9fcf-7460-a9b5-060c61e3a096, codex-direct, no agents. Owned frontend shared Table/card/selection primitives and editable entity table/card consumers/tests (including embedded contact book), additive common RU/EN UI labels, frontend architecture and own docs. Excluded backend/API/router/form mutation internals and adjacent TrunksTable writer (chat 01a12910-c17d-7592-a977-11139da2db74); direct coordination explicitly authorized by user. Baseline `%TEMP%/krasterisk-table-selection-actions-baseline.txt`.

r4 acceptance: T10–T13 accepted; targeted tests, production types, scoped lint, coordinated full frontend (344 files / 1887 tests, exit 0) and representative desktop/mobile checks PASS. Full-run discovery preceded the final hook test/contact-book correction, separately verified by targeted regressions; precise timing and handoff in EXECUTION. No active production writer, release or live record mutation.

## Revision 2026-10-13-r5 — mobile card text and toolbar geometry

Current user assignment: audit mobile layouts across all sections; card text must remain readable in full, selection actions must not cause horizontal overflow or layout shifts. Sole coordinator/executor /root, same chat, codex-direct; no agents. Existing dirty baseline main/7263d499 preserved. T14: inventory all TableCard/toolbar consumers and repair shared responsive sizing/wrapping; bounded feature styles only when shared rules cannot solve a concrete rendered defect. T15: preserve conditional action semantics while reserving their geometry; validate selection zero/one/multiple/clear at 320/390/767 widths and long names/descriptions/actions. T16: source coverage inventory for every section, actual accessible local routes browser audit, targeted shared/consumer checks and scoped lint; no repeated full backend/frontend suites for presentation-only changes. Update canonical architecture and evidence. Shared Table owner here; previous Trunks writer FIN, domain logic/backend/router/auth/live records excluded. Never save/delete application entities during QA.

Latest steering: hide export and every toolbar action for zero selection. Retain `showExport` as a capability toggle and imperative export API; selection triggers visible buttons. Remove the framed empty icon group. On mobile directory headers, actions replace the summary in its fixed-height slot, preserving search/list bounds without an empty action row. Compact shared card presentation and reusable `TableCardDetails` labelled responsive grid; adopt it in Routes, Trunks and Endpoints. Preserve complete values, domain controls and existing editor guards.

## 2026-10-13-r6 / single selection toolbar

T17: remove duplicate Google-style selection banners and their public API; preserve the controlled cross-page selection and bulk confirmation semantics.
T18: reusable TableToolbar selection controller, compact fixed-width count/select-all/clear controls; migrate existing tables and mobile lists.
T19: targeted shared/consumer tests, production typecheck, scoped lint and rendered mobile geometry. No full backend/frontend suites for this bounded UI task; preserve adjacent dirty work.
