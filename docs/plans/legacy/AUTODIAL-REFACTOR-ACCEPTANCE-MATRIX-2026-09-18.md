# Автообзвон: R0 acceptance matrix

Baseline: `main` @ `92d342d1`. Обновление close 2026-09-21. `implemented` = код + автоматическое evidence в указанном scope. Ни один статус не означает `released`.

| Finding | Статус | Evidence / остаток |
|---|---|---|
| A01 API списка контактов | implemented | Unified page contract, HTTP/controller и UI tests |
| A02 stable UID полей | implemented | Diff полей и DB-backed regression |
| A03 stable phone UID | implemented | Update по UID, защита ссылок задач |
| A04 required phone | implemented | Общий validator manual/import |
| A05 contact вне первой страницы | implemented | Tenant-scoped detail query |
| A06 replacement import | implemented | Preview revision, dedup и rollback tests |
| A07 preview/import parity | implemented | Parser options; 1k preview timed; 10k HTTP 413 |
| A08 selection и dialog context | implemented | Dialog target отделён от selection |
| A09 dirty refetch | partial | Draft не перетирается refetch; conflict UX без diff |
| A10 ошибки мутаций/запросов | partial | Локализованные коды; полный browser audit не делался |
| A11 null/empty/zero/defaults | implemented | Explicit zero retry |
| A12 поиск/масштабирование | partial | Debounce/clamp. 1k preview 154 ms; 10k JSON 413 |
| A13 compiler/editor parity | implemented | Capability gate + `renderActionChain` adapter; TTS CURL+Playback; dynamic queue явно запрещён |
| A14 ARI answer/correlation | partial | Up=handoff; isolated + campaign loopback success earlier; event-order permutations pending |
| A15 capacity contract | implemented | Providers = новые слоты; operator dedup |
| A16 trunk availability | implemented | Stale finite fail-closed; durable `ac_channel_reservations` |
| A17 lease/restart/stop | implemented | Stop не requeue dialing; claim tx; campaign `pacer_owner` CAS. Live two-process injection не гоняли |
| A18 finalization/order | partial | Idempotent + AMD/voicemail marker; late CDR semantics open |
| A19 DNC last mile | implemented | Recheck inside `claimAndOpenAttempt` READ_COMMITTED |
| A20 schedule/timezone | implemented | Invalid TZ rejected; subscriber hours vs enabled windows |
| A21 saved vs applied | implemented | `applied_revision` + `apply_error`; start/resume refuse running on apply fail |
| A22 tenant nested refs | partial | Trunk/queue/exten/CID/prompt scoped; DB-backed negative matrix still thin |
| A23 layout/responsiveness | partial | Widths 360–2560 earlier; live 1920 7 tabs in bounds; CDP pageScale 200% 2/2 after open-then-scale. Native Ctrl++ and zoom-then-create (header intercept) open |
| A24 DNC UI boundary | implemented | Inherited read-only; global confirm; live bases page shows DNC panel |

## Текущее automated evidence (2026-09-21)

- Backend autodial Jest: 23 suites / 230 passed / 11 skipped (earlier this session).
- Frontend autodial vitest, 18 explicit files: 96 passed, 58.8 s.
- Scoped ESLint autodial BE: 0 errors. FE: 0 errors, 1 pre-existing hooks warning in `ReportsView`.
- Playwright pageScale 200% ru/en: 2 passed.
- Isolated AMD Local: MACHINE + WaitForSilence SUCCESS + Playback beep; cleanup 0 channels.
- Import-preview 1k: 201 / 154 ms. 10k: 413.

## External gates

| Gate | Status | Reason |
|---|---|---|
| Browser geometry 360-2560/200% ru/en | partial | Widths previously passed. CDP 200% form tabs passed. Native Ctrl++ and zoom-then-create intercept remain |
| PBX ARI permutations | partial | Isolated + earlier campaign loopback success. Full event-order matrix pending |
| SIP CallerID capture | implemented | Isolated + campaign loopback. Provider From-override operational |
| AMD runtime / voicemail | implemented (isolated) | Live Local MACHINE + silence + Playback. Campaign Prompts file not in this probe |
| Multi-worker/restart fault injection | pending | Fencing code exists; two-process injection not run |
| Complete frontend repository gate | partial | Autodial 18/96 PASS. Full `vitest-run-src` glob still hangs on Windows |

## Следующее действие

Не стартовать кампанию uid 1. Не закрывать GSD STATE фазы 17. Именованные leftovers: native zoom, 10k JSON body, ARI permutations, provider From, live multi-worker. Артефакты close: [SUMMARY](AUTODIAL-REFACTOR-SUMMARY-2026-09-21.md), [VERIFICATION](AUTODIAL-REFACTOR-VERIFICATION-2026-09-21.md), [ADR](AUTODIAL-REFACTOR-ADR-B01-B13-2026-09-21.md).
