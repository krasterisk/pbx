# Canonical References — Krasterisk v4

Supervisor Pulse: [accepted PLAN r1](plans/supervisor-pulse/PLAN.md), [EXECUTION](plans/supervisor-pulse/EXECUTION.md). Explicit user assignment for the minimal supervisor UI, personal team, unified status menu and queue-management Sheet; `/root` chat01a16857, codex-direct.

**Обязательно для всех GSD-фаз** (discuss → plan → execute). Downstream-агенты MUST READ перед планированием и реализацией.

**Порядок управления:** [HYBRID-WORKFLOW](development/HYBRID-WORKFLOW.md), [EXECUTION-REGISTRY](plans/EXECUTION-REGISTRY.md). Один координатор и явно назначенный PLAN на задание; Codex-direct и GSD-workflow не запускают независимые цепочки одной фазы. AI-продукты: [текущее назначение](plans/initiatives/ai-products/EXECUTION.md).

## Архитектура (главные документы)

| Область | Путь | Содержание |
|---------|------|------------|
| **Frontend** | `packages/frontend/.idea/ARCHITECTURE.md` | React 19, FSD, Tailwind + shadcn, RTK Query, i18n, структура `src/` |
| **Backend** | `packages/backend/.idea/ARCHITECTURE.md` | NestJS 11, модули, Sequelize, AMI/ARI, API-конвенции |

## Монорепо

CDR refinements: [current PLAN](plans/cdr-reports-ux/PLAN.md), [EXECUTION](plans/cdr-reports-ux/EXECUTION.md), [current results](plans/cdr-reports-ux/R12-SUMMARY.md), [R11 baseline](plans/cdr-reports-ux/R11-SUMMARY.md). Coordinator /root, codex-direct; current regional/settings continuation completed: atomic save, searchable timezone and deployment-aware tabs, client permanently Asia/Krasnoyarsk. Completed index coverage, bounded projection throughput and actual text/group search verification retained. R11 compact filters and R9 widget/timezone results remain the baseline.

Shared table design/search/export assignment: [EXECUTION](plans/table-ui-standardization/EXECUTION.md), [PLAN](plans/table-ui-standardization/PLAN.md), codex-direct /root, current revision 2026-10-13-r6 (one shared selection toolbar, no duplicate selection banners). Existing endpoint design is the UI baseline; adjacent completed initiatives remain unchanged.

Autodial UX/CRM/AI: [REPORT](plans/autodial-ux-audit/REPORT.md), [EXECUTION](plans/autodial-ux-audit/EXECUTION.md),
[VERIFICATION](plans/autodial-ux-audit/VERIFICATION.md), [RELEASE](plans/autodial-ux-audit/RELEASE.md). /root, codex-direct.
Released4.7.1.1 on ipbx/v4, source427a5059; deployed password-login AI apply/preflight/internal customer-data speech PASS.
CI/receiving-call recording/cleanup evidence in RELEASE; existing Yandex64 auth remains unverified.

Fresh supervisory audit2026-10-18: [REPORT U01–U40](plans/autodial-ux-audit/supervisor-review-20261018/REPORT.md), [PLANr2](plans/autodial-ux-audit/supervisor-review-20261018/PLAN.md), [final verification](plans/autodial-ux-audit/supervisor-review-20261018/VERIFICATION.md). Final source29 implementation/available live gates accepted:89targeted,474frontendfiles2598tests,lint/types/Vite; additional current backend4810PASS27skip. Exact own LAN/local fixtures fully cleaned. Full UX acceptance remains partial only for unsupported true200% and locked SA-dashboard benchmark; actual reduced-motion/CallCenter comparison passed. No active writers/CI/helpers or new publication. [HANDOFF](plans/autodial-ux-audit/supervisor-review-20261018/HANDOFF.md).

| Путь | Содержание |
|------|------------|
| `package.json` (root) | Workspaces, npm scripts (`test`, `lint`, `dev:*`) |
| `packages/shared/` | Общие типы и DTO |

## Модульная документация (локально)

Папка `.docs/` (в gitignore) — `*_MODULE.md` по доменам (MOH, IVR, Queues…). При работе над модулем подключать соответствующий файл в discuss.

## GSD

### Инициатива AI-продуктов (2026-09-18)

