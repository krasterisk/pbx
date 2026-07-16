# Krasterisk v4 — инструкции для агента

## Проект

- Монорепо: `packages/backend` (NestJS), `packages/frontend` (React FSD), `packages/shared`
- **Архитектура (MUST READ):**
  - `packages/frontend/.idea/ARCHITECTURE.md`
  - `packages/backend/.idea/ARCHITECTURE.md`
- Индекс для GSD: `.planning/CANONICAL_REFS.md`
- Модули: `.docs/*_MODULE.md` (локально)

## GSD Core

Установлен локально: `.cursor/` (v1.3.0). Команды в чате Cursor: `/gsd-*`.

| Шаг | Команда |
|-----|---------|
| Индекс (после клонирования) | `/gsd-map-codebase` |
| PRD delta MOH | `@.idea/MOH_MODERN_DELTA_PRD.md` |
| Discuss / Plan / Execute / Verify | `/gsd-discuss-phase 1` … `/gsd-verify-work 1` |

Артефакты: `.planning/`. Инструкция: **`GSD_GUIDE.md`**. MOH pipeline: `.docs/GSD_CORE_PIPELINE_MOH.md`.

**Sketch findings:** UI для `/moh` (Phase 2) и Module Hub / shell / marketplace / platform admin (Phase 8) — читать skill `sketch-findings-krasterisk-v4` (`.cursor/skills/sketch-findings-krasterisk-v4/SKILL.md`).

## Verify перед «готово»

```bash
npm run lint
npm run test:backend
npm run test:frontend
```
