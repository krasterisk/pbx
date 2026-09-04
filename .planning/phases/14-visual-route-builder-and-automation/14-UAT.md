---
status: complete
phase: 14-visual-route-builder-and-automation
source: 14-01-SUMMARY.md, 14-02-SUMMARY.md, 14-03-SUMMARY.md, 14-04-SUMMARY.md, 14-05-SUMMARY.md, 14-06-SUMMARY.md, 14-07-SUMMARY.md, 14-08-SUMMARY.md, 14-09-SUMMARY.md, 14-10-SUMMARY.md
started: 2026-09-04T00:53:00Z
updated: 2026-09-04T03:24:00Z
---

## Current Test

[testing complete]

## Tests

### 1. Холодный старт после схем callback и шаблонов
expected: Перезапустить backend (и при необходимости frontend) с чистого запуска. Миграция/setup для `cc_callback_requests` и `route_templates` проходит без ошибки. Health или логин живые. В навигации есть маршруты и `/route-templates`.
result: pass
reason: cold-start — 14-05/14-08 touched schema setup / migrations

### 2. Подтверждение автопокрытых поверхностей
expected: |
  После логина как тенант-админ: у маршрута и IVR вкладка «Схема» последняя (если `routes.show_flowchart`), печать из схемы, dry-run по черновику с подсветкой и исходом callback. На маршруте кнопки «Из шаблона» / «Сохранить как шаблон»; страница `/route-templates` с формой create/edit/copy. У IVR/очереди/группы/робота/интеграции вкладка «Где используется» последняя в edit; удаление с ссылками блокируется. В настройках КЦ вкладка Callback с явным «Сохранить»; у оператора бейдж заявок после «Пропущенные»; у супервизора вкладка заявок с тем же фильтром очередей.
result: issue
reported: "при сохранении шаблона, всесто очередь 700, вижу: Очередь __slot:queue-a_1778039515670_snrw-target.value__"
severity: major
rationale: all_auto_covered confirmation — unit/component tests already green; human confirms the live product

### 3. 20 passthrough playback consume zero hops (D-45)
expected: 20 passthrough playback steps consume zero hops
result: pass
source: automated
coverage_id: 14-01-D1
note: Wave 0 RED; greened by 14-04 walkDialplanGraph.spec.ts

### 4. 11th toivr hop yields Congestion (D-45)
expected: 11th resolvable toivr jump yields Congestion at DEFAULT_HOP_LIMIT
result: pass
source: automated
coverage_id: 14-01-D2
note: greened by 14-04

### 5. exact_only resolver reasons (D-46)
expected: enter, ambiguous, pattern_only, inactive, non_route_context
result: pass
source: automated
coverage_id: 14-01-D3
note: greened by 14-04 exactRouteResolver.spec.ts

### 6. Missing QUEUESTATUS yields reask (D-47)
expected: reask with one source key
result: pass
source: automated
coverage_id: 14-01-D4
note: greened by 14-04 / 14-06 DryRunForm reask

### 7. IVR host exposes t and i (D-43)
expected: timeout (t) and invalid (i) inputs always present
result: pass
source: automated
coverage_id: 14-01-D5
note: greened by 14-04 / 14-06

### 8. Terminal callback yields callback_requested (D-38)
expected: walk stops; no hop consumed
result: pass
source: automated
coverage_id: 14-01-D6
note: greened by 14-04 / 14-06 Success highlight

### 9. collectActionReferences toivr/toqueue (D-48)
expected: hits toivr.ivr_uid and toqueue target
result: pass
source: automated
coverage_id: 14-01-D7

### 10. notify/voicerobot/directory scan (D-48)
expected: remaining kinds scanned
result: pass
source: automated
coverage_id: 14-01-D8
note: greened by 14-02 action-reference.util.spec.ts

### 11. collectActionReferences all kinds
expected: ivr, queue, group, voicerobot, integration, directory
result: pass
source: automated
coverage_id: 14-02-D1

### 12. GET /route-references JWT tenant-scoped
expected: never leaks another tenant's routes
result: pass
source: automated
coverage_id: 14-02-D2

### 13. GET /ivrs/:uid/usage
expected: tenant-scoped references
result: pass
source: automated
coverage_id: 14-02-D3