[AI-роботы и речевая аналитика](plans/initiatives/ai-products/README.md): аудит Krasterisk/aiPBX, продуктовые SPEC, архитектура, recording integration, roadmap AI-00…11 и план первого этапа. Статус **planned**; существующие фазы и production readiness не заменяет. Для этих продуктов читать [ROADMAP](plans/initiatives/ai-products/ROADMAP.md) и [ARCHITECTURE](plans/initiatives/ai-products/ARCHITECTURE.md).

Требование выбора **PostgreSQL или MySQL** для приложения и Asterisk: [DATABASE-PORTABILITY](plans/initiatives/ai-products/DATABASE-PORTABILITY.md), DBR-01…08. Первый implementation slice: [DB-01-PLAN](plans/initiatives/ai-products/DB-01-PLAN.md), параллельно AI-00. Старые MySQL-only допущения инициативы заменены этим контрактом; runtime поддержка PostgreSQL ещё не подтверждена.

| Путь | Содержание |
|------|------------|
| `GSD_GUIDE.md` | Как вызывать `/gsd-*` |
| `docs/PROJECT.md` | Scope и решения проекта |
| `docs/REQUIREMENTS.md` | REQ-* |

---
*Этот файл — единый индекс. В каждой фазе discuss копирует релевантные строки в `*-CONTEXT.md` → `<canonical_refs>`.*

Текущее bounded assignment: [Context defaults / AiChat EXECUTION](plans/legacy/CONTEXT-DEFAULTS-AICHAT-EXECUTION.md),
codex-direct `/root`; [фактический аудит возможностей](plans/legacy/AICHAT-CAPABILITY-AUDIT.md).

Текущее поручение маршрутов/контекстов: [PLAN / EXECUTION](plans/legacy/ROUTES-CONTEXTS-REFACTOR-PLAN.md),
codex-direct `/root`, ordered includes + live Asterisk validation; replaces prior
context UI follow-up as the current assignment in this chat.

Поручение этого чата реализовано, автоматические проверки пройдены, visual tool-unavailable: [унификация модалок / EXECUTION](plans/modal-ui-standardization/EXECUTION.md), [PLAN](plans/modal-ui-standardization/PLAN.md), codex-direct /root, 2026-10-10-r1. Маршруты/контексты остаются baseline завершённого предыдущего scope.

Mobile navigation: [EXECUTION](plans/mobile-navigation/EXECUTION.md), [PLAN](plans/mobile-navigation/PLAN.md), [SUMMARY](plans/mobile-navigation/SUMMARY.md), codex-direct /root, 2026-10-11-r11. N19 catalog-aware login/root fallback and working footer section Sheet implemented; automated/local mocked browser gates PASS. Prior revisions retained; human/device gates pending. Adjacent endpoints work excluded.

PBX Dashboard: [EXECUTION](plans/pbx-dashboard/EXECUTION.md), [PLAN](plans/pbx-dashboard/PLAN.md), [SUMMARY](plans/pbx-dashboard/SUMMARY.md), [LIVE-REVIEW](plans/pbx-dashboard/LIVE-REVIEW.md); codex-direct /root, 2026-10-11-r3 implemented/automated-tests-passed/isolated ordinary-call live-verified; working AI/full autodial engine/dedicated PBX load/release pending.

Helpdesk chat R29: [ownership/evidence](plans/helpdesk-chat/EXECUTION.md), existing aiChatApi/AssistantPanel + tenant-bound proxy. Canonical implementation plan remains in sibling aiPBX-helpdesk/docs/PLAN.md revision29; other initiatives unchanged.

Dashboard binlog optimization: [PLAN D8](plans/pbx-dashboard/PLAN.md), [REPORT / handoff](plans/pbx-dashboard/binlog-optimization/REPORT.md), completed bounded user assignment2026-10-18; deployed a7440544, source branch local only. Prior gates retained.

Artifact storage maintenance: [PLAN](plans/artifact-storage/PLAN.md), [EXECUTION](plans/artifact-storage/EXECUTION.md); [REPORT](plans/artifact-storage/REPORT.md), codex-direct /root chat01a15cc9, storage migration completed; product initiatives unchanged.


## Repository layout

[Правила хранения](development/REPOSITORY-LAYOUT.md). `.planning/` — локальная игнорируемая рабочая область; канонические документы перечислены здесь. Исторические GSD-фазы: [архив](archive/gsd/README.md). Структурная миграция: [PLAN](plans/repository-layout/PLAN.md).
