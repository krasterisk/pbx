# Phase 14: visual-route-builder-and-automation - Research

**Researched:** 2026-09-03
**Domain:** Dialplan visualization, deterministic dry-run graph walk, route templates, callback automation, entity reference index
**Confidence:** HIGH (in-repo hosts/contracts); MEDIUM (discretion schemas / interval)

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

#### Блок-схема (D-01…D-05)

- **D-01:** Схема — **только просмотр**. Редактор-список из Phase 12 остаётся единственным источником правки; два редактора одной цепочки гарантированно разойдутся.
- **D-02:** Живёт **отдельной вкладкой «Схема»** в модалке маршрута — не мешает вкладке «Действия» и удобна для печати. Видимость — по существующему флагу `routes.show_flowchart` (D-17), который в Phase 12 намеренно оставлен без потребителя.
- **D-03:** Рисуется **с ветвлением**: у шага с условием несколько выходов (успех / иначе). Линейная лента отвергнута — она повторяет список и не оправдывает PDF.
- **D-04:** Печать и PDF — **через браузер** (`window.print` / Ctrl+P, «Сохранить как PDF»). Без новой PDF-библиотеки; печатный вид совпадает с экранным. — **Reversibility:** reversible
- **D-05:** Хосты схемы — **маршрут и IVR-меню**. У IVR ветвление по цифрам наглядно ровно так же. Справочники маршрута — не в этой фазе.

#### Dry-run маршрута (D-29…D-32)

- **D-29:** Dry-run — **детерминированная симуляция по нашей модели цепочки**, без обращения к живому Asterisk. Проверяемо тестами и работает без лаборатории.
- **D-30:** На входе — **номер + пресеты сценариев понятным языком** («не ответили», «очередь переполнена», «занято»). Ровно те же пресеты, что в редакторе условий (D-23 Phase 12), — условия шага теперь шире `DIALSTATUS`: есть `QUEUESTATUS`, `DEVICE_STATE`, переменные и `CURL` (D-22 Phase 12).
- **D-31:** Результат показывается **на вкладке «Схема»**: прогон подсвечивает пройденный путь по блок-схеме. Отдельной панели результата нет — две фичи усиливают друг друга на одной поверхности.
- **D-32:** Dry-run **доступен агенту как tool**: агент проверяет цепочку до того, как предложить её пользователю. Обязательным перед каждой правкой не делается.

#### Шаблоны цепочек (D-33…D-37)

- **D-33:** Шаблоны **и встроенные от нас, и тенантные** («сохранить эту цепочку как шаблон»).
- **D-34:** **Агент умеет собирать шаблон и цепочку из описания** («придумай маршрут, схему») — результат идёт черновиком-диффом (D-18/D-19 **Phase 15**). Эта фаза отдаёт агенту сборку как вызываемый сервис; сам агент и подтверждение — Phase 15.
- **D-35:** Шаблон хранится **с местами для подстановки**: при применении спрашивает, какая очередь, какая группа, какой IVR. Иначе шаблон со ссылкой на конкретную очередь одноразовый.
- **D-36:** Применение к маршруту, у которого уже есть шаги, **спрашивает: заменить целиком или дописать в конец**. Молча терять шаги нельзя.
- **D-37:** Поверхности — **и кнопки в редакторе действий** («Из шаблона» / «Сохранить как шаблон»), **и свой раздел** «Шаблоны маршрутов» с полным CRUD.

#### Обратный звонок (D-38…D-42)

- **D-38:** Заказ callback — **и по выбору абонента, и автоматически при отбое в очереди**, причём **режим управляется настройками**, включая то, какую кнопку нажимать. Прецеденты: сбор ввода `Read`/`WaitExten` (D-49 Phase 12) и текущий workflow пропущенных в колл-центре (`cc_missed_calls`).
- **D-39:** Порядок набора — **настройкой**: доступны оба режима, «сначала оператор, потом абонент» и «сначала абонент».
- **D-40:** Очередь заявок — **таблица + Nest `@Interval` сканер**, как голосовая почта в Phase 13 (D-61). BullMQ/Redis в проекте нет; заявки переживают рестарт Nest. — **Reversibility:** costly — контракт «кто дозванивается» между шагом маршрута и воркером
- **D-41:** Окно дозвона и попытки настраиваются **на шаге маршрута в Sheet** — разные маршруты живут по-разному. Согласуется с D-01 Phase 12 (все параметры шага в Sheet).
- **D-42:** Заявки и их судьба видны **в панели оператора рядом с пропущенными из Phase 9**, и **такая же вкладка в панели супервизора**.

#### Уточнения из `/gsd-ui-phase` (D-43…D-52)

