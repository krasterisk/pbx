# Автообзвон: R0 acceptance matrix

Baseline: `main` @ `92d342d1`. Матрица сопоставляет A01-A24 с фактическим состоянием. `implemented` означает код и автоматическое evidence в указанном scope; `partial` означает, что часть требований либо внешний gate остаются. Ни один статус не означает `released`.

| Finding | Статус | Evidence / остаток |
|---|---|---|
| A01 API списка контактов | implemented | Unified page contract, HTTP/controller и UI tests; полный UI-to-HTTP-to-DB сценарий pending |
| A02 stable UID полей | implemented | Diff полей и DB-backed regression; repair исторически утраченных UID не делается догадками |
| A03 stable phone UID | implemented | Update по UID, защита ссылок задач; отдельная ручная миграция старых ссылок pending |
| A04 required phone | implemented | Общий validator manual/import; HTTP и MySQL evidence |
| A05 contact вне первой страницы | implemented | Tenant-scoped detail query и loading/error gate формы |
| A06 replacement import | implemented | Preview revision, dedup и rollback tests; production dry-run metrics pending |
| A07 preview/import parity | implemented | Parser options/profile mapping, format rejection tests; performance baseline pending |
| A08 selection и dialog context | implemented | Dialog target отделён от selection, import session сохраняет base identity |
| A09 dirty refetch | partial | Draft кампании, базы и контакта не перетирается refetch; browser conflict/reload UX pending |
| A10 ошибки мутаций/запросов | partial | Основные формы/list errors и retry покрыты; delete кампании ждёт успеха, показывает локализованную ошибку и сохраняет диалог при отказе. Полный browser audit pending |
| A11 null/empty/zero/defaults | implemented | Explicit zero retry и clear semantics покрыты; legacy defaults не мигрируются молча |
| A12 поиск/масштабирование | partial | Debounce/page clamp и contact count regression; замеры 1k/10k pending |
| A13 compiler/editor parity | partial | Capability gate принимает только реально скомпилируемые шаги и modern fixed target; playback использует общий tenant-scoped renderer, выключенные шаги не влияют на queue gate. Общего adapter для остальных шагов, TTS preparation, conditions и dynamic targets пока нет |
| A14 ARI answer/correlation | partial | Correlation до originate, handoff только при `Up`, duplicate events idempotent; на PBX подтверждены `StasisStart:Down → ChannelStateChange:Up → StasisEnd:Up` для Local-канала и `ChannelHangupRequest:Down → ChannelDestroyed:Down` для failed SIP originate. Versioned DB fixture подтвердила реальный campaign → task → ARI → SIP loopback → terminal `success` (17 s answer duration) с `caller_id=74954445566`. Event-order permutations остаются pending |
| A15 capacity contract | implemented | Providers возвращают новые слоты; tenant/trunk/reservation regressions покрыты; READY-операторы в нескольких очередях одной кампании считаются один раз |
| A16 trunk availability | partial | Stale finite occupancy fail-closed, pacer передаёт eligible trunks selector-у; shared reservation между workers pending |
| A17 lease/restart/stop | partial | Stop/sweep не requeue `dialing`; delete блокируется при leased/dialing задачах. Answer timestamp записывается в attempt, а Destroy без локальной Map находит открытый attempt по channel ID после restart. Перед originate `leased_by` проверяется и task+attempt переводятся одной DB-транзакцией, поэтому воркер с утраченным lease не создаёт звонок. Heartbeat, shared capacity reservation, live PBX reconciliation и multi-worker fault injection pending |
| A18 finalization/order | partial | Conditional terminal update, preservation fields и pre-Hangup AMD machine marker; bounded late enrichment/metrics semantics pending |
| A19 DNC last mile | partial | Canonical/legacy normalization, tenant scope и check перед create attempt; concurrent DNC-add linearization pending |
| A20 schedule/timezone | partial | Strict timezone save, all-disabled closes pacer; subscriber-hours/DST browser evidence pending |
| A21 saved vs applied | partial | Config+schedules transaction, revision conflict, start/resume apply gate; appliedRevision/retry visibility pending |
| A22 tenant nested refs | partial | DNC base/campaign, per-trunk CID directory/field, campaign trunks, queue pool/fixed targets and extension endpoint targets are tenant-scoped at save/start/resume; prompt targets and DB-backed negative matrix pending |
| A23 layout/responsiveness | partial | Responsive grids, tooltips, IANA picker; Chromium geometry пройдена на 360/390/768/1280/1920/2560 px в ru/en и все семь вкладок при эффективных 360 px; настоящий browser zoom 200%, focus и content-level clipping pending |
| A24 DNC UI boundary | partial | Global/base entries are visible in campaign as inherited read-only; only local campaign rows can be deleted, global add/delete requires confirmation; browser UAT pending |

