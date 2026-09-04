# DEBUG: template preview leaks slot markers

## Symptoms
- When saving a route as a template, toqueue step preview shows
  `Очередь __slot:queue-a_1778039515670_snrw-target.value__`
  instead of `Очередь 700`.

## Reproduction
UAT Test 2 — Save as template on a route whose queue is 700.

## Root cause
`SaveAsTemplateDialog` previews `buildTemplatePayload(...).actions`, which already
rewrites `params.target.value` to `__slot:{id}__`.
`TemplateActionPreview` passes those params to `dialplanAppsRegistry.toqueue.summarize()`,
which interpolates any non-empty `target.value` into `Очередь {{queue}}`.

14-UI-SPEC Surface H: slot sites in the summary must render as a mono chip with the
slot name, not emptiness or a raw marker.

## Suggested fix
In `TemplateActionPreview`, strip or replace slot markers before `summarize`, and keep
the existing chips as the slot name. Add a unit test that a slotted toqueue never
renders `__slot:`.
