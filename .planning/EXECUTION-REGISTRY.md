# Реестр координации инициатив

Указывает, где хранится владелец и текущее назначение; не дублирует ROADMAP/STATE и не является атомарной блокировкой. Порядок: [HYBRID-WORKFLOW](HYBRID-WORKFLOW.md).

| Инициатива | Каноническое состояние координации | Master roadmap |
|---|---|---|
| ai-products | [EXECUTION](initiatives/ai-products/EXECUTION.md) | [ROADMAP](initiatives/ai-products/ROADMAP.md) |
| autodial-refactor | [EXECUTION](AUTODIAL-REFACTOR-EXECUTION-2026-09-18.md) | [план рефакторинга](AUTODIAL-REFACTOR-PLAN-2026-09-18.md) |

Введён 2026-09-18. Существующие production/autodial/GSD tasks автоматически не переносились и не объявлены свободными. Перед записью в общие файлы сверять dirty baseline и writers. Если у другой инициативы уже есть registry/state, добавить ссылку на него, а не копировать все статусы.

| ci-repair | [EXECUTION](CI-REPAIR-EXECUTION.md) | Scoped test/lint/CI repair |
| ai-chat-widget | [EXECUTION](ai-chat-widget/EXECUTION.md) | [Scoped UI plan](ai-chat-widget/PLAN.md) |

| ac-reservations-fix | [EXECUTION/PLAN](AC-RESERVATIONS-FIX.md) | Scoped production schema repair |

| trunk-status-fix | [EXECUTION/PLAN](TRUNK-STATUS-FIX.md) | Trunk reachability UI |

| dialplan-callerid-name | [EXECUTION/PLAN](DIALPLAN-CALLERID-NAME.md) | Trunk labels and CallerID name |
| blf-support | [EXECUTION/PLAN](BLF-SUPPORT.md) | Optional tenant-isolated BLF and presence |
| endpoints-architecture | [EXECUTION/PLAN](ENDPOINTS-ARCHITECTURE-EXECUTION.md) | Endpoints UI architecture and audit repair |
| design-system-refresh | [EXECUTION/PLAN](DESIGN-SYSTEM-REFRESH-EXECUTION.md) | Centered errors, redesigned dark palette, AiChat launcher |
| context-defaults-aichat | [EXECUTION/PLAN](CONTEXT-DEFAULTS-AICHAT-EXECUTION.md) | Default contexts and platform assistant capability audit |
| routes-contexts-refactor | [EXECUTION/PLAN](ROUTES-CONTEXTS-REFACTOR-PLAN.md) | Ordered includes, route permissions removal and isolated live Asterisk tests |
| release-20261009 | [EXECUTION/PLAN](RELEASE-20261009.md) | Released 7acfa819; CI and authenticated production smoke PASS |
