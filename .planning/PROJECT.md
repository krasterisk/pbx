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
| Кастомная голосовая почта вместо `VoiceMail()` | Record + hangup CURL + Nest notify/STT/LLM; ActionType остаётся `voicemail` | ✓ Phase 13 |
| Гость конференции — ephemeral PJSIP в `krsk-conf-{uid}` | Скомпрометированный токен не даёт выход в тенантный `from-internal` | ✓ Phase 16.1 |
| Ёмкость комнаты = `min(тариф, бюджет потоков)` одним числом | Отказ 409, без «пустить без видео» | ✓ Phase 16.1 |
| Revoke гостя = stamp + ConfbridgeKick + destroy triple | Не только `revoked_at` | ✓ Phase 16.1 |

---
*Last updated: 2026-09-16 after Phase 16.1*
