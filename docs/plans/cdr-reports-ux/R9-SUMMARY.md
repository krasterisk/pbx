# R9: local acceptance and floating widgets

Coordinator /root, chat01a161fb-89f8-7392-9f11-9f7177fa25b5, codex-direct, PLAN R9 revision1 tasks1–7. Baseline main b03e97cf79ce19efac0f3cc05a48e98901ca2590 plus preserved R8 dirty source. No commit or release. Evidence locator: ARTIFACTS_ROOT/runs/cdr-reports-ux/r9-20261022. Pre-existing build metadata and unrelated untracked files retained.

## Implementation

- Date filters now accept local date and time, explicitly apply an interval, retain it in saved selections, reject invalid order/nonexistent DST time and preserve distinct repeated-hour instants. A real browser input-event issue was fixed with onInput handling.
- Organization IANA timezone administration moved to /settings with guarded GET/PUT /system-settings/organization-timezone. Cloud uses tenants.timezone; standalone organization0 uses system_settings organization.timezone.0 without creating a cloud tenant. Dashboard, CDR and CC resolve this consistently. No timezone name/offset labels in journal/card/attention/overview/PDF/CSV/XLSX. Existing setting UTC retained; no guessed organization-zone change.
- Mobile softphone is a56px freely movable button with saved position, registration dot, call timer and existing dial sheet. AI launcher moves freely, retains position and visibility; header switch hides/restores it, app logo replaces robot. Global AI trigger enlarged/styled.
- User-requested generated handset adds a ceramic 3D icon, highlights, bevel/depth/shadow, incoming ringing animation and active-call halo. Reduced-motion preference disables animation. Existing dragging, focus ring and accessible button label retained.
- Launcher is now absent while its phone panel is open on desktop/mobile and returns after closing. Mobile uses only the SheetTitle. Keyboard focus moves into the desktop panel and returns to its launcher on close; mobile close also restores launcher focus. Desktop anchor keeps44px geometry while the trigger is absent. Phone API errors map to RU/EN semantic messages instead of raw Unauthorized/diagnostics; stored error keys follow subsequent language changes. Default audio-device names and millisecond units translated. Final static audit of7 component files/83 static translation keys has no RU/EN omissions; error-message keys are checked separately by unit tests.
- RECORDS_BASE_PATH installation override lets the local backend read a mirror without changing the shared database recording directory. Existing containment/realpath protections remain. One user-authorized recording copied by SSH from ipbx.krasterisk.ru; selected source recording unchanged.

## Live acceptance

Normal existing authenticated browser session only, localhost3010 against updated backend5010. Current PID139348, start receipt backend-start-accepted.json; production-mode local process, no production deployment.

- Journal/overview/facets and admin timezone API load. Same-value UTC admin save succeeds after fixing missing standalone tenant handling (settings-timezone-saved.png).
- Exact03:10–03:15 interval locates03:12 call, saved selection restores it. Temporary selection removed through UI after verification (time-filter-desktop.png).
- Multiple directions, multiple handling values and two normalized caller numbers work together in the live query. Historical trunk predicate has backend regression coverage; live acceptance is described below.
- Live trunk facet test_trunk from real19 October incoming call: trunk filter1 row, trunk+directions=in1 row, in+out multiselection retained, trunk+directions=out0 rows (trunk-live.png). No fabricated outgoing call.
- Free AI position and mobile-phone position survive a fresh mount. AI visibility off survives a fresh mount, global topbar opens chat, switch restores launcher. Original visibility/positions restored after verification. No calls or AI messages sent.
- Mobile dimensions56×56, no horizontal overflow; generated image loaded (softphone-dimensional-mobile.png). Mobile dial sheet opens. Existing disconnected telephony warning remains environmental.
- Route changes actual layout: scheme grid250px columns; timeline flex. Card local time has no UTC label.
- Real selected10:34 human-call recording: one click starts audio, readyState4, paused=false, currentTime4.94, duration17.22, error=null (audio-live.png). Only this file is mirrored locally; unrelated recordings may still be unavailable.
- Journal CSV and callback CSV/XLSX downloaded via UI. Callback cohort here is empty; XLSX zip structurally valid. Journal CSV has no timezone column.
- Actual overview PDF downloaded,2 pages rendered and visually inspected, legible/repeated headings, no timezone labels. Files company-calls.csv, call-callbacks.csv/xlsx, calls-overview.pdf and pdf-page-1/2.png are external artifacts only.
- Dark tooltip rendering retains R8 live evidence; shared label/item foreground styling unchanged.
- Latest desktop/mobile phone check: open panel exists with launcher absent; mobile title count1; launcher and focus return on close; no Unauthorized text. Final main-tab screenshot softphone-final-mobile.png shows the loaded201 extension option without an error. No phone connected/call originated. Current admin lacks analytics-project access: analyzed filter returns403 Analytics access required, diagnostic removed. Positive transcript/source-seek evidence remains the separate authorized R7 acceptance; current account cannot repeat it.
- Frontend proxy stalled while backend health remained200. Original Vite PID was already gone when restart was attempted; identity check prevented stopping another process. Strict-port3010 frontend started as PID316660; backend and frontend-proxy health both200 afterwards. Original user tab preserved.

