# Phase 3: IVR page & form modal UI alignment

**Roadmap:** `.planning/ROADMAP.md` → Phase 3  
**Requirements:** REQ-201 … REQ-206

## Цель

Привести `IvrsPage` и `IvrFormModal` к `packages/frontend/.idea/ARCHITECTURE.md`. Исправить UX-баги: вкладка «Записи» сливается с фоном; двойная полоса под табами (сейчас Tailwind `border-b` на `HStack` + `border-b-2` на `Button`).

**Эталон табов:** `packages/frontend/src/features/routes/ui/RouteFormModal/RouteFormModal.module.scss` (`.tabs` / `.tab` / `.tabActive` / `.body`).

**Эталон страницы:** `packages/frontend/src/pages/MohPage/` (после Phase 2).

## Файлы (ожидаемые при execute)

| Приоритет | Путь |
|-----------|------|
| P0 | `packages/frontend/src/features/ivrs/ui/IvrFormModal/IvrFormModal.tsx` + `IvrFormModal.module.scss` (новый) |
| P0 | `packages/frontend/src/features/ivrs/ui/IvrPromptsEditor/IvrPromptsEditor.module.scss` |
| P1 | `packages/frontend/src/pages/IvrsPage/IvrsPage.tsx` + `IvrsPage.module.scss` (новый) |
| P2 | `packages/frontend/src/features/ivrs/ui/IvrsTable/IvrsTable.tsx` — только если нужен wrapper в Card |

## Команды GSD

```text
/gsd-discuss-phase 3
/gsd-ui-phase 3
/gsd-plan-phase 3
/gsd-execute-phase 3
/gsd-ui-review 3
/gsd-verify-work 3
```

## Подсказка для discuss

1. IvrsPage: полный паритет с MohPage (Card + header) или минимальный scope только modal?
2. Табы: копировать SCSS RouteFormModal 1:1 или обобщить позже в `shared/ui`?
3. `IvrMenuItemsEditor`: трогать в этой фазе или только `IvrPromptsEditor`?
4. Убрать `motion.div` на странице (как MOH Phase 2)?