- **D-43:** Dry-run работает **и на хосте IVR-меню**, а не только на маршрутном. Вход — «что сделал абонент», и он **выводится из фактических `menu_items`**, а не из клавиатуры 12 кнопок: `IIvrMenuItem` несёт ровно `digit` (свободная строка-паттерн, например `_XXX`) и `actions`. «Таймаут» и «неверная кнопка» существуют в модели **как обычные пункты меню** с `digit` = `t` и `i` по конвенции диалплана, а `max_count > 0` добавляет счётчик проходов с переходом на пункт `max` (фоллбэк `Hangup()`). Входы «ничего не нажал» и «нажал кнопку, которой нет в меню» доступны всегда, даже без обработчиков `t`/`i`. **Находка:** флаг `direct_dial` в `ivr.model.ts` есть, но в генераторе диалплана у него нет ни одного потребителя — ветку «набрали номер напрямую» рисовать нельзя.
- **D-44:** Прогон — **сквозной обход графа сущностей**, а не симуляция одной цепочки: IVR-меню → цель перехода → её цепочка → её переходы, до терминального исхода или защиты от цикла. Разрешимых целей ровно три: `toivr` / `toroute` / `goto` (goto не создаёт сегмент).
- **D-45:** Защита от цикла опирается на **существующий `DEFAULT_HOP_LIMIT = 10`** и `resolveHopDecision`. Счётчиков два: порядок узлов без предела; hops только на `toivr`/`toroute`/`goto`. На исчерпании — `Congestion()`. Прогон **не останавливается раньше предела**; повтор помечается сразу.
- **D-46:** Разрешение цели `toroute` — **частичное, только точное совпадение** (`exact_only`). Несколько / паттерн / не-маршрутный контекст → исход «Ушло на адрес» с **конкретной причиной**. `context_includes` не обходится.
- **D-47:** Нехватка значения → **доспрос (reask)**: один контрол с пометкой «спросили после прогона», повторный прогон.
- **D-48:** **Индекс ссылок обобщается** на все типы с явными id; справочники переходят на общий механизм; delete-protection IVR/queues по образцу directories (precheck + 409, без «удалить всё равно»). Оговорки: raw_dialplan не индексируется; toroute на маршрут — partial.
- **D-49:** Настройки callback — вкладка на `CallCenterSettingsPage` после `shifts`, поле в `ICcSettings`, паттерн `ShiftPolicyForm` (локальный draft + Save). Окно/попытки остаются на шаге (D-41).
- **D-50:** Заявки callback — соседний badge+dropdown после MissedCalls (не сегмент внутри MissedCallsPanel). Супервизор — вкладка под существующим `cc:supervisor:queueFilter`.
- **D-51:** Кнопки шаблонов — **только `RouteActionsTab`**. Раздел `/route-templates`, после routes, иконка `LayoutTemplate`, `moduleRegistry` + `buildNavigation`.
- **D-52:** CSS-grid схема **без** graph libs; `reactflow`/`dagre`/`elkjs`/`jspdf`/`html2canvas` запрещены. Печать — `react-to-print` (уже в deps). У ScenarioTreePreview брать только механику печати + `break-inside: avoid`, не оформление.

### Claude's Discretion

- Схема таблиц заявок callback; имена статусов.
- Период `@Interval` сканера callback.
- Форма мест подстановки в шаблоне (плейсхолдеры против типизированных слотов).
- Форма регистрации dry-run и шаблонов как tools для агента Phase 15 (D-32/D-34) — сам агент строится в Phase 15, здесь достаточно вызываемого сервиса, не привязанного к HTTP-контроллеру.

### Deferred Ideas (OUT OF SCOPE)

- **Универсальный LLM-агент по АТС целиком** — переехал в **Phase 15** (`15-CONTEXT.md`, решения D-06…D-28), вместе с отложенной темой ограничений и инъекций (`/gsd-secure-phase 15`).
- **Полноценный граф-редактор** (перетаскивание блоков и рисование связей вместо списка) — отклонён в пользу «схема только для чтения».
- **Блок-схема в хосте «Справочники маршрута»** — только маршрут и IVR-меню в этой фазе.
- **ConfBridge как отдельный модуль** (унаследовано из Phase 12, D-41) — по-прежнему отдельная фаза.
- Полный движок паттернов Asterisk / обход `context_includes` для `toroute`.
- Замена `context+extension` на `route_uid` в `toroute`.
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| D-01…D-05 | Read-only flowchart tab on route + IVR; CSS-grid branch layout; browser print | Surfaces A–D; host map; react-to-print pattern |
| D-29…D-32 | Deterministic dry-run; presets; highlight on schema; AI-callable service | Dry-run engine design; hop util; condition sources |
| D-33…D-37 | Built-in + tenant templates; slots; replace/append; editor buttons + `/route-templates` | Templates CRUD; DialplanAppsEditor footer; nav registration |
| D-38…D-42 | Callback action, settings, Interval scanner, operator/supervisor UI | ActionType gap; CC settings; Missed/Parked chrome; VM scanner |
| D-43…D-47 | IVR dry-run inputs; cross-entity walk; hop budget; exact_only toroute; reask | F2 contract; IVR model; hop emission sites |
| D-48 | Generalized reference index + delete protection | `collectDirectoryReferences`; Directories 409 vs IVR/Queue remove |
| D-49…D-52 | CC callback tab; badge chrome; templates host limit; no graph libs | CallCenterSettingsPage; UI-SPEC L/M/N/G; D-52 forbid list |
</phase_requirements>

## Summary

