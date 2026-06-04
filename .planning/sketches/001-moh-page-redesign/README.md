---
sketch: 001
name: moh-page-redesign
question: "Which MohPage layout and CTA treatment should we ship for Phase 2?"
winner: null
tags: [moh, page, table, phase-2]
phase: 02
---

# Sketch 001: MohPage redesign

## Design Question

Какой визуальный и layout-паттерн страницы MOH внедряем после Phase 2 discuss (`02-CONTEXT.md`)?

## How to View

Open in browser:

`c:\Users\Professional\WebstormProjects\krasterisk_v4\.planning\sketches\001-moh-page-redesign\index.html`

Or from repo root: `.planning/sketches/001-moh-page-redesign/index.html`

## Variants

- **A: Safe — Glass card** — VoiceRobots-like: indigo icon badge, gradient title, `shadow-primary` CTA, glass `Card` + `CardHeader` «Список классов MOH», table inside card.
- **B: Bold — Full-bleed table** — No outer card; subtitle line «3 активных»; **outline** CTA (larger); table in bordered shell only.
- **C: Bold — Hero band** — Indigo gradient hero with mini stats (классов / треков / playlist); **indigo filled** CTA in hero; elevated card below with section header.

## What to Look For

- Header readability on mobile (toolbar: 375px)
- CTA prominence vs noise (three different styles per CONTEXT D-03)
- Card vs full-bleed: where `MohTable` shell should live in React
- Fit with existing table badges (`tracks`, `sort_random` / `sort_alpha`)
- MOH identity without cloning VoiceRobots 1:1

## Mapping to React (post-winner)

| Element | Target |
|---------|--------|
| Page header | `MohPage.tsx` |
| Card / table shell | `MohPage.tsx` and/or `MohTable.tsx` per winner |
| i18n | `moh.title`, `moh.subtitle`, `moh.add`, new key for section title if A/C |
