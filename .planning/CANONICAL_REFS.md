# Canonical References — Krasterisk v4

**Обязательно для всех GSD-фаз** (discuss → plan → execute). Downstream-агенты MUST READ перед планированием и реализацией.

## Архитектура (главные документы)

| Область | Путь | Содержание |
|---------|------|------------|
| **Frontend** | `packages/frontend/.idea/ARCHITECTURE.md` | React 19, FSD, Tailwind + shadcn, RTK Query, i18n, структура `src/` |
| **Backend** | `packages/backend/.idea/ARCHITECTURE.md` | NestJS 11, модули, Sequelize, AMI/ARI, API-конвенции |

## Монорепо

| Путь | Содержание |
|------|------------|
| `package.json` (root) | Workspaces, npm scripts (`test`, `lint`, `dev:*`) |
| `packages/shared/` | Общие типы и DTO |

## Модульная документация (локально)

Папка `.docs/` (в gitignore) — `*_MODULE.md` по доменам (MOH, IVR, Queues…). При работе над модулем подключать соответствующий файл в discuss.

## GSD

| Путь | Содержание |
|------|------------|
| `GSD_GUIDE.md` | Как вызывать `/gsd-*` |
| `.planning/PROJECT.md` | Scope и решения проекта |
| `.planning/REQUIREMENTS.md` | REQ-* |

---
*Этот файл — единый индекс. В каждой фазе discuss копирует релевантные строки в `*-CONTEXT.md` → `<canonical_refs>`.*