Phase 14 sits on Phase 12’s typed chain editor (`DialplanAppsEditor`, `actionToDialplan`, `DIALPLAN_ACTION_META`) and Phase 9/13 call-center patterns. The planner should treat **14-UI-SPEC Surfaces A–P as normative** — they already encode host tab strips, print rules, walk semantics, template dialogs, callback chrome, and reference-index UX.

There is **no `callback` ActionType yet** (23 types). `routes.show_flowchart` exists and defaults true but has **no consumer** (hint still says «Появится позже»). Reference scanning exists only for directories; IVR/queue delete is unsafe. Dry-run must be a **single shared walk engine** (route + IVR hosts) with hop counting identical to dialplan emission, not a second hop story.

**Primary recommendation:** Implement five workstreams in dependency order — (1) generalized reference index + delete guards, (2) CSS-grid flowchart + print, (3) shared dry-run walker + reask API, (4) templates CRUD/apply, (5) callback ActionType + settings + Interval + operator chrome — reusing existing Nest/RTK/SCSS patterns and **installing no new graph/PDF packages**.

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Flowchart render + print | Browser / Client | — | Local draft `actions`; CSS grid; `react-to-print` subtree |
| Dry-run walk (deterministic) | API / Backend (+ pure util) | Browser (highlight) | Cross-entity load + tenant isolation; FE paints path |
| Hop budget / Congestion outcome | Shared util (`dialplan-hops`) | Backend emit | Same `DEFAULT_HOP_LIMIT` / `resolveHopDecision` as dialplan |
| Reference index | API / Backend | Browser (Usage tab) | Scans route `actions` JSON; delete 409 |
| Route templates CRUD / apply | API / Backend | Browser | Persist built-in+tenant; apply into local draft |
| Callback request persistence + scanner | API / Backend + Database | — | `@Interval` like voicemail; survives Nest restart |
| Callback CC settings | API / Backend (`cc_settings`) | Browser (`CallbackSettingsForm`) | Tenant `ICcSettings` field; ShiftPolicyForm save pattern |
| Operator/supervisor callback chrome | Browser / Client | API list/mutate | Badge+dropdown / supervisor tab; reuse originateDial |
| Phase 15 tool surface | API / Backend (DomainAiAdapter) | — | Callable service only; no agent UI |

## Project Constraints (from .cursor/rules/)

No `.cursor/rules/` directory found in the repo. Enforce instead from MUST-READ architecture:

- Frontend: SCSS modules + `var(--color-*)` above `shared/ui`; no feature-level Tailwind layouts for new pages; Stack/Text; Local Form State; Optimistic toggles only for write-on-change Switches; `TableRowActions`; Lucide only; InfoTooltip; form-modal shell.
- Backend: `vpbx_user_uid` from JWT only; service methods take tenant uid; npm packages verified before install; MCP/AI tools pass `vpbxUserUid` as call arg.

## Standard Stack

### Core

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| React + FSD | 19.x (repo) | UI hosts | Existing app |
| NestJS | 11.x (repo) | APIs, Interval scanners | Existing app |
| RTK Query | 2.x (repo) | Templates, refs, callback lists, CC settings | ARCHITECTURE Local Form + cache tags |
| `react-to-print` | **3.3.0** (local `^3.3.0`; npm latest 3.3.0, 2026-02-23) | Print Dialog subtree | D-04/D-52; already installed |
| `@nestjs/schedule` | in-repo | `@Interval` callback scanner | Voicemail/CC precedent |
| Vitest | `^4.1.4` (frontend) | FE unit tests | Phase 12 editor tests |
| Jest | `^29.7.0` (backend) | BE unit tests | dialplan / directories specs |

### Supporting

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| lucide-react | in-repo | Icons (`LayoutTemplate`, `Printer`, `PhoneOutgoing`) | All new chrome |
| shared/ui Card/Badge/Dialog/RadioCards/DataTable | in-repo | Surfaces A–P | Never reinvent primitives |
| Sequelize + MySQL | in-repo | `route_templates`, `cc_callback_requests` [ASSUMED names] | Persistence |

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| CSS-grid flowchart | reactflow / dagre / elkjs | **Forbidden** (D-52) — break print pagination |
| Browser print | jspdf / html2canvas | **Forbidden** — new PDF stack; D-04 wants browser PDF |
| `@Interval` + table | BullMQ / Redis | Not in project; D-40 locks Interval |
| Typed template slots | Free-text `{{placeholders}}` | Slots map to schema-driven Selects (UI-SPEC H/I) |

**Installation:**

```bash
# No new packages required for Phase 14 core surfaces.
# react-to-print is already in packages/frontend/package.json (^3.3.0).
```

**Version verification:** `npm view react-to-print version` → `3.3.0` (2026-02-23). Legitimacy gate: **OK** (~1.7M weekly downloads, github.com/MatthewHerbst/react-to-print, no postinstall).

## Package Legitimacy Audit

| Package | Registry | Age | Downloads | Source Repo | Verdict | Disposition |
|---------|----------|-----|-----------|-------------|---------|-------------|
| react-to-print | npm | since 2017; current 3.3.0 | ~1.7M/wk | github.com/MatthewHerbst/react-to-print | OK | Already present — **do not reinstall** |

**Packages removed due to [SLOP] verdict:** none  
**Packages flagged as suspicious [SUS]:** none  

