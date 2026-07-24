# Phase 10: Full Softphone (WebRTC dial / journal / contacts) - Context

**Gathered:** 2026-07-24
**Status:** Ready for planning

<domain>
## Phase Boundary

Полнофункциональный softphone как отдельный продуктовый контур внутри АРМ оператора в **двух режимах**: WebRTC (браузер) и SIP (внешний аппарат / PJSIP endpoint). Один chrome UI (Dial / Journal / Contacts, call features); в WebRTC — медиа в браузере + sip.js; в SIP — медиа на аппарате, управление максимально аналогично через **AMI**. Вшит в chrome (status strip / header), без плавающего FAB.

**In scope:**
1. Softphone chrome shell (collapsed trigger · expanded panel · mobile sticky + sheet)
2. Dial — dialpad, click-to-call bridge, DTMF, redial, dial buffer/last number persistence
3. Softphone Journal — классический телефонный лог (не путать с ARM History panel)
4. Softphone Contacts — TransferDirectory + общая книга контактов тенанта
5. ARM History panel enhancement — сегменты Queue/Outbound/Personal, фильтры/поиск, CallCard + phonebook
6. Call-control ownership — status-bar essentials + softphone full set; remove FAB variant
7. Call quality indicator + mid-shift device picker (**WebRTC only**; hide in SIP mode)
8. Resilience — WebRTC: WSS/re-REGISTER; SIP: AMI endpoint state; Recover; F5 shift restore
9. Auto-answer + zip tone parity with chrome UX (WebRTC); SIP — AMI-equivalent where applicable
10. Dual-mode softphone: WebRTC path + SIP/AMI path (outbound = callback на внутренний номер)
11. i18n ru/en; a11y keyboard dial + ARIA tabs

**Out of scope:**
- Video softphone
- Embedded CRM beyond CallCard + phonebook contact open/edit
- Multi-line / multi-call UI (hold A / answer B / switch) — deferred
- Native Capacitor softphone (Phase 8 Android track)
- Missed-call claim/callback/resolve workflow (остаётся в MissedCalls tool)

</domain>

<decisions>
## Implementation Decisions

### Journal ↔ History (два разных инструмента)
- **D-01:** Softphone Journal и ARM History panel — **разные продукты**, не два mount одного UX.
- **D-02:** Softphone Journal = классический лог **in + out + missed** одной лентой с иконками направления (как в телефоне).
- **D-03:** Действия Journal: **callback/redial + открыть CallCard** (не полный History parity).
- **D-04:** Глубина Journal = **последние N звонков**; N задаётся в настройках call-центра; **default N=50**.
- **D-05:** Journal обновляется **live через SSE invalidate/prepend** после завершения звонка.
- **D-06:** ARM History = **существующая панель/карточка History** в АРМ (Phase 9 visibility); не переносить в softphone-only.
- **D-07:** History сегменты-вкладки: **Очередь (in) · Исходящие · Персональные**. Сегмента «Пропущенные» **нет** — claim/callback/resolve только в MissedCalls.
- **D-08:** Период History — **следовать существующей настройке CC** (смена / сутки / оба); не изобретать отдельный дефолт.
- **D-09:** History: CallCard + **открытие/редактирование phonebook-контакта**, если номер найден.
- **D-10:** Быстрый поиск History: для **очереди** — номер, имя, очередь; для **исходящих/персональных** — номер, имя, статус (отвечен / не отвечен).

