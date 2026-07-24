# Phase 10: Full Softphone (WebRTC + SIP/AMI dual-mode) - Research

**Researched:** 2026-07-24
**Domain:** Brownfield extension of an existing WebRTC softphone (sip.js) + AMI call-control surface inside a React FSD / NestJS call-center module. No new external libraries required.
**Confidence:** HIGH (codebase-grounded; every claim below is [VERIFIED: codebase] against files read this session unless tagged otherwise)

## Summary

Phase 10 is **not** a greenfield softphone build - it is a brownfield completion of the `SoftphoneWidget variant="chrome"` shell shipped in Phase 9 (09-06/09-08), whose Journal and Contacts tabs are still literal placeholder strings (`callcenter.softphone.journalSoon` / `contactsSoon`), plus a **net-new SIP/AMI dual-mode chrome path** that does not exist in the codebase at all today. `CallCenterAgentPage.tsx` currently renders `SoftphoneWidget` only when `isWebrtc` is true (`{isWebrtc && <SoftphoneWidget .../>}`); when the operator's shift mode is `'sip'` (already a first-class value of `SoftphoneMode` and already persisted in `sessionStorage` via `shiftSession.ts`), **no softphone chrome renders at all** - the operator has only the `AgentStatusBar` essentials. D-31...D-35 require building this second chrome path from scratch, reusing the same `SoftphoneWidget`/`CallControlBar` visual shell but backed by REST+AMI mutations instead of `useWebRTCPhone`.