**Explicitly forbidden installs (D-52):** `reactflow`, `dagre`, `elkjs`, `jspdf`, `html2canvas`.

## Architecture Patterns

### System Architecture Diagram

```text
[RouteFormModal / IvrFormModal]
        | local draft actions / menu_items
        v
 +--------------+     print      +------------------+
 | FlowchartTab | -------------> | react-to-print   |
 | (CSS grid)   | <--- highlight | contentRef canvas|
 +------+-------+                +------------------+
        ^
        | DryRunResult (segments, hops, outcome, reask?)
        |
 +------+------------------+         +------------------------+
 | DialplanDryRunService   | ------->| Entity loaders (tenant)|
 | + walkDialplanGraph()   |         | routes / ivrs / refs   |
 | uses resolveHopDecision |         +------------------------+
 +------+------------------+
        |
        | DomainAiAdapter tools (Phase 15 consumer)
        v
 [AiAdapterRegistryService]

[DialplanAppsEditor footer] --> [Template apply Dialog] --> onChange(new actions)
        |
        v
 [RouteTemplates CRUD API] <--- /route-templates page

[callback ActionType] --emit--> enqueue row --> [@Interval scanner] --> originateDial
        ^                              |
        |                              v
 [CallbackSettingsForm on CC page]   [CallbackRequestsList in agent/supervisor]
```

### Recommended Project Structure

```
packages/shared/src/
  utils/dialplan-walk/          # pure walk + exact_only resolver + hop accounting
packages/backend/src/
  modules/route-references/     # generalized collect* + GET usage + delete guards
  modules/route-templates/      # CRUD + apply + built-in seed
  modules/routes/…              # callback params DTO + actionToDialplan case
  modules/callcenter/…          # callback settings on cc_settings + requests + scanner
packages/frontend/src/features/
  dialplan-apps/ui/FlowchartCanvas/   # CSS-grid nodes (shared by route+IVR)
  dialplan-apps/ui/DryRunForm/
  route-templates/                    # page + dialogs
  callcenter/ui/CallbackSettingsForm/
  callcenter/ui/CallbackRequestsList/
  callcenter/ui/CallbackRequestsIndicator/
```

### Pattern 1: CSS-grid flowchart (no graph lib)

**What:** Declarative `grid-template-columns: minmax(240px, 360px) 32px 1fr` spine + one branch lane; nested conditions become jump chips, not a third column.  
**When to use:** Surfaces A–C; print must paginate.  
**Example:**

```scss
// Source: 14-UI-SPEC Surface B (project contract)
.canvas {
  display: grid;
  grid-template-columns: minmax(240px, 360px) 32px 1fr;
  max-height: 60vh;
  overflow-y: auto;
  overscroll-behavior: contain;
}
@media print {
  .canvas {
    max-height: none;
    overflow: visible;
    print-color-adjust: exact;
  }
  .node { break-inside: avoid; }
}
```

### Pattern 2: Print Dialog subtree via react-to-print v3

**What:** `useReactToPrint({ contentRef })` prints only the flowchart figure, not the Radix Dialog overlay.  
**When to use:** Surface D; never bare `window.print()` from inside Dialog.  
**Example:**

```tsx
// Source: https://www.npmjs.com/package/react-to-print (v3.3.0 README)
// Project precedent: ScenarioTreePreview.tsx:257-262
const contentRef = useRef<HTMLDivElement>(null);
const handlePrint = useReactToPrint({
  contentRef,
  documentTitle: title,
});
// <figure ref={contentRef}>…</figure>
```

Take **only** contentRef + `break-inside: avoid` from ScenarioTreePreview — not Tailwind/`sky-500`/inline `<style !important>` [VERIFIED: ScenarioTreePreview.tsx:257-304].

### Pattern 3: Dual hop counters in dry-run

**What:** Node order chips `{segment}.{step}` unbounded; hop counter increments only on `toivr` / `toroute` / `goto`, capped by `DEFAULT_HOP_LIMIT`.  
**When to use:** Always; must call `resolveHopDecision` [VERIFIED: dialplan-hops.util.ts:18-28].

```ts
// Source: packages/backend/src/shared/utils/dialplan-hops.util.ts:18-28
export const DEFAULT_HOP_LIMIT = 10;
export function resolveHopDecision(
  incoming: number | undefined,
  limit: number = DEFAULT_HOP_LIMIT,
): HopDecision {
  const next = (incoming ?? 0) + 1;
  return next > limit ? 'exceed' : 'goto';
}
```

Emission sites today [VERIFIED: dialplan.util.ts via explore]: `toivr`/`toroute` use `emitHopPrologue`; unconditional `goto` uses prologue; conditional `goto` uses `emitHopIncrement` + `emitHopGuard` — walker must treat **all three** as hop-consuming.

### Pattern 4: Generalized reference scan

**What:** Generalize `collectDirectoryReferences` key-sets into `collectActionReferences(kind, uid, routes, bindings?)`.  
**When to use:** Usage tab + toivr resolution + delete precheck.

