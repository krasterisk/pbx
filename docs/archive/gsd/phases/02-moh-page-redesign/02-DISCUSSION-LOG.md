# Phase 2: MohPage redesign — Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in `02-CONTEXT.md`.

**Date:** 2026-06-04  
**Phase:** 02-moh-page-redesign  
**Areas discussed:** Visual sketch strategy, Table shell, Motion, MohFormModal

---

## Visual sketch strategy

| Option | Description | Selected |
|--------|-------------|----------|
| Skin only | One layout, three skins | |
| Different composition | 2+ layouts + one skin | |
| Safe + experiments | 1 VoiceRobots-like + 2 bolder | ✓ |
| Reference: VoiceRobots | Copy that page pattern | |
| Reference: current Moh/Numbers | Minimal header | |
| Reference: own MOH style | ARCHITECTURE-compliant, distinct | ✓ |
| CTA same as VoiceRobots | shadow-primary button | |
| CTA as today | plain Button | |
| CTA per sketch | compare at wrap-up | ✓ |
| Accent primary | text-primary icon | |
| Accent indigo | bg-indigo-500/10 | ✓ |
| Accent custom | emerald/violet | |

**User's choice:** 1-3, 2-3, 3-3, 4-2  
**Notes:** Safe baseline + two bold variants; MOH identity; CTA varies per sketch; indigo badge.

---

## Table shell

| Option | Description | Selected |
|--------|-------------|----------|
| Card in MohTable only | status quo | |
| Card on MohPage | table content only | |
| Varies in sketches | winner sets boundary | ✓ |
| CardHeader yes | section title like VoiceRobots | ✓ |
| CardHeader no | page header enough | |
| CardHeader in one sketch only | | |
| MohTable minimal | classNames/empty/loading | |
| MohTable loses Card | page owns shell | |
| MohTable scope | planner by winner | ✓ |
| No search/filter | phase 2 | |
| Search in sketch only | | |
| Search backlog | defer | ✓ |

**User's choice:** 1-3, 2-1, 3-3, 4-3  
**Notes:** CardHeader required in target design; MohTable refactor TBD from winner.

---

## Motion

| Option | Description | Selected |
|--------|-------------|----------|
| Remove page motion | like VoiceRobots | |
| Keep fade-in y:20 | current MohPage | |
| Motion in sketch only | winner decides page motion | ✓ |
| No row animation | | |
| Light fade opacity | no y | ✓ |
| Keep y:20 | | |
| Loading text | current | |
| Loading Skeleton | shared/ui | ✓ |
| Loading compare in sketch | | |
| prefers-reduced-motion enforce | | |
| Out of scope | | |
| Planner discretion | | ✓ |

**User's choice:** 1-3, 2-2, 3-2, 4-3

---

## MohFormModal

| Option | Description | Selected |
|--------|-------------|----------|
| No modal changes | page + MohTable only | |
| Minimal if broken | padding/typography | |
| Full modal redesign later | separate phase | ✓ |
| Minimal padding Dialog | | ✓ (with 2) |
| Minimal title/footer | | ✓ (with 2) |
| Nothing if touched | | |
| Playlist UI unchanged | | |
| i18n only | | |
| Playlist buttons in phase 2 | user override | ✓ |
| Deferred priority order | no preference | ✓ |

**User's choice:** 1-3; 2-1 and 2; 3 — change playlist buttons **in this phase**; 4 — any order for backlog  
**Notes:** Full shell redesign deferred; playlist action buttons (up/down/remove/add) are in scope for execute; DnD and full modal UX later.

---

## Claude's Discretion

- MohTable Card split per winner sketch
- prefers-reduced-motion
- Whether D-15 minimal modal padding/title/footer is needed after page work

## Deferred Ideas

- Full MohFormModal redesign
- Drag-and-drop playlist
- Table search/filter
- No priority among deferred items