## Automated evidence

| Gate | Result |
| --- | --- |
| npm run test:backend -- -- --maxWorkers=2 | PASS:510 suites,5031 tests,27 conditional skips; backend-tests-final.log |
| Final affected backend tests by exact4 paths | PASS:33 tests; backend-delta-tests.log, includes actual-file path override regression |
| npm run lint | PASS:0 errors, existing warnings; final owned phone/related source lint also PASS, phone-focus-lint.log / phone-final-lint.log |
| Backend tsc -p tsconfig.build.json | PASS, backend-build-latest.log; runtime restarted from it |
| Frontend tsc -b and final source tsc --noEmit | PASS, frontend-types-final-accepted.log |
| Final Vite production build | PASS, frontend-build-accepted.log,2m10s; generated icon SHA and final anchor CSS verified in emitted assets |
| Final frontend11 files | PASS:97 tests, frontend-delta-tests.log, includes widgets/date/time and two earlier timeout cases |
| Final phone4 files | PASS:33 tests, phone-corrected-tests.log; latest stored-locale-key delta2 files24 tests PASS, phone-locale-final-tests.log |
| Final keyboard focus / launcher regression | PASS:3 files24 tests, phone-focus-tests.log; actual main-tab close restores launcher focus |
| Phone i18n audit | PASS:7 files83 static keys, RU/EN missing[]; phone-i18n-audit.json |
| Full frontend/current488 files | Initial nondefault80-file/4-worker root run exit1 retained in frontend-tests.log (worker startup/timeouts). First400 files:378 pass plus22 corrected files85 tests PASS. Frozen chunk6 then passed in repository-default40-file forks batches:40/136 and40/281. Last7 files59 tests PASS. New error-map file and latest phone delta also pass. Machine manifest verification.json checks discovery boundaries and all corrections; no untested file gap. Earlier hung attempts retained, optional parallelism change reverted |
| git diff --check | PASS; line-ending normalization notices only |
| Source freeze | PASS:99 product source/test/asset files, delta[]; verification.json and source-freeze.json |

No fresh provider inference, live calls or migrations. SSH operations read/copy only; selected source recording unchanged. Runtime caveat: at14:49 existing backend AMI reconnection recovered and its normal startup/retry machinery applied existing BLF configurations for organizations58/0/356/357/358/362 (backend-runtime-accepted.log). No manual dialplan changes or production deployment command was issued; do not describe this restart as having no server-side effects. Authentication helper that attempted JWT minting was rejected by automatic review and never used; all successful HTTP acceptance used the normal browser session. Initial SSH key selection was also rejected until the user explicitly authorized checking other local keys; aipbx_ollama_audit then authenticated successfully.

## Generated asset

Built-in image_gen, transparent PNG, copied into packages/frontend/src/shared/ui/SoftphoneWidget/assets/softphone-handset.png. Original preserved. Prompt:

> Create ONE premium 3D softphone app icon asset, transparent background, square canvas. A single thick rounded telephone handset, diagonally oriented bottom-left to top-right, in luminous icy white ceramic with pale mint highlights and a tiny teal underside, soft bevels and realistic restrained studio shading. The handset silhouette must be instantly legible at 32 px, bold simple large shapes, central object fills 82 percent of the canvas. Elegant business telephony, polished tactile product design, slightly isometric front view, soft contact shadow only immediately beneath object. No surrounding circle, no button plate, no letters, no text, no badges, no tiny details, no robot, no background. This handset will sit inside a deep turquoise circular UI button.

## Acceptance and handoff

Assigned implementation and bounded local acceptance complete. No workers or unfinished local checks. Current source99-file freeze delta[]; current frontend discovery488 files accounted for in verification.json, all corrective batches passed. QA tabs closed; original tab1 preserved, viewport override reset and phone closed after final proof. Current account's transcript-positive gate remains limited by project permission; separate R7 positive evidence retained. A fresh positive check needs an authorized analytics account; do not grant access or run SA/provider processing to manufacture evidence. R8 scheduling research remains a proposal, no email delivery/schedule creation assigned. User review is next; no release or production source deployment assigned.
