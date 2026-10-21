---
phase: 02
slug: moh-page-redesign
status: draft
nyquist_compliant: true
wave_0_complete: true
created: 2026-06-04
---

# Phase 2 — Validation Strategy

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Vitest (`@krasterisk/frontend`) |
| **Config file** | `packages/frontend/vitest.config.ts` |
| **Quick run command** | `npm run lint` |
| **Full suite command** | `npm run test:frontend` |
| **Estimated runtime** | ~60–120 seconds |

## Sampling Rate

- **After every task commit:** `npm run lint`
- **After every plan wave:** `npm run test:frontend`
- **Before `/gsd-verify-work`:** lint + test:frontend green
- **Manual:** `/moh` responsive check

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | Status |
|---------|------|------|-------------|-----------|-------------------|--------|
| 02-01-01 | 01 | 1 | REQ-105 | lint | `npm run lint` | ⬜ pending |
| 02-01-02 | 01 | 1 | REQ-103,104 | lint | `npm run lint` | ⬜ pending |
| 02-01-03 | 01 | 1 | REQ-103,105 | lint | `npm run lint` | ⬜ pending |
| 02-02-01 | 02 | 1 | REQ-103 | lint | `npm run lint` | ⬜ pending |
| 02-02-02 | 02 | 1 | REQ-106 | full | `npm run test:frontend` | ⬜ pending |

## Wave 0 Requirements

Existing infrastructure covers phase requirements (no new test files required).

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Instructions |
|----------|-------------|------------|----------------|
| Visual match sketch A | REQ-102 | Visual | Open `/moh`: indigo badge, gradient title, shadow CTA, card header |
| Responsive header | REQ-105 | Layout | 375px: stacked header, full-width CTA |
| Playlist buttons | REQ-103 | UX | Open create modal: icon buttons for reorder/remove |
