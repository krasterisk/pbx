# Phase 10: Full Softphone - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-07-24
**Phase:** 10-full-softphone
**Areas discussed:** Journal ↔ History panel, Contacts catalog, Registration / Recover UX, Quality + device picker, Call-control ownership, Multi-call / park-switch

---

## Journal ↔ History panel

| Option | Description | Selected |
|--------|-------------|----------|
| Softphone only | Embed history only in Journal; remove ARM panel | |
| Both same component | Dual mount of one UX | |
| ARM History only | Softphone Journal slim/link | |
| Differentiated dual | Softphone = phone log; ARM History = operator tool | ✓ |

**User's choice:** Dual surfaces that **differ**: Softphone Journal = classic in/out/missed log; ARM History = operator tool with segments, filters, entities.
**Notes:** Journal = in+out+missed feed; actions callback+CallCard; depth last N (CC setting, default 50); SSE live. History tabs Queue/Outbound/Personal (no Missed); period from existing CC setting; CallCard+phonebook; search fields per segment; keep existing History panel.

---

## Contacts catalog

| Option | Description | Selected |
|--------|-------------|----------|
| TransferDirectory only | Endpoints/queues/groups+BLF | |
| TransferDirectory + phonebooks | Plus Phase 5 books | |
| Phonebooks only | | |
| TransferDirectory + shared tenant book | Outbound + inbound name lookup | ✓ |

**User's choice:** TransferDirectory + shared tenant contact book; operator add + edit/delete own; supervisor/admin full CRUD; unified search + Recents/Endpoints/Queues/Groups/Book.
**Notes:** Storage implementation deferred to research (Phase 5 reuse vs new).

---

## Registration / Recover UX

| Option | Description | Selected |
|--------|-------------|----------|
| Silent auto + Recover after timeout | | ✓ |
| Always show Recover when offline | | |
| Auto only, no Recover | | |

**User's choice:** Silent auto-reconnect + registering; Recover after timeout; F5 restore shift+REGISTER; trigger online/registering/offline; sessionStorage dial+last.

---

## Quality + device picker

| Option | Description | Selected |
|--------|-------------|----------|
| Compact in trigger + details in Dial | | ✓ |
| Dial only | | |
| Color badge only | | |

**User's choice:** Compact quality + Dial details; visual warning only; device picker in softphone; mid-call switch allowed.

---

## Call-control ownership

| Option | Description | Selected |
|--------|-------------|----------|
| Bar essentials + Softphone full | Shared handlers | ✓ |
| Softphone-only controls | | |
| 1:1 duplicate essentials | | |

**User's choice:** Essentials in status-bar; full in softphone; TransferDirectory modal for transfer; Contacts = click-to-call; **remove fab variant entirely**; auto-answer/zip chrome parity.

---

## Multi-call / park-switch

| Option | Description | Selected |
|--------|-------------|----------|
| Keep OOS (single call) | | ✓ |
| Park list as pseudo multi-call | | |
| Full multi-line | | |

**User's choice:** Multi-line OOS → Deferred Ideas; second incoming = existing queue/RONA/missed; park/retrieve keep Phase 9.

---

## Claude's Discretion

- Contact book storage model (Phase 5 phonebooks vs new CC entity)
- Recover timeout duration
- Exact SSE events for Journal live update

## Deferred Ideas

- Full multi-line / multi-call UI — future phase
- Video softphone
- CRM beyond CallCard + phonebook
- Capacitor native softphone
- Per-queue auto-answer / custom zip sounds
