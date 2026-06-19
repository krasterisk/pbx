# Codebase snapshot (manual, pre-/gsd-map-codebase)

Generated for GSD bootstrap. Re-run `/gsd-map-codebase` for full intel.

## Stack

- Root workspaces: `@krasterisk/shared`, `@krasterisk/backend`, `@krasterisk/frontend`
- Backend: NestJS 11, Sequelize, AMI (`AmiService`)
- Frontend: React 19, Vite, FSD, RTK Query, Tailwind/shadcn

## MOH paths

| Layer | Path |
|-------|------|
| Backend | `packages/backend/src/modules/moh/` |
| API | `GET/POST /api/moh`, `PUT/DELETE /api/moh/:name` |
| Frontend feature | `packages/frontend/src/features/moh/` |
| Page | `packages/frontend/src/pages/MohPage/` |
| API client | `packages/frontend/src/shared/api/endpoints/mohApi.ts` |

## Conventions

- Tenant: `user_uid` / `vpbx_user_uid` on requests
- i18n: `packages/frontend/src/shared/config/locales/`
- Tests: `npm run test:backend`, `npm run lint`

## Current MOH gap

- Service uses `mode: 'files'` and sets `directory`
- Target: `mode: 'playlist'` per `.idea/MOH_MODERN_PLAN.md`
