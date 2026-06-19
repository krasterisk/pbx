# Krasterisk v4

## What This Is

IP PBX Krasterisk v4 — веб-интерфейс и API для управления Asterisk: монорепо NestJS + React FSD, multi-tenant, Realtime ARA.

## Core Value

Надёжное управление телефонией через понятный UI и предсказуемый API без нарушения изоляции тенантов.

## Canonical References

**MUST READ** перед discuss / plan / execute (полный индекс: `.planning/CANONICAL_REFS.md`):

- `packages/frontend/.idea/ARCHITECTURE.md` — FSD, UI-kit (Tailwind + shadcn), страницы, i18n, таблицы
- `packages/backend/.idea/ARCHITECTURE.md` — NestJS-модули, Sequelize, AMI, эндпоинты, guards

Любая фича с UI **следует frontend ARCHITECTURE**; любая фича с API/БД — **backend ARCHITECTURE**.

## Constraints

- **Tech stack**: Node 20+, NestJS 11, React 19, Sequelize, MySQL (Asterisk Realtime)
- **Frontend layout**: Feature-Sliced Design; не дублировать shared UI
- **Tenant isolation**: `user_uid` / `vpbx_user_uid` на всех доменных операциях
- **Verify**: `npm run lint`, `npm run test:backend`, `npm run test:frontend` перед ship

## Context

Текущий активный milestone (пример): MOH playlist migration — см. `.idea/MOH_MODERN_DELTA_PRD.md`, `.planning/ROADMAP.md`.

Brownfield: код и модули уже существуют; GSD-планы только **delta**, не greenfield CRUD.

## Key Decisions

| Decision | Rationale | Outcome |
|----------|-----------|---------|
| ARCHITECTURE.md в `packages/*/\.idea/` | Раздельные правила FE/BE | ✓ Good |
| GSD canonical refs в `.planning/` | discuss-phase читает PROJECT + ROADMAP | ✓ Good |

---
*Last updated: 2026-06-04 — canonical architecture refs for GSD*
