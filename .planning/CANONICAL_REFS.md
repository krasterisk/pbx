# Canonical References — Krasterisk v4

**Обязательно для всех GSD-фаз** (discuss → plan → execute). Downstream-агенты MUST READ перед планированием и реализацией.

**Порядок управления:** [HYBRID-WORKFLOW](HYBRID-WORKFLOW.md), [EXECUTION-REGISTRY](EXECUTION-REGISTRY.md). Один координатор и явно назначенный PLAN на задание; Codex-direct и GSD-workflow не запускают независимые цепочки одной фазы. AI-продукты: [текущее назначение](initiatives/ai-products/EXECUTION.md).

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

### Инициатива AI-продуктов (2026-09-18)

[AI-роботы и речевая аналитика](initiatives/ai-products/README.md): аудит Krasterisk/aiPBX, продуктовые SPEC, архитектура, recording integration, roadmap AI-00…11 и план первого этапа. Статус **planned**; существующие фазы и production readiness не заменяет. Для этих продуктов читать [ROADMAP](initiatives/ai-products/ROADMAP.md) и [ARCHITECTURE](initiatives/ai-products/ARCHITECTURE.md).

Требование выбора **PostgreSQL или MySQL** для приложения и Asterisk: [DATABASE-PORTABILITY](initiatives/ai-products/DATABASE-PORTABILITY.md), DBR-01…08. Первый implementation slice: [DB-01-PLAN](initiatives/ai-products/DB-01-PLAN.md), параллельно AI-00. Старые MySQL-only допущения инициативы заменены этим контрактом; runtime поддержка PostgreSQL ещё не подтверждена.

| Путь | Содержание |
|------|------------|
| `GSD_GUIDE.md` | Как вызывать `/gsd-*` |
| `.planning/PROJECT.md` | Scope и решения проекта |
| `.planning/REQUIREMENTS.md` | REQ-* |

---
*Этот файл — единый индекс. В каждой фазе discuss копирует релевантные строки в `*-CONTEXT.md` → `<canonical_refs>`.*