```ts
// Source: packages/backend/src/modules/directories/directory-reference.util.ts:1-5,93-137
export interface DirectoryReference {
  routeUid: number;
  actionOrBindingId: string;
  location: string;
}
export function collectDirectoryReferences(
  directoryUid: number,
  fieldUid: number | undefined,
  bindings: ReferenceScanBinding[],
  routes: ReferenceScanRoute[],
): DirectoryReference[] { /* recursive nodeMatches + pushUnique */ }
```

Key map for generalization (UI-SPEC O): `toivr.ivr_uid`, `toqueue`/`togroup` target, `notify.integration_uid`, `voicerobot.robot_uid`, directory keys. **Exclude** `tolist.numbers` and `confbridge.room` (no entity id).

### Pattern 5: ShiftPolicyForm-style tenant settings

**What:** Local draft + explicit Save into `PUT /callcenter/settings/tenant`.  
**When to use:** Callback settings tab (D-49) — **not** Optimistic toggles.

### Anti-Patterns to Avoid

- **Graph library canvas with transforms:** breaks print pagination (D-52).
- **Second hop limit constant:** UI must interpolate `{{limit}}` from `DEFAULT_HOP_LIMIT`.
- **Template buttons on IVR / directory_policy hosts:** produces «Недоступно» steps (D-51).
- **Early stop on detected loop:** lies about Congestion timing (D-45).
- **Silent IVR/queue delete:** leaves Goto into deleted context (D-48).
- **Drawing `direct_dial` branch:** generator has no consumer (D-43).
- **Accordion/tabs for multi-entity dry-run path:** violates print parity (F2.4).

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Print Dialog content | Custom iframe/PDF | `react-to-print` contentRef | Overlay/clipping edge cases |
| Hop arithmetic | New counter | `resolveHopDecision` / `DEFAULT_HOP_LIMIT` | Must match live dialplan |
| Entity delete guard | Ad-hoc FE-only check | Directories 409 shape + index precheck | Race + single contract |
| Operator callback dial | New originate path | `originateDial` / missed callback | Already WebRTC/PJSIP branched |
| Background retries | Redis/Bull | `@Interval` + DB rows | Project has no queue broker |
| Flowchart layout | Measuring/absolute coords | CSS grid document flow | Print fragmentation |
| Condition presets UI | New vocabulary | Same human labels as ConditionEditor | D-30 |

**Key insight:** Phase 14 is composition of Phase 12 contracts + Phase 9/13 chrome — inventing parallel semantics (hops, delete, print, dial) is the main failure mode.

## Common Pitfalls

### Pitfall 1: Hop ≠ step
**What goes wrong:** Cap walk at 10 *steps*; long linear chains falsely Congestion.  
**Why:** Hops only increment on jumps.  
**How to avoid:** Unit tests: 20 passthrough actions → hops=0; 11 toivr hops → Congestion.  
**Warning signs:** UI copy says «шагов» instead of «переходов».

### Pitfall 2: Dry-run against saved route, not draft
**What goes wrong:** Schema/dry-run lag behind Actions tab.  
**How to avoid:** POST body carries local `actions` / `menu_items` (Surface A).  

### Pitfall 3: Template apply reuses action ids
**What goes wrong:** Undo/selection breaks.  
**How to avoid:** New `crypto.randomUUID()` per step (UI-SPEC H).  

### Pitfall 4: Incomplete reference honesty
**What goes wrong:** Empty Usage tab claims safe delete while raw_dialplan references exist.  
**How to avoid:** Warning when tenant has non-empty `raw_dialplan` (D-48).  

### Pitfall 5: ScenarioTreePreview styling copy-paste
**What goes wrong:** Tailwind in features + non-token colors.  
**How to avoid:** SCSS tokens only; light theme token remap in `@media print` (Surface D).  

### Pitfall 6: Completeness registries drift on `callback`
**What goes wrong:** META/DTO/registry/ActionTypesList diverge.  
**How to avoid:** Extend existing completeness tests (`ActionTypesList` length + META keys) [VERIFIED: dialplan-params.spec.ts:75-94].

## Code Examples

### Host insertion points

```tsx
// Route tabs today [VERIFIED: RouteFormModal.tsx:33]
const TABS = ['general', 'actions', 'directories', 'webhooks'] as const;
// Add 'flowchart' last when routes.show_flowchart && !isLoading
// Add 'usage' last in edit mode (Surface O)

// RouteActionsTab wires editor [VERIFIED: RouteActionsTab.tsx:91-99]
<DialplanAppsEditor
  host="route"
  allowedTypes={allowedTypesForHost('route')}
  actions={actions}
  onChange={setActions}
/>
// Template buttons ONLY here (D-51), via DialplanAppsEditor footer props/flags
```

```tsx
// IVR tabs [VERIFIED: IvrFormModal pattern] main | sounds_prompts | routes
// Add flowchart (flag) + usage (edit)
// IIvrMenuItem = { digit: string; actions: IRouteAction[] }
```

### ActionType gap for callback

```ts
// [VERIFIED: route.types.ts:30-38] — no 'callback'
export type ActionType =
  | 'totrunk' | 'toexten' | 'toqueue' | 'togroup' | 'tolist'
  | 'toivr' | 'toroute' | 'playback'
  | 'notify' | 'callerid'
  | 'voicemail' | 'text2speech' | 'voicerobot'
  | 'webhook' | 'confbridge' | 'cmd'
  | 'label' | 'goto' | 'schedule'
  | 'http_request' | 'collect_input'
  | 'hangup' | 'directory_lookup';
```

