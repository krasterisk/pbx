---
sketch: 005
name: module-marketplace-billing
question: "How should ghost Locked modules and billing-skeleton checkout feel in Hub E + mobile B?"
winner: null
tags: [marketplace, billing, phase-8]
phase: 08
---

# Sketch 005: Module marketplace & billing skeleton

## Design Question

Как выглядят **Locked / ghost** модули и **каркас покупки** (не полный PCI store): из Hub list (002-E), с mobile bottom bar (004-B)? Tenant admin включает/покупает; platform catalog — отдельно (006).

## How to View

`.planning/sketches/005-module-marketplace-billing/index.html`

## Variants

- **A: Inline Locked row + sheet checkout** — Lock badge on list row; tap → bottom sheet with plan + «Купить» skeleton.
- **B: Marketplace section in Hub** — Separate «Marketplace» block under Active modules; dedicated purchase page.
- **C: Modal store card** — Rich module card modal (features, price, license status) + checkout steps.

## What to Look For

- Upsell clarity without cluttering Hub E minimalism
- Distinguish Locked (need buy) vs Disabled (admin off)
- Checkout skeleton: plan → confirm → success (no real payment)
- Fit with tenant-admin vs super-admin split (006 next)

## Mapping to React (post-winner)

| Element | Target |
|---------|--------|
| licenseStatus UI | module registry + Hub list |
| Checkout skeleton | billing hooks / modal or sheet |
| Enable/disable | tenant module settings |