### 14. Delete 409 with references
expected: IVR/queue/group/robot/integration remove throws 409
result: pass
source: automated
coverage_id: 14-02-D4

### 15. Directories delegate to shared scanner
expected: no 409 regression
result: pass
source: automated
coverage_id: 14-02-D5

### 16. Route Schema tab last
expected: Schema last when routes.show_flowchart
result: pass
source: automated
coverage_id: 14-03-D1

### 17. Condition branch lane
expected: success/otherwise labels
result: pass
source: automated
coverage_id: 14-03-D2

### 18. Print via react-to-print
expected: useReactToPrint contentRef on figure
result: pass
source: automated
coverage_id: 14-03-D3

### 19. IVR Schema digit branches
expected: digits + t/i/max; no direct_dial
result: pass
source: automated
coverage_id: 14-03-D4

### 20. No graph/PDF libs
expected: no reactflow/dagre/elkjs/jspdf/html2canvas
result: pass
source: automated
coverage_id: 14-03-D5

### 21. Walker hop / Congestion / exact_only / reask / IVR / callback (14-04)
expected: POST /dialplan/dry-run + walker specs green
result: pass
source: automated
coverage_id: 14-04-suite

### 22. Template CRUD + apply + AI stub
expected: three built-in seeds; apply clones; buildFromDescription stub
result: pass
source: automated
coverage_id: 14-05-D1-D3

### 23. Dry-run form + highlight + IVR + segments + reask
expected: draft POST, five-channel highlight, stacked cards
result: pass
source: automated
coverage_id: 14-06-D1-D5

### 24. Template footer + dialogs + /route-templates CRUD
expected: route host only; replace confirm; FormModal create/edit/copy
result: pass
source: automated
coverage_id: 14-07-D1-D6

### 25. Callback ActionType + queue + scanner + REST
expected: CURL enqueue, DTMF/abandon, interval, list/claim/cancel 409
result: pass
source: automated
coverage_id: 14-08-D1-D6

### 26. Callback settings + Sheet + operator/supervisor chrome
expected: explicit Save; badge after Missed; supervisor queue filter
result: pass
source: automated
coverage_id: 14-09-D1-D4

### 27. Usage tab + delete precheck
expected: Usage last in edit; caveats; destructive disabled when refs nonempty
result: pass
source: automated
coverage_id: 14-10-D1-D4

## Summary

total: 27
passed: 26
issues: 1
pending: 0
skipped: 0
blocked: 0

## Gaps

- gap_id: G-14-2
  truth: "При сохранении шаблона preview шага toqueue показывает человекочитаемое имя очереди (например «Очередь 700»), а место подстановки в summary — моно-чип с именем слота, не сырой маркер __slot:…__ (14-UI-SPEC Surface H)."
  status: failed
  reason: "User reported: при сохранении шаблона, всесто очередь 700, вижу: Очередь __slot:queue-a_1778039515670_snrw-target.value__"
  severity: major
  test: 2
  root_cause: "TemplateActionPreview вызывает dialplanAppsRegistry.toqueue.summarize() на params, где target.value уже заменён на __slot:{kind}-{actionId}-target.value__. summarize интерполирует сырой маркер в «Очередь {{queue}}». UI-SPEC H требует моно-чип с именем слота в summary, не токен. Чипы ниже есть, но заголовок шага уже испорчен."
  artifacts:
    - path: "packages/frontend/src/features/route-templates/ui/TemplateActionPreview/TemplateActionPreview.tsx"
      issue: "summarize(params) before stripping/replacing slot markers; chip is additive, not a substitute"
    - path: "packages/frontend/src/features/dialplan-apps/model/registry.ts"
      issue: "toqueue.summarize treats any non-empty target.value as a display name"
    - path: "packages/frontend/src/features/route-templates/model/detectTemplateSlots.ts"
      issue: "buildTemplatePayload writes templateSlotMarker(hit.id); SaveAsTemplateDialog previews selected.actions"
  missing:
    - "Before summarize, replace __slot:id__ with slot.label (or omit value so summary is «Очередь» + mono chip)"
    - "Unit test: preview of slotted toqueue shows «Очередь 700» or chip «700», never raw __slot:…__"
  debug_session: .planning/debug/template-preview-slot-marker.md