Planner must update in lockstep: shared `ActionType`, `DIALPLAN_ACTION_META`, `ActionTypesList`, `ACTION_PARAM_DTO`, frontend registry schema, `actionToDialplan` case. Terminality: **conditional** («Может выйти из цепочки») per Surface K.

### exact_only toroute resolver (skeleton)

```ts
// Pseudocode aligned with UI-SPEC F2.2a — values from CONTEXT D-46
function resolveExactRoute(contextName: string, extension: string, routesInContext: Route[]): 
  | { kind: 'enter'; route: Route }
  | { kind: 'ambiguous'; matches: Route[] }
  | { kind: 'pattern_only'; match: Route }
  | { kind: 'inactive'; route: Route }
  | { kind: 'non_route_context' } {
  const exact = routesInContext.filter(r =>
    (r.extensions ?? []).includes(extension) && !isAsteriskPattern(extension)
  );
  // pattern entries in extensions[] that match via pattern engine → pattern_only (do NOT implement full matcher; detect '_' prefix patterns only)
  …
}
```

### Delete 409 shape (spread from directories)

```ts
// [VERIFIED: directories.service.ts:220-228]
if (references.length) {
  throw new ConflictException({
    message: 'Directory is referenced and cannot be deleted',
    references,
  });
}
```

Same shape for IVR/queue/group/robot/integration; FE blocks destructive CTA when index nonempty (Surface P).

## Dry-run Simulation Engine Design

**Placement:** Pure `walkDialplanGraph` in `packages/shared` (or backend `shared/utils` exported for FE tests) + Nest `DialplanDryRunService` that loads tenant entities and returns a DTO. Single implementation for route host and IVR host (F2.8).

**Inputs:**
- Host kind: `route` | `ivr`
- Draft chain: `actions[]` or `menu_items[]` + IVR `max_count`
- Caller number (route host)
- Scenario bindings: map of `ConditionSource` → value (only keys needed; reask appends)
- IVR choice: selected digit / timeout / invalid / pass index

**Algorithm:**
1. Build segment 1 from host entity; visit nodes in order.
2. Evaluate conditions using supplied scenario values; missing → `{ reask: { source, control } }`.
3. Passthrough types continue; terminal address types stop with named outcome.
4. On `goto`: resolve label in **same** chain; consume hop; no new segment.
5. On `toivr`: resolve via reference index / ivr_uid; consume hop; new segment.
6. On `toroute`: compute extension from ValueSource; `exact_only` resolve; consume hop or emit addressed outcome with reason.
7. Loop detection marks breadcrumbs immediately; continue until hop exceed → Congestion card (F2.6).
8. Return `{ segments, breadcrumbs, hopsUsed, hopLimit: DEFAULT_HOP_LIMIT, outcome, reask? }`.

**FE:** collapsed DryRunForm on Flowchart tab; CTA posts (or runs pure walk + fetch missing entities); paints five-channel highlight (UI-SPEC Color); `aria-live` announces outcome first.

**Phase 15:** register `DomainAiAdapter` tools wrapping the same service; `vpbxUserUid` argument only.

## Templates CRUD + apply/replace-or-append

**Storage [ASSUMED recommendation]:** table `route_templates` with `vpbx_user_uid` NULL for built-in, non-null for tenant; columns `name`, `description`, `actions` JSON, `slots` JSON, timestamps. Seed 2–4 built-ins in migration.

**Slots [ASSUMED recommendation — discretion]:** typed slots `{ id, kind: 'queue'|'group'|'ivr'|'trunk'|'recording'|'directory', label }`, not free `{{mustache}}`. Auto-detect candidates from chain entity refs on «Save as template» (Surface I); checked by default.

**Apply:** Dialog steps Select → Fill slots → RadioCards replace|append (default append; replace needs confirm). Output new actions into RouteActionsTab draft via `onChange`. No dialplan apply/reload until user saves the route.

**Surfaces:** footer buttons + empty-state secondary CTA in DialplanAppsEditor when `host==='route' && !readOnly`; page `/route-templates` registered in `moduleRegistry` + `buildNavigation` + `router.tsx` after routes, icon `LayoutTemplate`.

**AI (D-34):** `RouteTemplatesService.buildFromDescription` callable later; this phase ships service stub/interface if needed, or just CRUD + apply — planner may defer LLM fill to Phase 15 but must leave a service method Phase 15 can call.

## Callback: settings, step, scanner, chrome

**Action params (Sheet):** window start/end (`type="time"`), max attempts, pause minutes (Surface K). Not: mode/DTMF/order.

**Tenant settings field [ASSUMED]:** `ICcSettings.callback_policy`:

```ts
{
  order_mode: 'subscriber' | 'queue_abandon' | 'both';
  dtmf_digit: '0'|'1'|…|'*'|'#', // hidden when order_mode==='queue_abandon'
  dial_order: 'agent_first' | 'caller_first',
}
```

Tab `callback` after `shifts` on `CallCenterSettingsPage`; component `CallbackSettingsForm` mirroring ShiftPolicyForm (`data-testid="callback-settings-form"`).

