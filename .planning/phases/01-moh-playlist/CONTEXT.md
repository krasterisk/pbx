# Phase 1: MOH playlist — Context

**Gathered:** 2026-06-04  
**Status:** Ready for planning

<canonical_refs>
## Canonical References

**Downstream agents MUST read before planning or implementing.**

### Architecture
- `packages/frontend/.idea/ARCHITECTURE.md` — FSD, shadcn, RTK Query, i18n
- `packages/backend/.idea/ARCHITECTURE.md` — NestJS modules, Sequelize, AMI

### MOH
- `.idea/MOH_MODERN_DELTA_PRD.md` — delta scope
- `packages/backend/src/modules/moh/` — existing backend
- `packages/frontend/src/features/moh/` — existing frontend
</canonical_refs>

## Brownfield

Module exists at `packages/backend/src/modules/moh/` and `packages/frontend/src/features/moh/`.

## Changes only

1. `moh.service.ts`: `mode: 'playlist'`, drop `directory` on create; validate entries on create.
2. `moh-class.model.ts`: default mode playlist; update doc comment.
3. `PromptUploadModal.tsx`: remove moh UI and FormData field.
4. `MohFormModal.tsx`: disable submit if `playlist.length === 0`.
5. `moh.service.spec.ts`: create/update entry paths, empty entries rejected.
6. `.docs/MOH_MODULE.md`: playlist semantics.

## Do not

- Recreate moh.controller, MohTable, MohPage, mohApi from scratch.
- Add drag-and-drop in this phase (buttons up/down OK).