The WebRTC call-control surface (`useWebRTCPhone.ts`) is mature: register/re-REGISTER/reconnect with backoff, hold/mute/DTMF, blind+attended transfer, and `getStats`-based quality polling are all implemented and battle-tested through Phase 7/9. The AMI-backed call-control surface (`CallCenterService` + `AmiService`) already covers hangup/hold/unhold/transfer/park/retrieve/conference-add/zombie-reset/warm-transfer-to-queue/click-to-call - all gated through `CallCenterPermissionsService` and channel-ownership checks. The one clearly missing AMI primitive is **DTMF-in-call for PJSIP mode** (no `PlayDTMF` action exists anywhere in `ami.service.ts` today) and there is no backend endpoint for the SIP-mode registration/device-state trigger described in D-35 (the presence infrastructure exists via `CallCenterPresenceService` but nothing surfaces "my own endpoint's" DeviceState as a first-class online/offline signal the way WebRTC's `RegistererState` does).

Journal (D-01...D-10) and Contacts (D-11...D-15) both build on existing, working backend surfaces (`getOperatorCallHistory` / `getTransferDirectory`) rather than new data models, with two exceptions: (1) Journal needs an SSE push on every new history row - today `CallCenterHistoryWriterService` writes `cc_queue_calls` silently with **no SSE emit at all**, so "live via SSE invalidate/prepend" (D-05) requires adding one; (2) the shared contact book (D-11 "+ общая книга контактов тенанта") has **no existing backend entity that fits** - Phase 5's `route_phonebooks`/`route_phonebook_entries` are dialplan-routing lookup tables (bound to routes via `route_phonebook_bindings`, entries have no `name` field, no per-row ownership/`created_by` column) and are the wrong shape for a per-operator-owned CRM-style address book with D-13's row-level CRUD permissions. Research recommends a **new** `cc_contacts` table, not reuse of Phase 5 phonebooks (see Don't Hand-Roll / Assumptions Log).

**Primary recommendation:** Treat this as three parallel work-streams sharing one research doc - (A) WebRTC-mode UI completion (Journal live list + Contacts sectioned list + quality/device rows, all client-side/reuse-heavy, no new backend contracts beyond a Journal SSE emit + `cc_contacts` CRUD), (B) net-new SIP/AMI chrome path (new "SIP softphone" render branch in `CallCenterAgentPage`, new `useSipPhoneAmi`-style hook wrapping the *existing* AMI REST mutations + new `PlayDTMF`/registration-state endpoints), and (C) shell cleanup (delete the `fab` variant per D-26). Do NOT attempt to unify WebRTC and SIP call-control into one hook - the existing pattern (`isWebrtc` boolean branching per-action, e.g. `handleHoldToggle`/`handleHangup` in `CallCenterAgentPage.tsx`) is the established idiom and should be extended, not replaced.

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| WebRTC media/signalling (register, dial, DTMF, quality) | Browser / Client | - | sip.js owns the RTCPeerConnection + SIP stack entirely client-side; no server involvement beyond WSS/ICE config (`useWebRTCPhone.ts`) |
| SIP/AMI call control (dial, hold, transfer, DTMF, hangup) | API / Backend | Browser (thin REST trigger) | Asterisk owns the actual media path on the hardware phone; browser only fires REST mutations that become AMI actions (`CallCenterService` + `AmiService`) - same pattern as existing agentHold/agentTransfer/park/click-to-call |
| Journal (personal call log, N=50, live) | API / Backend (data) | Browser (SSE render) | `cc_queue_calls` rows are written server-side by `CallCenterHistoryWriterService`; browser only renders + needs a new SSE push to stay live |
| Contacts - Endpoints/Queues/Groups sections | API / Backend (data) | Browser (search/filter) | Fully reuses `getTransferDirectory` (Phase 9); browser does client-side search/filter identical to existing `TransferDirectory.tsx` |
| Contacts - shared Book (CRUD, ownership) | API / Backend (new entity) | Browser (Sheet form) | New `cc_contacts` table + service + controller, following the exact multi-tenant + ownership pattern already used by `cc_missed_calls`/`operator-settings.model.ts` |
| Registration/Recover state (WebRTC) | Browser / Client | - | `RegistererState` + `wantConnectedRef`/reconnect backoff already fully own this client-side; no backend change needed |
| Registration/Recover state (SIP/AMI) | API / Backend (source) | Browser (poll/SSE render) | AMI DeviceState/ExtensionState is the source of truth; needs a new backend "my endpoint state" surface (reuse `CallCenterPresenceService.getPresence`) exposed to the SIP-mode chrome |
| Call quality (MOS/jitter/RTT/loss) | Browser / Client | - | `RTCPeerConnection.getStats()` only exists in WebRTC mode; correctly hidden entirely in SIP mode per D-34 (no backend equivalent exists or is planned) |
| Device picker (mic/speaker) | Browser / Client | - | `navigator.mediaDevices` browser API only; no backend involvement, correctly hidden in SIP mode (D-34) |

## User Constraints (from CONTEXT.md)

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions (D-01...D-35, verbatim from `10-CONTEXT.md`)

**Journal ↔ History (два разных инструмента)**
- D-01: Softphone Journal и ARM History panel - разные продукты, не два mount одного UX.
- D-02: Softphone Journal = классический лог in + out + missed одной лентой с иконками направления.
- D-03: Действия Journal: callback/redial + открыть CallCard (не полный History parity).
- D-04: Глубина Journal = последние N звонков; N задаётся в настройках call-центра; default N=50.
- D-05: Journal обновляется live через SSE invalidate/prepend после завершения звонка.
- D-06: ARM History = существующая панель/карточка History в АРМ (Phase 9 visibility); не переносить в softphone-only.
- D-07: History сегменты-вкладки: Очередь (in) · Исходящие · Персональные. Сегмента «Пропущенные» нет - claim/callback/resolve только в MissedCalls.
- D-08: Период History - следовать существующей настройке CC (смена / сутки / оба); не изобретать отдельный дефолт.
- D-09: History: CallCard + открытие/редактирование phonebook-контакта, если номер найден.
- D-10: Быстрый поиск History: для очереди - номер, имя, очередь; для исходящих/персональных - номер, имя, статус (отвечен / не отвечен).

**Contacts catalog**
- D-11: База Contacts = TransferDirectory (абоненты / очереди / группы + BLF) + общая книга контактов тенанта.
- D-12: Общая книга: используется для исходящих из softphone и для lookup имени на последующих входящих.
- D-13: Права книги: оператор - add + edit/delete только своих; supervisor/admin - полный CRUD. Reversibility: costly - права/ownership полей на записях.
- D-14: Softphone Contacts UI: единый поиск + секции Недавние · Абоненты · Очереди · Группы · Книга.
- D-15 [Claude's discretion]: Storage реализации книги (reuse Phase 5 phonebooks vs новая CC-сущность) - research/plan; продуктовое поведение зафиксировано D-11...D-14.

**Registration / Recover UX**
- D-16: Тихий auto-reconnect + индикатор «регистрируюсь…»; кнопка Recover только если авто не удалось за timeout.
- D-17: После F5 / возврата на вкладку: восстановить смену из sessionStorage + auto re-REGISTER без повторного Start shift.
- D-18: Softphone trigger states: online · registering · offline (+ Recover после таймаута).
- D-19: sessionStorage: dial buffer + last number (redial после F5).

**Quality + device picker**
- D-20: Качество: компактный индикатор в status-bar / softphone trigger + детали MOS/jitter/RTT/loss в expanded Dial. Монтировать существующий CallQualityIndicator / phone.quality.
- D-21: Degraded UX = только визуальный warning (badge/toast); без авто-снижения bitrate / авто-действий.
- D-22: Device picker (mic/speaker) - в softphone expanded; без перелогина смены.
- D-23: Смена устройства во время активного звонка разрешена сразу (переключить трек/sink).

**Call-control ownership**
- D-24: Status-bar = essentials (mute/hold/hangup/transfer); Softphone Dial = full set (DTMF, conference, park, warm, zombie, devices, quality). Один shared handler layer на page. Reversibility: costly.
- D-25: Transfer/conference target picker = TransferDirectory в модалке/sheet из call-control; вкладка Contacts = только click-to-call (не transfer mode).
- D-26: Вариант fab удалить из SoftphoneWidget полностью; на АРМ только chrome. Reversibility: costly.
- D-27: Auto-answer + zip tone - parity с chrome UX; без новых режимов (per-queue / custom sounds).

**Multi-call**
- D-28: Multi-line / multi-call UI - out of scope Phase 10 (single active call).
- D-29: Второй входящий при активном звонке - текущее queue/RONA/missed поведение; не вторая линия softphone.
- D-30: Park/retrieve - оставить Phase 9 (role-gated в softphone full set + ParkedCallsIndicator).

**Dual mode: WebRTC + SIP/AMI**
- D-31: Softphone работает в двух режимах: WebRTC (браузерный endpoint) и SIP (внешний клиент / аппаратный телефон на PJSIP). Режим определяется типом endpoint оператора на смене (как Phase 9 click-to-call branching). Reversibility: costly - два transport path в одном UI.
- D-32: В SIP-режиме - полный UI-пульт (Dial / Journal / Contacts / call controls) максимально аналогичен WebRTC; медиа на аппарате; набор / ответ / hangup / hold / transfer / DTMF / park / conference - через AMI (не sip.js).
- D-33: Исходящая связь в SIP-режиме - AMI callback/originate на внутренний номер оператора, затем набор цели (существующий click-to-call / Call-Info pattern Phase 9 D-18/D-29); не WebRTC makeCall.
- D-34: В SIP-режиме скрыть call quality indicator и device picker (нет getStats / браузерных устройств).
- D-35: Trigger в SIP-режиме: endpoint online / offline по AMI DeviceState/ExtensionState; Recover = перезапрос AMI state (аналог re-REGISTER).

### Claude's Discretion
- D-15: конкретная модель хранения общей книги контактов (phonebooks Phase 5 vs CC table) - **resolved below: new `cc_contacts` table** (see Don't Hand-Roll).
- Timeout значения для Recover (D-16) - разумный default: **10s auto-retry window before showing Recover button** (matches `useWebRTCPhone`'s existing 2s/4s/8s/16s/30s backoff - by the 3rd attempt ~14s has elapsed, a round "10s" UI-facing threshold is defensible and simple to implement as a `setTimeout` gate independent of the actual backoff schedule).
- Точные SSE events для Journal invalidate (D-05) - **resolved below: new `cc:history-new` window CustomEvent + RTK `updateQueryData` prepend**, mirroring the existing `presenceUpdate`/`agentKpiUpdate` pattern.
- Точный mapping AMI actions ↔ softphone controls в SIP mode (D-32) - **resolved below** (table in Architecture Patterns); reuses Phase 9 endpoints for everything except DTMF (new) and "my own registration state" (new, thin wrapper over existing presence service).

### Deferred Ideas (OUT OF SCOPE)
- Video softphone.
- Embedded CRM screen-pop beyond CallCard + phonebook contact open/edit.
- Multi-line / multi-call UI (hold A / answer B / switch).
- Native Capacitor softphone (Phase 8 Android track).
- Missed-call claim/callback/resolve workflow (stays in `MissedCallsPanel`).
</user_constraints>

## Project Constraints (from ARCHITECTURE.md)

- **FSD layering:** No raw `div`/`span`/`input`/`button`/`select` above `shared/`; all new Journal/Contacts UI must compose `shared/ui` primitives (`Text`, `Button`, `Input`, `Sheet`, `Tabs`, `SegmentedControl` per UI-SPEC). `SoftphoneWidget.tsx` today has pre-existing raw `<input>`/`<button>`/`<div>` (e.g. dial input, tab row) that predates this rule tightening - the UI-SPEC explicitly calls out replacing the hand-rolled `.tabRow`/`.tabBtn` with `shared/ui/Tabs` (already built in 09-02); new Journal/Contacts markup must not add further raw-tag debt.
- **SCSS modules only** in `features/`/`pages/` (Tailwind forbidden outside `shared/ui`); `var(--color-*)`/`var(--radius-*)` tokens only, no `hsl(var(--x))` legacy syntax, no hardcoded `z-index`.
- **i18n mandatory ru+en** for every new/changed string; no em dash (`-` or comma only). `callcenter.softphone.dialFailed` currently has **no `ru` translation** (English-only fallback) per `10-CONTEXT.md` code_context and confirmed in UI-SPEC Copywriting Contract - must be fixed as part of this phase's i18n pass.
- **Multi-tenant isolation:** any new backend entity (`cc_contacts`) MUST follow `user_uid` (tenant) column + JWT-only tenant resolution (`req.user.vpbx_user_uid`) + `delete dto.user_uid` on update, per backend ARCHITECTURE §Мультитенантность. Additionally needs a `created_by` (operator user id) column for D-13 ownership, following the same shape as `cc_missed_calls.called_back_by`.
- **Optimistic toggles rule:** does not directly apply (no Switch/toggle introduced in this phase's locked scope), but the Journal SSE prepend and Contacts Book CRUD mutations should follow the existing `onQueryStarted` + `updateQueryData` RTK pattern already used for `presenceUpdate` (not a full refetch) to avoid list-jank, per D-05's explicit "invalidate/prepend... не полный refetch" framing (implied from D-05 + existing SSE pattern, not literally in ARCHITECTURE but consistent with its intent).
- **New MCP/AI tool rule (backend ARCHITECTURE §6):** `cc_contacts` is a new "entity users work with" in the strict sense used elsewhere in the codebase (endpoints, trunks, IVR, queues...), but Phase 6's CallGroups/NotificationIntegration precedent explicitly **deferred** MCP/AI tooling for new CC entities to "a later Domain AI Adapter phase" (see Roadmap Phase 6 "Known deferred gap"). Recommend the same deferral here - flag but do not block Phase 10 on adding `create_cc_contact`/`delete_cc_contact` MCP tools.
- **Testing rule:** all new UI components (features/widgets) require integration tests in the same module (existing precedent: `SoftphoneWidget.test.tsx`). All new Redux slices/selectors need unit tests.

<phase_requirements>
## Phase Requirements

No formal `REQ-xxx` IDs exist for Phase 10 in `.planning/REQUIREMENTS.md` (that file only tracks Phase 1-4 MOH/IVR work, consistent with Phase 5-9 precedent which also used bare `D-xx` decision IDs instead of REQ IDs - see `ROADMAP.md` Phase 9 `**Requirements:** TBD (discuss -> REQ / decisions)`). The planner should track coverage against `10-CONTEXT.md` D-01...D-35 directly, the same convention `09-01`...`09-17` plans used for D-01...D-46.

| ID | Description | Research Support |
|----|-------------|------------------|
| D-01...D-10 | Journal tab (blended log, N=50, live SSE, callback/open-card actions) + History segment tabs/search enhancement | `getOperatorCallHistory` reuse; new SSE emit needed (Common Pitfalls #1); `CallHistoryPanel.tsx` has no segment tabs/search today - net-new UI on existing data |
| D-11...D-15 | Contacts sectioned catalog + shared book CRUD | `getTransferDirectory` reuse for 3 of 5 sections; new `cc_contacts` entity for Book section (Don't Hand-Roll) |
| D-16...D-19 | Registration/Recover UX (WebRTC) + sessionStorage dial buffer | `useWebRTCPhone` status machine + `shiftSession.ts` sessionStorage pattern already 90% there; only badge/banner UI + dial-buffer persistence are new |
| D-20...D-23 | Quality + device picker mounting | `CallQualityIndicator` + `useAudioDevices` both exist, built but unmounted in the softphone panel - this is a wiring task, not a build task |
| D-24...D-27 | Call-control ownership split + FAB removal | `CallControlBar` compact/full/extended variants + `AgentStatusBar` essentials already implement the split from Phase 9; D-26 FAB removal is a deletion task on `SoftphoneWidget.tsx` |
| D-28...D-30 | Multi-call out of scope; park/retrieve stays Phase 9 | No new work - `ParkedCallsIndicator` + park/retrieve endpoints already shipped (09-10) |
| D-31...D-35 | Dual-mode WebRTC/SIP chrome | **Biggest gap** - `CallCenterAgentPage.tsx` renders `SoftphoneWidget` only when `isWebrtc`; SIP-mode chrome, DTMF-via-AMI, and "my registration state" endpoint are all net-new (Architecture Patterns, Common Pitfalls) |
</phase_requirements>

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| `sip.js` | `0.21.2` [VERIFIED: codebase `packages/frontend/package.json:75`] | WebRTC SIP stack (UserAgent/Registerer/Inviter/Invitation) | Already the exact-pinned, supply-chain-verified choice from Phase 7 (`07-14-PLAN.md` D-14...D-17); no reason to touch it in Phase 10 - only consume more of its already-implemented surface (transfer/quality/DTMF are already wired) |
| `asterisk-manager` | (existing, unchanged) [VERIFIED: codebase - `AmiService`, backend ARCHITECTURE.md] | AMI event/action transport for SIP-mode call control | Already the sole AMI client library; Phase 10's new AMI actions (`PlayDTMF`, registration-state query) are additive calls through the existing `AmiService.action()` method, not a new integration |
| RTK Query | 2.x (existing) | Journal/Contacts data fetching + SSE cache patching | Same `callCenterApi.ts` injectEndpoints pattern used by every other CC feature; no new data-fetching library needed |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| `shared/ui/Tabs` | existing (built 09-02) | Dial/Journal/Contacts tab switcher | UI-SPEC mandates replacing `SoftphoneWidget`'s hand-rolled `role="tab"` button row with this component |
| `shared/ui/Sheet` | existing | Mobile panel, conference picker, Book add/edit inline form | Already used 3x in `SoftphoneWidget.tsx`; reuse for the new Book add/edit form (UI-SPEC Surface D) |
| `shared/ui/SegmentedControl` | existing | History segment tabs (Queue/Outbound/Personal), Contacts quick-filter | Already the exact pattern `TransferDirectory.tsx` and `CallHistoryPanel.tsx`'s period toggle use |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| New `cc_contacts` table | Reuse Phase 5 `route_phonebooks`/`route_phonebook_entries` | Rejected - those entities are dialplan-routing lookup tables bound 1:many to `route_phonebook_bindings` for call-routing decisions (blacklist/redirect/whitelist), entries have no `name` field (only `number`/`comment`/`vars` JSON) and no per-row ownership column for D-13's operator-vs-admin CRUD split. Bolting softphone-book semantics onto them risks accidental dialplan behavior changes and requires schema surgery (`created_by` column, `name` column) on a table other features already depend on. |
| New AMI `PlayDTMF` action | Reuse `agentTransfer`'s `Redirect` pattern for DTMF | Not applicable - DTMF-in-call has no `Redirect` equivalent; `PlayDTMF` is the standard Asterisk AMI action (`Action: PlayDTMF`, params `Channel`, `Digit`) and must be added as new, small `AmiService` method, following the exact shape of the existing `hangup(channel)` helper |
| Unified WebRTC+SIP call-control hook | Single `useSoftphone()` abstracting both transports | Rejected by precedent - `CallCenterAgentPage.tsx` already branches every call action (`handleHoldToggle`, `handleMuteToggle`, `handleHangup`, `executeTransfer`) on `isWebrtc` today; a forced unification would be a large, risky refactor of working Phase 7/9 code for a phase whose brief explicitly says "аналогично" (analogous), not "identical implementation" |

**Installation:** None - no new packages. `npm view sip.js version` confirms `0.21.2` still current-pinned; no action needed.

**Version verification:** [VERIFIED: codebase] - versions read directly from `package.json`, not re-verified against npm registry (no new/upgraded packages in this phase's locked scope).

## Package Legitimacy Audit

Not applicable - this phase introduces zero new npm dependencies (frontend or backend). All work reuses already-installed, already-audited libraries (`sip.js` 0.21.2 was supply-chain-verified in Phase 7 per `07-14-PLAN.md`; `asterisk-manager` predates this project's GSD tracking). No `package-legitimacy check` run needed.

**Packages removed due to [SLOP] verdict:** none (N/A - no new packages).
**Packages flagged as suspicious [SUS]:** none (N/A - no new packages).

## Architecture Patterns

### System Architecture Diagram

```
                    ┌─────────────────────────────────────────────┐
                    │        CallCenterAgentPage.tsx (owner)        │
                    │  effectiveSoftphoneMode: 'webrtc' | 'sip'     │
                    └───────────────┬───────────────┬───────────────┘
                                    │                │
                     mode==='webrtc'│                │mode==='sip' (NEW branch)
                                    ▼                ▼
                    ┌───────────────────────┐  ┌───────────────────────────┐
                    │   useWebRTCPhone()     │  │  useSipPhoneAmi() (NEW)    │
                    │  sip.js UA/Registerer  │  │  wraps existing REST       │
                    │  register/dial/DTMF/   │  │  mutations: agentHangup/   │
                    │  hold/transfer/quality │  │  Hold/Unhold/Transfer/     │
                    │  (all client-side)     │  │  clickToCall/park/confAdd  │
                    └───────────┬────────────┘  │  + NEW: PlayDTMF, my-      │
                                │                │  registration-state poll  │
                                │                └──────────────┬─────────────┘
                                │                                │
                                ▼                                ▼
                    ┌─────────────────────────────────────────────────────┐
                    │   SoftphoneWidget (variant="chrome", shared shell)    │
                    │   Dial | Journal | Contacts  (shared/ui/Tabs)         │
                    │   - Dial: dialpad, redial, DTMF, quality*, devices*   │
                    │     (*WebRTC-only rows, D-34 - simply not rendered    │
                    │      when mode==='sip')                               │
                    │   - Journal: blended in/out/missed feed, N=50         │
                    │   - Contacts: Recent/Endpoints/Queues/Groups/Book     │
                    └───────────────────────┬───────────────────────────────┘
                                             │
                     GET /callcenter/agent/history?period=  (existing)
                     GET /callcenter/agent/directory?search= (existing)
                     GET/POST/PUT/DELETE /callcenter/contacts (NEW)
                                             │
                                             ▼
                    ┌─────────────────────────────────────────────────────┐
                    │              CallCenterService (backend)              │
                    │  getOperatorCallHistory() ── cc_queue_calls (existing)│
                    │  getTransferDirectory()  ── endpoints/queues/groups   │
                    │  clickToCall/park/hold/transfer ── AmiService.action()│
                    │  NEW: cc_contacts CRUD, PlayDTMF, myRegistrationState │
                    └───────────────────┬───────────────────┬───────────────┘
                                         │                   │
                          CallCenterHistoryWriterService     AmiService (AMI TCP)
                          writes cc_queue_calls on           Originate/Redirect/
                          DialEnd/AgentHangup                Hangup/Park/ConfBridge/
                          ── NEW: emitEvent('historyRow')    NEW: PlayDTMF action
                          for Journal SSE prepend (D-05)
```

### Recommended Project Structure
```
packages/frontend/src/features/callcenter/
├── ui/SoftphoneWidget/
│   ├── SoftphoneWidget.tsx           # remove 'fab' variant (D-26); add mode prop; render Journal/Contacts
│   ├── SoftphoneJournal.tsx          # NEW - blended feed, reuses CallHistoryPanel's directionVisual/row idioms
│   └── SoftphoneContacts.tsx         # NEW - sectioned list (Recent/Endpoints/Queues/Groups/Book)
├── ui/CallHistoryPanel/
│   └── CallHistoryPanel.tsx          # extend: segment tabs (Queue/Outbound/Personal) + per-segment search (D-07/D-10)
├── ui/ContactBookForm/                # NEW - inline Sheet add/edit form for Book section (D-14)
├── lib/
│   ├── useWebRTCPhone.ts             # unchanged
│   ├── useSipPhoneAmi.ts             # NEW - AMI REST wrapper exposing the same call-control surface shape as useWebRTCPhone (status/hold/mute/hangup/dtmf/transfer) for the SIP branch
│   ├── shiftSession.ts               # extend with dial buffer / last-number keys (D-19)
│   └── useCallCenterSSE.ts           # extend: new historyRow SSE listener -> cc:history-new CustomEvent
└── model/ (RTK endpoints)
    └── callCenterApi.ts              # add: getMyContacts/createContact/updateContact/deleteContact, getMyRegistrationState

packages/backend/src/modules/callcenter/
├── callcenter.controller.ts          # add: contacts CRUD routes, agent/dtmf, agent/registration-state
├── callcenter.service.ts             # add: cc_contacts CRUD (ownership-gated), sendDtmf(), getMyRegistrationState()
├── callcenter-history-writer.service.ts  # add: emitEvent('historyRow', ...) after each bulkCreate/create (D-05)
├── models/cc-contact.model.ts        # NEW - user_uid + created_by + name + number + note
├── dto/callcenter-contacts.dto.ts    # NEW
└── migrate-callcenter-contacts.ts    # NEW migration (cc_contacts table + index)

packages/backend/src/modules/ami/
└── ami.service.ts                    # add: playDtmf(channel, digit) thin wrapper over action({action:'PlayDTMF',...})
```

### Pattern 1: Dual-mode branch at the page-orchestrator level (extend, don't replace)
**What:** `CallCenterAgentPage.tsx` already computes `isWebrtc` and conditionally wires WebRTC-specific handlers (`handleHoldToggle`, `handleMuteToggle`, `handleHangup`, `executeTransfer`). Phase 10 must mirror this exact branching for the *new* SIP-mode chrome, rather than inventing a new abstraction layer.
**When to use:** Every softphone call-control action and every chrome-rendering decision in `CallCenterAgentPage.tsx`.
**Example:**
```12:24:packages/frontend/src/pages/CallCenterAgentPage/CallCenterAgentPage.tsx
              <MissedCallsPanel />
              <ParkedCallsIndicator showLabel />
              {isWebrtc && (
                <SoftphoneWidget
                  phone={phone}
                  variant="chrome"
                  ...
```
Phase 10 changes this to render `SoftphoneWidget` for **both** modes, with a `mode` prop and a second data source in place of `phone`:
```tsx
{(isWebrtc || isSip) && (
  <SoftphoneWidget
    mode={isWebrtc ? 'webrtc' : 'sip'}
    phone={isWebrtc ? phone : sipPhone}   // sipPhone: return of new useSipPhoneAmi()
    variant="chrome"
    showLabel
    ...
  />
)}
```

### Pattern 2: `useSipPhoneAmi()` shape-compatible facade over existing AMI mutations
**What:** A new hook exposing the *same field names* `useWebRTCPhone` exposes (`status`, `callInfo`, `isHeld`, `isMuted`, `hangup`, `hold`, `unhold`, `mute`, `unmute`, `sendDtmf`, `makeCall`) so `SoftphoneWidget` can consume either with minimal branching inside the widget itself. Internally it calls the *existing* `useAgentHangupMutation`/`useAgentHoldMutation`/`useAgentUnholdMutation`/`useAgentTransferMutation`/`useClickToCallMutation` (already imported in `CallCenterAgentPage.tsx`) plus two new mutations (`useSendDtmfMutation`, `useGetMyRegistrationStateQuery`).
**When to use:** SIP-mode chrome only. Never used for WebRTC.
**Example:**
```typescript
// lib/useSipPhoneAmi.ts (new) - status/quality omitted per D-34 (no getStats equivalent)
export function useSipPhoneAmi(activeCall: ICall | null) {
  const [agentHangup] = useAgentHangupMutation();
  const [agentHold] = useAgentHoldMutation();
  const [agentUnhold] = useAgentUnholdMutation();
  const [sendDtmf] = useSendDtmfMutation(); // NEW endpoint
  const { data: regState } = useGetMyRegistrationStateQuery(undefined, { pollingInterval: 5000 }); // D-35

  return {
    status: regState?.online ? 'registered' : 'disconnected', // binary, no 'registering' (D-35)
    isHeld: activeCall?.status === 'HOLD',
    hangup: () => agentHangup({}),
    hold: () => agentHold(),
    unhold: () => agentUnhold(),
    sendDtmf: (digit: string) => activeCall && sendDtmf({ uniqueid: activeCall.uniqueid, digit }),
    // makeCall in SIP mode = clickToCall (D-33), already exists
  };
}
```

### Pattern 3: SSE prepend for Journal (mirrors existing `presenceUpdate` cache-patch idiom)
**What:** `useCallCenterSSE.ts` already patches RTK Query cache directly for `presenceUpdate` via `callCenterApi.util.updateQueryData('getTransferDirectory', undefined, (draft) => {...})`. D-05 requires the same idiom for Journal, but the backend does not yet emit anything when a history row is written.
**When to use:** After `CallCenterHistoryWriterService` completes a `cc_queue_calls` insert for the operator's own history feed.
**Example (backend, new):**
```typescript
// callcenter-history-writer.service.ts - after bulkCreate/create succeeds
this.stateService.emitEvent('historyRow', row.user_uid, {
  uid: row.uid, callerIdNum: row.caller_id_num, callerIdName: row.caller_id_name,
  direction: row.direction, disposition: row.disposition, agentUserUid: row.agent_user_uid,
  createdAt: row.created_at,
});
```
```typescript
// useCallCenterSSE.ts (new listener, same file already wires presenceUpdate/agentKpiUpdate)
es.addEventListener('historyRow', (e: MessageEvent) => {
  const row = JSON.parse(e.data);
  if (row.agentUserUid !== myUserId) return; // only my own Journal
  dispatch(
    callCenterApi.util.updateQueryData('getOperatorCallHistory', { period: 'shift' }, (draft) => {
      draft.unshift(row);
      if (draft.length > journalDepthN) draft.pop();
    }),
  );
});
```

### Anti-Patterns to Avoid
- **Do not build a second WebRTC-vs-SIP toggle inside `SoftphoneWidget.tsx` for every button.** Compute a `phone`-shaped object once at the `CallCenterAgentPage` level (Pattern 2) and pass it down; `SoftphoneWidget` should stay transport-agnostic exactly as its existing doc comment already promises ("this widget only renders it, never forks call logic").
- **Do not add a full-state Journal refetch on every SSE event.** D-05 explicitly says "invalidate/prepend," and the existing `presenceUpdate` precedent already proves the codebase's established pattern is `updateQueryData` patch, not `invalidatesTags` + refetch (per ARCHITECTURE's Optimistic Toggles rule's stated rationale: refetch churn is visibly slow).
- **Do not reuse `route_phonebooks` for the shared contact book.** See Don't Hand-Roll and Alternatives Considered - the schema shape and ownership model are wrong, and the entity is load-bearing for dialplan routing elsewhere.
- **Do not gate the new SIP-mode chrome behind a fresh `SoftphoneMode` value.** `'sip'` already exists as a `SoftphoneMode` union member (`ShiftLoginModal.tsx`) and is already persisted (`shiftSession.ts`); the gap is purely that `CallCenterAgentPage.tsx` never renders anything for it, not that the mode itself needs redefinition.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Shared contact book storage | A bespoke JSON-blob-on-operator-settings hack, or shoehorning into `route_phonebooks` | New `cc_contacts` Sequelize model + migration, following the exact multi-tenant (`user_uid`) + ownership (`created_by`) shape already proven by `cc_missed_calls`/`agent-event.model.ts` | `route_phonebooks` entries have no `name` column and no per-row ownership; JSON blobs can't be searched/indexed and break the "operator sees only own, admin sees all" query (D-13) cleanly |
| DTMF-in-call for SIP mode | A custom AGI script or a Redirect-based digit-injection hack | `AmiService.action({ action: 'PlayDTMF', channel, digit })` - the documented standard Asterisk Manager action for exactly this purpose | `PlayDTMF` is Asterisk's own built-in AMI action; hand-rolling any digit-injection alternative (e.g. abusing `SendDTMF` dialplan app via `Redirect`) is strictly worse and non-standard |
| Registration-state polling for SIP mode | A new WebSocket channel just for "is my phone online" | Poll the existing `GET /callcenter/agent/directory` presence data (or a thin new `GET /callcenter/agent/registration-state` wrapping `CallCenterPresenceService.getPresence`) at a low interval (e.g. 5-10s, matching D-35's "AMI DeviceState/ExtensionState" framing) | `CallCenterPresenceService` already subscribes to DeviceState/ExtensionState AMI events and debounces them into `presenceUpdate` SSE (300ms); a new endpoint is a thin read, not new plumbing |
| Journal deduplication for the Contacts "Recent" section | A second backend query/table for "recent contacts" | Client-side slice of the same `getOperatorCallHistory` data already fetched for Journal, deduplicated by number (per UI-SPEC Surface D: "not a separate backend concept, purely a client-side slice") | Explicit UI-SPEC guidance; avoids a second round-trip for data the client already has |

**Key insight:** Every "Don't Hand-Roll" item above is really "don't invent new infrastructure for something the codebase already has 80% of" - the single true net-new backend surface in this phase is `cc_contacts` CRUD, and even that follows an extremely well-worn local pattern (compare `cc_missed_calls`, `operator-settings.model.ts`, `pause-reasons`).

## Common Pitfalls

### Pitfall 1: Journal SSE "live" requirement has no backend event to hook into
**What goes wrong:** A plan that tasks "wire Journal to SSE invalidate/prepend (D-05)" without first adding the emit will silently produce a Journal that only updates on manual refetch/mount, not live - because `CallCenterHistoryWriterService` currently performs `bulkCreate`/writes with **zero** `emitEvent` calls (confirmed by search - no `emitEvent`/SSE-related string in that file).
**Why it happens:** Every other SSE-driven feature in this codebase (missed calls, presence, KPI) was built with the emit and the listener in the same plan; Journal's DB write predates this phase and was never wired for real-time.
**How to avoid:** Explicitly schedule a backend task in Wave 0/1 to add `emitEvent('historyRow', userUid, {...})` to `CallCenterHistoryWriterService` (both its single-insert and bulk paths) before any frontend Journal-SSE task.
**Warning signs:** Journal only updates after switching tabs or a manual page refresh; no `historyRow` (or equivalent) event name appears anywhere in `callcenter-state.service.ts`'s emit call sites.

### Pitfall 2: SIP-mode chrome is not "add a prop" - it is "the softphone doesn't render at all today"
**What goes wrong:** Underestimating scope by treating D-31...D-35 as "hide 2 rows when SIP" (which is what the UI-SPEC's Surface B literally describes for the *visual* delta) while missing that the *entire* `SoftphoneWidget` mount is currently gated by `{isWebrtc && ...}` in `CallCenterAgentPage.tsx` - meaning today, a SIP-mode operator sees zero Dial/Journal/Contacts chrome, only the `AgentStatusBar` essentials.
**Why it happens:** The UI-SPEC (written from the design-contract angle) correctly describes the end-state visual parity, which reads as "small diff," but the code-reading angle shows the *mount condition itself* needs to change, plus a full parallel data-hook (Pattern 2) needs to be built.
**How to avoid:** Size the SIP-mode work as a first-class deliverable (its own wave), not a "few IF branches" tucked into the WebRTC Journal/Contacts wave.
**Warning signs:** A plan with only 1-2 tasks total for "SIP mode" while Journal/Contacts each get 3+ tasks.

### Pitfall 3: `originateDial`'s WebRTC/PJSIP branch detection depends on companion-endpoint naming, not the shift's `SoftphoneMode`
**What goes wrong:** Assuming the backend's `clickToCall`/`callbackMissedCall` dispatch (`originateDial`) already "knows" the operator is in SIP mode from the shift login. In reality it re-derives the mode independently via `isWebrtcCompanion(sipId)` (string-pattern match on the *agent's own* interface, stripped of `PJSIP/`/`SIP/` prefix) - a separate signal from the frontend's `SoftphoneMode`/`shiftSession.ts` value. These two signals should agree in practice, but a plan that changes one detection path without checking the other risks mode-mismatch bugs (e.g. an operator whose interface naming doesn't match `isWebrtcCompanion`'s convention would get PJSIP dial behavior even if their frontend chrome renders WebRTC UI).
**Why it happens:** The two "which mode is this operator in" checks (`isWebrtcCompanion(ifaceId)` in `CallCenterAgentPage.tsx`'s restore logic and in `originateDial`) were written independently across Phase 7/9 for different purposes (UI restore vs dial routing) and were never unified into one source of truth.
**How to avoid:** Do not add a *third* independent mode-detection heuristic for D-35's registration-state endpoint. Reuse `isWebrtcCompanion`/`extractExtension` from `endpoints/endpoint-ids.util.ts` (already imported by `CallCenterPresenceService`/`callcenter.service.ts`) for any new SIP-mode-only backend logic, exactly as existing code does.
**Warning signs:** A new backend method that takes a `mode: 'webrtc'|'sip'` parameter from the client instead of re-deriving it server-side from the agent interface - this would violate the same "never trust client-supplied identity" principle the codebase already enforces for `userUid`/`vpbx_user_uid`.

### Pitfall 4: `CallHistoryPanel` today has no segment tabs or search - D-07/D-10 are new UI, not a toggle
**What goes wrong:** Reading D-06 ("ARM History = existing panel; not переносить в softphone-only") as "no work needed" and skipping D-07 (segment tabs) / D-10 (search) entirely. In reality, `CallHistoryPanel.tsx` today is a single blended feed with only a shift/day `SegmentedControl` - no Queue/Outbound/Personal tabs, no search input at all.
**Why it happens:** D-06's phrasing is about *where* the History panel lives (stay in ARM, don't move to softphone-only), not about whether its feature set is complete.
**How to avoid:** Plan D-07 (3 segment tabs replacing/supplementing the existing shift/day toggle) and D-10 (per-segment search: number/name/queue for Queue segment, number/name/status for Outbound/Personal) as real UI tasks against `CallHistoryPanel.tsx`, filtering the same `getOperatorCallHistory` data client-side by `direction`/`queueName` (no new backend query needed - the DTO already returns `direction`, `queueName`, `disposition`, `callerIdNum`, `callerIdName`).
**Warning signs:** A plan that only touches `SoftphoneWidget.tsx`/new Journal files and never touches `CallHistoryPanel.tsx`.

### Pitfall 5: Removing the `fab` variant (D-26) has more call sites than `SoftphoneWidget.tsx` itself
**What goes wrong:** Deleting the `'fab'` branch inside `SoftphoneWidget.tsx` render logic but leaving `SoftphonePlacement`/`SoftphoneVariant` type exports, the `.fab`/`.fabWrap`/`.fabRinging`/`.fabLeft`/`.fabRight` SCSS classes, and/or `SoftphoneWidget.test.tsx` assertions against `fab`-specific `data-testid`s (`softphone-widget-fab` is currently used by **both** fab and chrome variants - check before deleting).
**Why it happens:** `variant`/`placement` props are typed as a union (`'fab' | 'chrome'`, `'bottom-right' | 'bottom-left' | 'hidden'`) threaded through props, tests, and possibly other call sites beyond the one page component read this session.
**How to avoid:** Grep the whole frontend for `variant="fab"`, `SoftphoneVariant`, `SoftphonePlacement`, `.fabWrap`, `.fabRinging` before declaring the deletion complete; the UI-SPEC explicitly says "No visual regression tests should reference `.fab`/`.fabWrap`/`.fabRinging` after this phase" - treat that as a literal grep-and-verify checklist item, not just a code-review note.
**Warning signs:** `npm run test:frontend` passing while `.fab*` SCSS classes still exist unreferenced in the compiled bundle; TypeScript still exporting a `'fab'` variant option from `SoftphoneWidgetProps`.

### Pitfall 6: Journal N=50 depth setting needs a new `cc_settings` column, and a default that matches existing patterns
**What goes wrong:** Hardcoding `N=50` in the frontend query (`limit: 50`) instead of adding it as a genuine tenant setting, contradicting D-04's explicit "N задаётся в настройках call-центра."
**Why it happens:** `getOperatorCallHistory` already hardcodes `limit: 200` server-side (for the ARM History panel's own needs) - it's tempting to just reuse that number or slice it client-side without adding the dedicated setting.
**How to avoid:** Add a `journal_depth` column to `CcSettings` (`cc-settings.model.ts`), default `50`, following the exact same declaration style as `default_sla_threshold` (`@Column({ type: DataType.INTEGER, allowNull: false, defaultValue: 50 })`); expose it via the existing `callcenter-settings.controller.ts` tenant-settings routes (09-13 already built the merge/lock infrastructure - Journal depth is a plain tenant-level number, no per-operator override needed per D-04's phrasing).
**Warning signs:** `journal_depth`/`journalDepth` string absent from `cc-settings.model.ts`, `CallCenterSettingsService`, and the settings DTO/UI.

## Code Examples

### Existing WebRTC quality polling (already correct - Phase 10 only needs to *mount* it, not build it)
```153:185:packages/frontend/src/features/callcenter/lib/useWebRTCPhone.ts
  const startQualityPolling = useCallback((session: Session) => {
    stopQualityPolling();
    statsTimerRef.current = setInterval(async () => {
      const pc = getPeerConnection(session);
      if (!pc) return;
      try {
        const stats = await pc.getStats();
        ...
        setQuality(qualityFromStats(jitter, rtt, lossPct));
      } catch {
        /* ignore transient getStats errors */
      }
    }, 2500);
  }, [stopQualityPolling]);
```

### Existing click-to-call WebRTC/PJSIP branching (the exact model for D-32/D-33's dial routing)
```1291:1325:packages/backend/src/modules/callcenter/callcenter.service.ts
  private async originateDial(
    agentInterface: string,
    target: string,
  ): Promise<{ success: true; mode: 'webrtc' | 'pjsip'; target: string }> {
    const dialTarget = (target || '').replace(/[^\d+*#]/g, '');
    if (!dialTarget) {
      throw new BadRequestException('Target is required');
    }

    const sipId = agentInterface.replace(/^PJSIP\//, '').replace(/^SIP\//, '');

    if (isWebrtcCompanion(sipId)) {
      this.logger.log(`Click-to-call (webrtc) ${agentInterface} -> ${dialTarget}`);
      return { success: true, mode: 'webrtc' as const, target: dialTarget };
    }

    try {
      await this.amiService.action({
        action: 'Originate',
        channel: agentInterface,
        context: 'from-internal',
        exten: dialTarget,
        priority: '1',
        callerid: `Click-to-call <${dialTarget}>`,
        async: 'true',
        variable: 'SIPADDHEADER=Call-Info: <sip:click-to-call>\\;answer-after=0',
      });
    } catch (err: any) {
      throw new BadRequestException(`Click-to-call failed: ${err.message}`);
    }

    this.logger.log(`Click-to-call (pjsip) ${agentInterface} -> ${dialTarget}`);
    return { success: true, mode: 'pjsip' as const, target: dialTarget };
  }
```
This is precisely the pattern D-33 says to reuse for SIP-mode softphone outbound dial ("existing click-to-call / Call-Info pattern Phase 9 D-18/D-29") - no new dial-routing logic needed, only a new UI surface (softphone Dial tab in SIP mode) that calls the *existing* `clickToCall` mutation instead of `phone.makeCall`.

### Existing SSE cache-patch idiom to replicate for Journal (D-05)
```247:260:packages/frontend/src/features/callcenter/lib/useCallCenterSSE.ts
    es.addEventListener('presenceUpdate', (e: MessageEvent) => {
      const data = JSON.parse(e.data);
      dispatch(
        callCenterApi.util.updateQueryData('getTransferDirectory', undefined, (draft) => {
          ...
        }),
      );
    });
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|---------------|--------|
| Softphone as floating FAB (`variant="fab"`) | Softphone docked in chrome (`variant="chrome"`) | Phase 9 (09-06/09-08) introduced `chrome`; Phase 10 D-26 finishes the migration by deleting `fab` entirely | `fab` is legacy-in-place today, not yet removed - Phase 10 is the deletion phase, not the introduction |
| Journal/Contacts placeholders | Live data-backed tabs | Not yet changed - still placeholder strings today | This *is* Phase 10's core deliverable for these two tabs |
| WebRTC-only softphone chrome | Dual-mode WebRTC + SIP/AMI chrome | Not yet changed - SIP mode currently has **no** softphone chrome at all | This is Phase 10's other core deliverable (D-31...D-35) |

**Deprecated/outdated:** `SoftphonePlacement` (`'bottom-right' | 'bottom-left' | 'hidden'`) is already marked `@deprecated` in the source (`SoftphoneWidget.tsx:29-30`) - Phase 10 should either remove it entirely or narrow it per the UI-SPEC's own uncertainty ("`SoftphonePlacement` narrows to... or is removed if no longer referenced") - a grep-and-decide task, not a research-resolvable question (see Open Questions).

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|----------------|
| A1 | `PlayDTMF` is a valid, available Asterisk Manager Interface action on this project's Asterisk version, with parameters `Channel`/`Digit` (no `Duration` required) | Don't Hand-Roll, Architecture Patterns | If the AMI action name/params differ on the deployed Asterisk version, the new `sendDtmf` backend method fails silently or throws - must be verified against a live Asterisk instance/AMI action list during execution (same class of risk the codebase already flags via `[ASSUMED]` comments on `SIPADDHEADER`/DeviceState field names elsewhere in this module) |
| A2 | A ~10s auto-retry window before showing the Recover button (D-16 discretion) is an acceptable default | User Constraints > Claude's Discretion | If too short, the Recover button flickers into view during normal backoff; if too long, operators feel stuck watching "Registering..." - low risk, purely a UX-tuning value the plan/execute phase can adjust without architectural impact |
| A3 | AMI `DeviceState`/`ExtensionState` field names (`evt.device`, `evt.state`, `evt.exten`, `evt.context`, `evt.status`/`evt.statustext`) used by the *existing* `CallCenterPresenceService` are correct for this project's Asterisk version | Don't Hand-Roll (registration-state polling), Architectural Responsibility Map | This is an inherited assumption from Phase 9 (09-11), already tagged `[ASSUMED]` in that phase's STATE.md entry and flagged for "09-VALIDATION" - Phase 10's D-35 registration-state feature directly depends on this being correct; if wrong, SIP-mode online/offline badge will be silently stuck/incorrect |
| A4 | Reusing `cc_missed_calls`/`operator-settings.model.ts`'s exact column-and-ownership shape (`user_uid` + `created_by`-style column + soft business-logic ownership) is the right template for `cc_contacts`, rather than inventing a lighter/heavier schema | Don't Hand-Roll, Architecture Patterns | Low risk - this is an internal-consistency choice, not a correctness-critical external dependency; worst case is a future refactor if D-13's ownership model needs to grow (e.g. team-shared contacts) |

**If this table is empty:** N/A - see rows above. A1 and A3 are the two claims execution should double-check against a live Asterisk/AMI session before considering D-32/D-35 "done."

## Open Questions

1. **Should `SoftphonePlacement` be removed entirely or narrowed?**
   - What we know: UI-SPEC Surface A explicitly hedges ("`SoftphonePlacement` narrows to `'bottom-right' | 'bottom-left' | 'hidden'` used only for the deprecated placement setting's remaining chrome-adjacent meaning, **or is removed if no longer referenced**").
   - What's unclear: Whether any other call site outside the 4 files read this session (`SoftphoneWidget.tsx`, `CallCenterAgentPage.tsx`, settings UI) still reads `placement`/`SoftphonePlacement` at runtime (e.g. a settings form letting operators pick FAB corner, which would need its own cleanup).
   - Recommendation: Planner should schedule a grep-and-decide task at the start of the FAB-removal wave (`grep -rn "SoftphonePlacement\|placement=" packages/frontend/src`) rather than pre-deciding here; the answer changes the FAB-removal task's exact diff but not its risk level.

2. **Exact Journal N=50 setting UI location (Settings page tab)?**
   - What we know: D-04 says "N задаётся в настройках call-центра" (tenant CC settings, admin/supervisor-configurable per the existing `CallCenterSettings.tsx`/`callcenter-settings.controller.ts` pattern).
   - What's unclear: Whether it belongs in the existing generic `CallCenterSettings.tsx` form or needs its own small section; this is a 1-field addition, not architecturally significant.
   - Recommendation: Add it as a single numeric field in the existing tenant `CallCenterSettings.tsx` form (near `default_sla_threshold`/`alert_thresholds`) - no new settings sub-page needed for one field.

3. **Should the new `cc_contacts` Book section support bulk import, given phonebooks already have CSV/bulk patterns elsewhere?**
   - What we know: D-14's UI-SPEC only describes a small inline `Sheet` add/edit form (name/number/note), one row at a time - no bulk import is mentioned anywhere in CONTEXT.md or UI-SPEC.
   - What's unclear: Nothing - this is explicitly out of D-11...D-15's locked scope; flagging only so the planner doesn't over-build.
   - Recommendation: Do not add bulk import/CSV for `cc_contacts` in this phase; it is not requested and would expand scope beyond the locked decisions.

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|--------------|-----------|---------|----------|
| `sip.js` (npm, frontend) | WebRTC Dial/Journal/Contacts chrome | Yes [VERIFIED: `package.json`] | 0.21.2 | - |
| `asterisk-manager` (npm, backend AMI client) | SIP-mode call control, `PlayDTMF`, registration-state | Yes [VERIFIED: existing `AmiService` usage throughout `callcenter.service.ts`] | unchanged, not re-verified this session (no upgrade in scope) | - |
| Live Asterisk instance with AMI + PJSIP realtime | Validating A1/A3 assumptions (`PlayDTMF`, DeviceState/ExtensionState field shapes) | Not verified this session (static code research only, no live PBX access from this environment) | - | Execution phase must checkpoint:human-verify against a real Asterisk/AMI session before marking D-32/D-35 tasks done - same precedent as Phase 9's `09-VALIDATION` flags on `SIPADDHEADER`/DeviceState assumptions |
| `node`/`npm` toolchain for `npm run lint`/`test:backend`/`test:frontend` | Standard verify gate | Yes (existing monorepo scripts: `vitest run` frontend, `jest` backend) | - | - |

**Missing dependencies with no fallback:** none - this phase needs no new tools/services, only live-Asterisk verification of two already-tagged `[ASSUMED]` AMI event/action shapes (A1, A3), which is a verification step, not a blocking environment gap.

**Missing dependencies with fallback:** Live Asterisk AMI verification (A1/A3) - fallback is a `checkpoint:human-verify` task against a real PBX/AMI session during execution, same pattern already used across Phase 9 for equivalent AMI-shape assumptions.

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework (frontend) | Vitest (`vitest run`) [VERIFIED: `packages/frontend/package.json` `"test": "vitest run"`] |
| Framework (backend) | Jest (`jest`) [VERIFIED: `packages/backend/package.json` `"test": "jest"`] |
| Config file | Vite/Vitest config co-located per package; Jest config in backend `package.json`/`jest.config` (existing, unchanged) |
| Quick run command | `npm run test:frontend -- SoftphoneWidget` / `npm run test:backend -- callcenter.service` (targeted) |
| Full suite command | `npm run test:frontend` / `npm run test:backend` (root scripts per AGENTS.md) |

### Phase Requirements -> Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|--------------------|--------------|
| D-01...D-05 | Journal renders blended feed, respects N depth, prepends on SSE | unit/integration | `npm run test:frontend -- SoftphoneJournal` | ❌ Wave 0 (new file) |
| D-07/D-10 | History segment tabs + per-segment search filter existing rows correctly | integration | `npm run test:frontend -- CallHistoryPanel` | ✅ exists (extend) |
| D-11...D-14 | Contacts sectioned list renders 5 sections, unified search filters across all | integration | `npm run test:frontend -- SoftphoneContacts` | ❌ Wave 0 (new file) |
| D-13 | Book CRUD - operator sees/edits only own rows; admin/supervisor sees/edits all | unit (backend service) + integration (frontend) | `npm run test:backend -- callcenter.service` (contacts ownership) | ❌ Wave 0 (new test block) |
| D-26 | `fab` variant fully removed, no `.fab*`/`SoftphoneVariant==='fab'` references remain | unit | `npm run test:frontend -- SoftphoneWidget` | ✅ exists (extend/assert absence) |
| D-31...D-35 | SIP-mode chrome renders Dial/Journal/Contacts; quality/device rows absent; registration badge shows online/offline (no "registering") | integration | `npm run test:frontend -- CallCenterAgentPage` + new `useSipPhoneAmi` unit test | ❌ Wave 0 (new hook + tests) |
| new AMI `PlayDTMF` | Backend sends correct AMI action shape for SIP-mode DTMF | unit (mock AmiService) | `npm run test:backend -- callcenter.service` (DTMF) | ❌ Wave 0 (new test block) |
| new `cc_contacts` CRUD | Tenant isolation + ownership enforced at service layer | unit | `npm run test:backend -- callcenter.service` (or dedicated `cc-contacts.service.spec.ts`) | ❌ Wave 0 (new file, follows `callcenter-permissions.service.spec.ts` precedent) |

### Sampling Rate
- **Per task commit:** targeted test file for the touched module (e.g. `vitest run SoftphoneJournal`, `jest callcenter.service`)
- **Per wave merge:** full `npm run test:frontend` + `npm run test:backend`
- **Phase gate:** Full suite green + `npm run lint` before `/gsd-verify-work 10`, per AGENTS.md's standing rule

### Wave 0 Gaps
- [ ] `SoftphoneJournal.test.tsx` - new file, covers D-01...D-05
- [ ] `SoftphoneContacts.test.tsx` - new file, covers D-11...D-14
- [ ] `useSipPhoneAmi.test.ts` (or inline in `CallCenterAgentPage.test.tsx` if one exists - not confirmed this session) - covers D-31...D-35 status-mapping logic
- [ ] `cc-contacts.service.spec.ts` (or extend `callcenter.service.spec.ts`) - covers D-13 ownership + tenant isolation
- [ ] Migration test/manual-verify for new `cc_contacts` table (follows `migrate-callcenter-phase9-schema.ts` precedent - these migrations are not typically unit-tested, only manually applied + verified per `STATE.md`'s "migration applied to live DB" convention)

## Security Domain

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|----------------|---------|-------------------|
| V2 Authentication | No (unchanged) | Existing `JwtAuthGuard` on `CallCenterController`, unchanged |
| V3 Session Management | No (unchanged) | Existing JWT session model, unchanged |
| V4 Access Control | Yes | New `cc_contacts` CRUD must enforce D-13 row-level ownership server-side (`created_by === req.user.sub` for non-supervisor edits/deletes) - never trust a client-supplied "isOwner" flag; mirror the exact pattern `assertSupervisor(req.user)` already uses for other level-gated routes |
| V5 Input Validation | Yes | New DTOs (`CreateContactDto`/`UpdateContactDto`, `SendDtmfDto`) must use `class-validator` decorators (`@IsString`, `@MaxLength`) exactly like every existing DTO in `dto/callcenter-*.dto.ts` |
| V6 Cryptography | No | Not applicable - no secrets/crypto introduced this phase |

### Known Threat Patterns for this stack

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|-----------------------|
| Cross-tenant contact leakage (`cc_contacts` missing `user_uid` filter) | Information Disclosure | Every service method must filter `where: { user_uid: userUid }`, per backend ARCHITECTURE's multi-tenant checklist - copy the exact pattern from `cc_missed_calls`/`CallCenterService.getMissedCalls` |
| Ownership bypass on contact edit/delete (operator edits another operator's contact via crafted `uid`) | Elevation of Privilege | Service-layer check: `where: { uid, user_uid: userUid, ...(isSupervisor ? {} : { created_by: userId }) }` before update/destroy - never rely on frontend hiding the edit button alone (UI-SPEC already notes this: "operator sees them only on rows they own" is a *rendering* rule, not a security boundary by itself) |
| Client-supplied dial target injection via new `sendDtmf`/registration-state endpoints | Tampering | Reuse the existing `(target || '').replace(/[^\d+*#]/g, '')` sanitization pattern from `originateDial` for any new digit/target input; validate `uniqueid`/`channel` ownership against the caller's own active call exactly like `agentHold`/`agentHangup` already do (`stateService.getCall(agent.currentCall)` ownership chain) |
| AMI action injection via unsanitized DTMF digit string | Tampering | `PlayDTMF`'s `Digit` parameter must be validated as a single character from `[0-9*#A-D]` before being passed to `AmiService.action()` - do not pass raw user input directly into the AMI action payload |

## Sources

### Primary (HIGH confidence - direct codebase reads this session)
- `packages/frontend/src/features/callcenter/lib/useWebRTCPhone.ts` - full WebRTC call-control implementation
- `packages/frontend/src/features/callcenter/ui/SoftphoneWidget/SoftphoneWidget.tsx` - current chrome/fab dual-variant shell
- `packages/frontend/src/pages/CallCenterAgentPage/CallCenterAgentPage.tsx` - orchestrator, `isWebrtc` branching, shift restore logic
- `packages/backend/src/modules/callcenter/callcenter.controller.ts` + `callcenter.service.ts` - all existing AMI-backed call-control endpoints, `getOperatorCallHistory`, `getTransferDirectory`, `originateDial`
- `packages/backend/src/modules/callcenter/callcenter-presence.service.ts` - DeviceState/ExtensionState -> presence SSE
- `packages/backend/src/modules/callcenter/models/{queue-call,missed-call,cc-settings}.model.ts` - schema shapes for Journal source data and the `cc_contacts` template
- `packages/backend/src/modules/phonebooks/{phonebook,phonebook-entry}.model.ts` - confirms Phase 5 phonebooks are the wrong shape for D-15
- `packages/frontend/src/features/callcenter/ui/{TransferDirectory,CallHistoryPanel,CallQualityIndicator}/*.tsx` + `lib/useAudioDevices.ts` - existing reusable UI/data surfaces
- `packages/frontend/src/features/callcenter/lib/{shiftSession,useCallCenterSSE}.ts` - sessionStorage and SSE cache-patch idioms
- `.planning/phases/10-full-softphone/{10-CONTEXT,10-UI-SPEC,10-BRIEF}.md`, `.planning/phases/09-call-center-agent-panel/09-CONTEXT.md`, `.planning/{REQUIREMENTS,STATE,ROADMAP}.md`
- `packages/frontend/.idea/ARCHITECTURE.md`, `packages/backend/.idea/ARCHITECTURE.md`

### Secondary (MEDIUM confidence)
- None - no external web/docs lookups were performed this session (no MCP research providers - context7/exa/tavily/etc - were available in this environment's server catalog; all findings are grounded directly in the local codebase, which is authoritative for a brownfield extension phase like this one).

### Tertiary (LOW confidence)
- A1 (`PlayDTMF` AMI action shape) and A3 (DeviceState/ExtensionState field names) - both inherited `[ASSUMED]` from Phase 9's own research/execution notes, not independently re-verified against a live Asterisk instance this session (no PBX access available in this research environment).

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH - zero new dependencies, all versions read directly from `package.json`
- Architecture: HIGH - every pattern cited traces to a specific file/line read this session; the one net-new pattern (`useSipPhoneAmi`) is explicitly modeled on an existing, working sibling (`useWebRTCPhone`)
- Pitfalls: HIGH - all 6 pitfalls are backed by a specific grep/read finding (missing SSE emit, missing SIP-mode mount, dual mode-detection heuristics, missing segment tabs, multi-file fab references, missing settings column), not speculation
- AMI action shapes (`PlayDTMF`, DeviceState/ExtensionState field names) - LOW, inherited assumption, needs live-PBX checkpoint during execution

**Research date:** 2026-07-24
**Valid until:** 30 days (stable brownfield codebase, no fast-moving external dependency in scope)