**Requests table [ASSUMED]:** `cc_callback_requests` with tenant uid, caller number, source route/queue, status enum `pending | dialing | completed | failed | cancelled | expired`, attempt counters, next_attempt_at, window copy from step, claimed operator id.

**Scanner:** `@Interval('cc-callback-scan', 30_000)` [ASSUMED = voicemail 30s], `running` mutex, `scanOnce` loads due rows in window, dials via existing `originateDial` / click-to-call subroutine, respects `dial_order`.

**Operator UI:** `CallbackRequestsIndicator` after MissedCalls, before Parked; hide at count 0; PhoneOutgoing icon; shared `CallbackRequestsList`.  
**Supervisor:** tab `callbacks` + DataTable variant; filter via existing `cc:supervisor:queueFilter`.

**Dialplan emission:** enqueue request (AGI/CURL to internal API or AMI originate later) + continue/hangup per subscriber accept — exact Asterisk lines are executor detail but must not invent PHP bridges; reuse Phase 12 CURL/bridge patterns.

## Reference index + delete protection

1. Move/generalize util next to directories (or `route-references` module).
2. `GET` usage endpoints per entity (or one polymorphic).
3. Usage tab last on each host (Surface O table); CallGroup + NotificationIntegration introduce variant-B tabs only in edit.
4. Replace DirectoryFormModal inline machine locations with human Usage UI.
5. Wire `IvrsService.remove` / `QueuesService.remove` (+ groups/robots/integrations) to ConflictException like directories; FE precheck disables delete.
6. Empty state + raw_dialplan caveat + toroute pattern caveat.

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Flag-only flowchart | Consumer tab + print | Phase 14 | Uses `routes.show_flowchart` |
| Directory-only refs | Generalized action refs | Phase 14 | Safe delete for IVR/queues |
| Missed-call ad-hoc callback | First-class route action + queue | Phase 14 | Settings + scanner |
| LLM agent in Phase 14 | Split to Phase 15 | 2026-09-03 | Dry-run/templates as tools only |

**Deprecated/outdated:** TenantSettings hint «Появится позже» for flowchart — update copy when tab ships. ScenarioTreePreview Tailwind print styles — do not copy.

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | Callback settings JSON field name `callback_policy` on `cc_settings` | Callback | Rename migration if user prefers another key |
| A2 | Request table name `cc_callback_requests` + status set listed above | Callback | Schema churn |
| A3 | Scanner interval 30s matching voicemail | Callback | Load/latency tradeoff |
| A4 | Typed slots preferred over mustache placeholders | Templates | UX rework if user wants free text |
| A5 | Pure walk lives in `packages/shared` | Dry-run | Could be backend-only if FE never imports |
| A6 | `tolist`/`confbridge` stay out of reference index | References | If product later adds list/room entities |

## Open Questions

1. **Callback dialplan emission detail** (CURL internal vs AMI Originate from scanner only)
   - What we know: scanner will dial; step must create the request somehow.
   - Recommendation: step emits CURL to authenticated internal endpoint (Phase 12 bridge pattern); scanner owns retries — planner should confirm in Wave 0 spike if needed.
2. **Built-in template catalog content**
   - Recommendation: minimal seed (queue+failover, IVR handoff, business hours) — copy can iterate.
3. **Whether dry-run HTTP is required for FE**
   - Recommendation: yes for cross-entity (tenant loads); pure function for unit tests.

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Node.js | build/test | ✓ | v24.19.0 | — |
| npm | packages | ✓ | 11.14.1 | — |
| react-to-print | print | ✓ | ^3.3.0 local / 3.3.0 registry | — |
| Vitest | FE tests | ✓ | ^4.1.4 | — |
| Jest | BE tests | ✓ | ^29.7.0 | — |
| Live Asterisk | dry-run | not required | — | Deterministic sim (D-29) |
| Redis/BullMQ | callback | ✗ (absent by design) | — | `@Interval` + DB |

**Missing dependencies with no fallback:** none for Phase 14 scope.  
**Step 2.6:** no blocking external tools beyond existing monorepo toolchain.

## Validation Architecture

> `workflow.nyquist_validation` absent in `.planning/config.json` → treat as **enabled**.

### Test Framework

| Property | Value |
|----------|-------|
| Framework | Jest 29 (backend) + Vitest 4 (frontend) |
| Config file | packages/backend jest config; packages/frontend vitest |
| Quick run command | `npm run test -w @krasterisk/backend -- dialplan-hops` / targeted vitest file |
| Full suite command | `npm run test:backend` && `npm run test:frontend` |

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| D-45 | hop exceed → Congestion; 20 steps no hop | unit | jest `dialplan-hops` + new walk.spec | ✅ hops / ❌ walk Wave 0 |
| D-46 | exact_only toroute reasons | unit | walk resolver.spec | ❌ Wave 0 |
| D-47 | reask returns one control | unit | walk.spec | ❌ Wave 0 |
| D-48 | collect refs for toivr/queue; IVR remove 409 | unit | extend directory-reference.spec + ivrs.service.spec | ⚠️ partial |
| D-01/D-03 | flowchart renders branch lane | component | FlowchartCanvas.test.tsx | ❌ Wave 0 |
| D-04 | print uses contentRef (mock useReactToPrint) | component | FlowchartPrint.test.tsx | ❌ Wave 0 |
| D-36 | replace requires confirm; append default | component | ApplyTemplateDialog.test.tsx | ❌ Wave 0 |
| D-51 | template buttons absent on ivr host | component | DialplanAppsEditor.test.tsx | ❌ Wave 0 |
| D-49 | CallbackSettingsForm Save not optimistic | component | CallbackSettingsForm.test.tsx | ❌ Wave 0 |
| completeness | ActionType includes callback everywhere | unit | dialplan-params.spec + META parity | ✅ extend |