## Текущее automated evidence

- `AUTODIAL_DB_INTEGRATION=1 npm run test -w @krasterisk/backend -- --runInBand --testPathPattern=autodial --no-coverage`: earlier 21 suites / 186 tests passed. Latest focused DB integration: 11 tests passed, including durable answer correlation; temporary schema `krsk_ac_test_a3bc0541403d0c04` removed by teardown.
- `npm run test -w @krasterisk/frontend -- src/features/autodial --maxWorkers=2 --no-file-parallelism`: 17 files / 87 tests passed after the delete-dialog change. Frontend typecheck and scoped ESLint passed.
- `npm run lint`: exit 0; backend 98 warnings, frontend 82 warnings, no errors. One pre-existing hook-dependency warning remains in autodial `ReportsView`; the `CampaignsTable` warning was removed.
- `npm run test:backend` after the latest campaign, base, playback, restart-recovery, active-call delete guard and ARI ownership changes: 251 suites passed, 1 skipped (full repository gate).
- `npm run test:frontend`: latest full run reproduced the unrelated `ConferenceRoomFormModal.test.tsx` failure and then stalled; it was stopped. The earlier full run yielded 247 files / 1391 passes and one failure. Current autodial slice: 17 files / 87 tests passed.
- `npm run lint`: exit 0, backend 98 warnings and frontend 82 warnings, no errors. `npm run build -w @krasterisk/backend`: exit 0; `dist/database/database-config.cjs` exists and the schema-readiness module resolves. Backend and frontend production typechecks passed; scoped ESLint and `git diff --check` passed (Git emitted CRLF conversion notices only).

## External gates

| Gate | Status | Reason |
|---|---|---|
| Browser geometry 360-2560/200% ru/en | partial | 14 Chromium checks passed for pages/modals/tabs at effective widths 360-2560 px in ru/en; actual browser zoom 200% and visual/focus review remain |
| PBX ARI permutations | partial | Test PBX and local backend connected; Local call showed `StasisStart:Down → ChannelStateChange:Up → StasisEnd:Up`. Versioned fixture также подтвердила реальный campaign → task → SIP loopback → `success`; event-order permutations остаются pending |
| SIP CallerID capture | implemented | Dedicated loopback captured два значения в SIP From/PAI/RPID и inbound CallerIDNum после перехода на ARI `/channels?callerId=...`. Настоящая campaign attempt завершилась `success` с тем же сохранённым `caller_id=74954445566`; provider-specific policy остаётся операционной проверкой |
| AMD runtime / voicemail | partial | `app_amd.so` loaded; isolated ARI/Local probe reached `AMD()` and repeated greeting produced `MACHINE`; short greeting and no audio produced `NOTSURE`. Campaign machine branch and voicemail playback remain unverified; voicemail still intentionally disabled |
| Multi-worker/restart fault injection | pending | No durable owner/fencing implementation yet |
| Complete frontend repository gate | partial | Full run has one unrelated brittle conference locale assertion; повторный параллельный запуск завис и остановлен. Autodial slice: 15 files / 83 tests passed с двумя workers последовательно |

## Следующее действие

Capture a known caller ID on the wire through the real campaign path after backend restart; confirm provider-specific trunk policy separately. Implement durable ownership/fencing before multi-worker/restart fault injection. For voicemail, specify and implement a media source and playback path before acceptance. Decide whether campaign removal must retain attempt history with a soft-delete or archive model: the current hard delete leaves orphan attempts. The isolated test trunk/context, generated campaign dialplan and SIP logger were removed; no test calls remain active. Detailed evidence: [external-gates report](AUTODIAL-REFACTOR-EXTERNAL-GATES-2026-09-18.md).