### Contacts catalog
- **D-11:** База Contacts = **TransferDirectory** (абоненты / очереди / группы + BLF) **+ общая книга контактов тенанта**.
- **D-12:** Общая книга: используется для **исходящих из softphone** и для **lookup имени на последующих входящих**.
- **D-13:** Права книги: оператор — **add + edit/delete только своих**; supervisor/admin — **полный CRUD**. — **Reversibility:** costly — права/ownership полей на записях.
- **D-14:** Softphone Contacts UI: **единый поиск** + секции **Недавние · Абоненты · Очереди · Группы · Книга**.
- **D-15 [Claude's discretion]:** Storage реализации книги (reuse Phase 5 phonebooks vs новая CC-сущность) — research/plan; продуктовое поведение зафиксировано D-11…D-14.

### Registration / Recover UX
- **D-16:** Тихий **auto-reconnect** + индикатор «регистрируюсь…»; кнопка **Recover** только если авто не удалось за timeout.
- **D-17:** После F5 / возврата на вкладку: **восстановить смену из sessionStorage + auto re-REGISTER** без повторного Start shift.
- **D-18:** Softphone trigger states: **online · registering · offline** (+ Recover после таймаута).
- **D-19:** **sessionStorage**: dial buffer + last number (redial после F5).

### Quality + device picker
- **D-20:** Качество: **компактный индикатор** в status-bar / softphone trigger + **детали MOS/jitter/RTT/loss** в expanded Dial. Монтировать существующий `CallQualityIndicator` / `phone.quality`.
- **D-21:** Degraded UX = **только визуальный warning** (badge/toast); без авто-снижения bitrate / авто-действий.
- **D-22:** Device picker (mic/speaker) — в **softphone expanded**; без перелогина смены.
- **D-23:** Смена устройства **во время активного звонка разрешена сразу** (переключить трек/sink).

### Call-control ownership
- **D-24:** **Status-bar = essentials** (mute/hold/hangup/transfer); **Softphone Dial = full set** (DTMF, conference, park, warm, zombie, devices, quality). Один shared handler layer на page (усиливает Phase 9 D-03). — **Reversibility:** costly — раздвоение UI должно остаться на shared handlers.
- **D-25:** Transfer/conference target picker = **TransferDirectory в модалке/sheet** из call-control; вкладка Contacts = **только click-to-call** (не transfer mode).
- **D-26:** Вариант **`fab` удалить** из `SoftphoneWidget` полностью; на АРМ только chrome. — **Reversibility:** costly — удаление API/variant.
- **D-27:** Auto-answer + zip tone — **parity с chrome UX** (настройки/индикация видны из softphone); без новых режимов (per-queue / custom sounds).

### Multi-call
- **D-28:** Multi-line / multi-call UI — **out of scope** Phase 10 (single active call).
- **D-29:** Второй входящий при активном звонке — **текущее queue/RONA/missed поведение**; не вторая линия softphone.
- **D-30:** Park/retrieve — **оставить Phase 9** (role-gated в softphone full set + ParkedCallsIndicator).

### Dual mode: WebRTC + SIP/AMI
- **D-31:** Softphone работает в **двух режимах**: WebRTC (браузерный endpoint) и **SIP** (внешний клиент / аппаратный телефон на PJSIP). Режим определяется типом endpoint оператора на смене (как Phase 9 click-to-call branching). — **Reversibility:** costly — два transport path в одном UI.
- **D-32:** В SIP-режиме — **полный UI-пульт** (Dial / Journal / Contacts / call controls) максимально аналогичен WebRTC; **медиа на аппарате**; набор / ответ / hangup / hold / transfer / DTMF / park / conference — через **AMI** (не sip.js).
- **D-33:** Исходящая связь в SIP-режиме — **AMI callback/originate на внутренний номер оператора**, затем набор цели (существующий click-to-call / Call-Info pattern Phase 9 D-18/D-29); не WebRTC `makeCall`.
- **D-34:** В SIP-режиме **скрыть** call quality indicator и device picker (нет getStats / браузерных устройств).
- **D-35:** Trigger в SIP-режиме: **endpoint online / offline** по AMI DeviceState/ExtensionState; **Recover** = перезапрос AMI state (аналог re-REGISTER).

### Claude's Discretion
- D-15: конкретная модель хранения общей книги контактов (phonebooks Phase 5 vs CC table).
- Timeout значения для Recover (D-16) — разумный default на research/plan.
- Точные SSE events для Journal invalidate (D-05) — research.
- Точный mapping AMI actions ↔ softphone controls в SIP mode (D-32) — research; reuse Phase 9 call-control endpoints where possible.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Brief / prior decisions
- `.planning/phases/10-full-softphone/10-BRIEF.md` — product brief / success criteria
- `.planning/phases/09-call-center-agent-panel/09-CONTEXT.md` — D-03 call-control split; D-34…D-37 history/directory/BLF; note D-01 FAB **superseded** by Phase 10 chrome-only
- `.planning/phases/07-call-center-overhaul-professional-agent-supervisor-workspace/07-CONTEXT.md` — D-14 WebRTC full (quality + devices)
- `.planning/phases/05-phonebooks-ai-universal-directory-mechanisms-mcp-tools-and-c/05-CONTEXT.md` — candidate reuse for shared contact book (D-15)
- `.planning/phases/08-navigation-redesign-android-port-foundation/08-CONTEXT.md` — D-28 sticky softphone; Capacitor OOS here

### Architecture
- `packages/frontend/.idea/ARCHITECTURE.md` — FSD, shared/ui, i18n
- `packages/backend/.idea/ARCHITECTURE.md` — NestJS modules, AMI, API conventions
- `.idea/call-center/CC_WEBRTC_CONCEPT.md` — SIP.js + PJSIP WSS (если доступен локально)

### Primary code targets
- `packages/frontend/src/features/callcenter/ui/SoftphoneWidget/` — chrome softphone; remove fab
- `packages/frontend/src/features/callcenter/lib/useWebRTCPhone.ts` — SIP session, quality, reconnect
- `packages/frontend/src/features/callcenter/lib/useAudioDevices.ts` — mid-shift device picker
- `packages/frontend/src/features/callcenter/ui/CallQualityIndicator/` — mount quality UI
- `packages/frontend/src/features/callcenter/ui/AgentStatusBar/` — trigger + essentials
- `packages/frontend/src/features/callcenter/ui/CallControlBar/` — compact/full/extended
- `packages/frontend/src/features/callcenter/ui/CallHistoryPanel/` — ARM History tool
- `packages/frontend/src/features/callcenter/ui/TransferDirectory/` — Contacts directory + transfer modal
- `packages/frontend/src/features/callcenter/ui/MissedCallsPanel/` — sole missed workflow
- `packages/frontend/src/pages/CallCenterAgentPage/CallCenterAgentPage.tsx` — SIP owner / orchestrator
- `packages/backend/src/modules/callcenter/` — history, directory, presence, click-to-call, webrtc config

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `SoftphoneWidget` `variant="chrome"` + Dial/Journal/Contacts tabs (Journal/Contacts = placeholders today)
- `useWebRTCPhone` — register/answer/hangup/hold/mute/DTMF/transfer + getStats quality + soft re-REGISTER/transport reconnect
- `CallHistoryPanel` + `getOperatorCallHistory` — base for ARM History enhancements
- `TransferDirectory` modes `transfer` | `conference-add` | `call` + BLF via presenceUpdate SSE
- `CallQualityIndicator` — built, not mounted
- `useAudioDevices` — exists; currently login-only (ShiftLoginModal)
- `CallControlBar` compact/full/extended — status-bar vs softphone split already sketched

### Established Patterns
- Page owns single SIP session; SoftphoneWidget is render-only (`phone` prop)
- Click-to-call: API returns webrtc|pjsip → Redux `pendingOutboundDial` → softphone `makeCall`
- Shift restore already uses sessionStorage (`shiftSession`); extend for dial/last (D-19)
- FAB/placement removed from «Моя панель»; chrome is agent-page default

### Integration Points
- Wire Journal tab → slim phone-log component (new or slim CallHistory mode) with limit N
- Enhance CallHistoryPanel segments/search/phonebook actions (D-06…D-10)
- Contacts tab → TransferDirectory sections + shared book CRUD UI
- Mount CallQualityIndicator; expose device picker in SoftphoneWidget expanded
- Remove `fab` variant; surface registration state on chrome trigger
- CC settings: add Journal depth N; reuse existing period setting for History

</code_context>

<specifics>
## Specific Ideas

- Softphone Journal должен ощущаться «как обычный софтфон», а History panel — «инструмент оператора» с сущностями и фильтрами.
- Общая книга контактов — операторы наполняют; lookup имени на следующих звонках; исходящие из softphone.
- FAB больше не нужен даже как fallback — вычистить variant.
- Dual mode: внешний SIP-абонент = тот же chrome UX, транспорт AMI; исходящие = callback на внутренний номер.

</specifics>

<deferred>
## Deferred Ideas

- **Full multi-line / multi-call UI** (hold A, answer B, switch) — отдельная фаза (D-28).
- Video softphone.
- Embedded CRM screen-pop beyond CallCard + phonebook edit.
- Native Capacitor softphone (Phase 8 track).
- Per-queue auto-answer / custom zip sounds (explicitly not in D-27).

</deferred>

---

*Phase: 10-full-softphone*
*Context gathered: 2026-07-24*