### Sampling Rate

- **Per task commit:** targeted jest/vitest for touched module
- **Per wave merge:** `npm run test:backend` + `npm run test:frontend` (scoped if CI timebox)
- **Phase gate:** full suites green before `/gsd-verify-work 14`

### Wave 0 Gaps

- [ ] `packages/shared/.../dialplan-walk/*.spec.ts` — walk, hops, exact_only, reask, IVR digit selection
- [ ] Extend reference util specs for non-directory kinds
- [ ] Completeness tests expect `callback` once added
- [ ] FE flowchart + dry-run highlight + template dialog tests
- [ ] Callback scanner scanOnce unit tests (mutex / window / attempts)

## Security Domain

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | yes | Existing JWT guards on new controllers |
| V3 Session Management | no | — |
| V4 Access Control | yes | `vpbx_user_uid` from JWT; supervisor assert on CC settings write; Usage/delete tenant-scoped |
| V5 Input Validation | yes | class-validator DTOs for templates, dry-run body, callback policy, ActionType params |
| V6 Cryptography | no | — |

### Known Threat Patterns for this stack

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| Cross-tenant entity walk / usage leak | Information Disclosure | Every loader filters `vpbx_user_uid`; tests for foreign uid |
| Delete race leaving dangling Goto | Tampering | Server 409 backstop + index precheck |
| Dry-run / template AI tool abuse | Elevation | Phase 15 rights; here: no controller without auth; uid arg only |
| Callback originate spam | Denial of Service | Attempt caps on step; scanner batch limits [ASSUMED] |
| SSRF via template/http in chain | Tampering | Reuse existing http_request validation; dry-run does not call network |

## Sources

### Primary (HIGH confidence)

- In-repo: `14-CONTEXT.md`, `14-UI-SPEC.md` Surfaces A–P (approved)
- In-repo: `directory-reference.util.ts`, `dialplan-hops.util.ts`, `DIALPLAN_ACTION_META`, `RouteFormModal`/`RouteActionsTab`, `IvrFormModal`/`IIvrMenuItem`, `DirectoriesService.remove`, `voicemail-scanner.service.ts`, `ShiftPolicyForm`, `MissedCallsPanel`/`ParkedCallsIndicator`, `AiAdapterRegistryService`, `ScenarioTreePreview.tsx`
- npm README react-to-print 3.3.0 — `contentRef` API [CITED: https://www.npmjs.com/package/react-to-print]
- MDN `break-inside: avoid` [CITED: https://developer.mozilla.org/en-US/docs/Web/CSS/break-inside]

### Secondary (MEDIUM confidence)

- Package legitimacy seam for react-to-print (OK)
- Explore agent code map cross-check of hosts (2026-09-03)

### Tertiary (LOW confidence)

- Assumed callback schema/status names and 30s interval (discretion)
- Assumed typed slot JSON shape

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — reuse existing; verified react-to-print version
- Architecture: HIGH — locked CONTEXT + approved UI-SPEC + verified hosts
- Pitfalls: HIGH — derived from D-43…D-52 and Phase 12/13 precedents
- Discretion schemas: MEDIUM — need planner defaults, not user blockers

**Research date:** 2026-09-03  
**Valid until:** 2026-10-03 (stable in-repo contracts; revisit if ActionType set changes)

## UI-SPEC Surfaces Lift (A–P) — planner checklist

| Surface | Deliverable |
|---------|-------------|
| A | RouteFormModal tab `flowchart` last; gated by `routes.show_flowchart`; draft-sourced |
| B | CSS-grid spine + one branch lane; jump chips; non-interactive nodes; summarize() from registry |
| C | IvrFormModal flowchart; digit branches; t/i/max human labels; no direct_dial |
| D | react-to-print; SCSS `@media print`; light token remap; hide toolbar/form |
| E/E2 | Collapsed dry-run forms (route presets / IVR digit) |
| F/F2/F3 | Path highlight + segments + breadcrumbs + hop Congestion + composite chips + IVR outcomes |
| G | Template buttons only on route host footer (+ empty CTA) |
| H | Apply dialog: select → slots → replace/append |
| I | Save-as-template dialog with auto slots |
| J | `/route-templates` CRUD page + dual nav registration |
| K | `callback` Sheet fields |
| L | CC settings tab + CallbackSettingsForm |
| M | Operator badge+dropdown |
| N | Supervisor callbacks tab |
| O | Usage tabs on seven hosts |
| P | Delete precheck + 409; no force-delete |
