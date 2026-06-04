# Phase 2: Redesign MohPage UI

**Roadmap:** см. `.planning/ROADMAP.md` → Phase 2  
**Requirements:** REQ-101 … REQ-106

## Цель

Три варианта дизайна страницы MOH → выбор заказчика → одна реализация в React.

## Файлы (ожидаемые при execute)

| Приоритет | Путь |
|-----------|------|
| P0 | `packages/frontend/src/pages/MohPage/MohPage.tsx` |
| P1 | `packages/frontend/src/features/moh/ui/MohTable/MohTable.tsx` (+ `.module.scss` если есть) |
| P2 | `packages/frontend/src/shared/config/locales/ru.ts`, `en.ts` — ключи `moh.*` |

## Команды GSD (копировать)

```text
/gsd-discuss-phase 2
/gsd-sketch MohPage redesign: header with icon, title, subtitle, primary CTA, MohTable card. Follow @packages/frontend/.idea/ARCHITECTURE.md. Three distinct visual variants.
/gsd-sketch --wrap-up
/gsd-execute-phase 2
/gsd-ui-review 2
/gsd-verify-work 2
/gsd-ship 2
```

## Подсказка для discuss

Ответить на:

1. Три варианта — только layout/типографика или разная компоновка (карточка vs full-bleed table)?
2. Empty state: иллюстрация / текст / CTA?
3. Motion: сохранить текущий fade-in таблицы или упростить?
4. MohFormModal: полный редизайн — **нет**; **кнопки playlist editor** — **да** (см. `02-CONTEXT.md` D-14)
