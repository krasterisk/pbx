# Phase 8: Navigation redesign & Android port foundation - Context

**Gathered:** 2026-07-16
**Status:** Ready for planning

<domain>
## Phase Boundary

Заменить плоский sidebar на **модульную систему навигации** (Module Hub + in-module nav + marketplace-ready catalog), с modern shell UX, **full responsive** адаптацией всех reachable-страниц, админкой модулей/ролей landing, каркасом биллинга лицензий модулей, и **Capacitor Android foundation** (включая softphone/WebRTC validation + FCM foundation).

**In scope:**
1. Module Hub (route) + quick switcher (overlay) + in-module navigation registry
2. Backend module catalog + admin UIs (platform super-admin vs tenant admin)
3. Role→start matrix (configurable) + research/rework touchpoints for Users/Roles/Numbers
4. Full responsive pass (planner waves); adaptive phone/tablet patterns
5. Billing skeleton for module purchase/licensing
6. Capacitor Android (+ iOS project structure readiness), secure auth storage, URL flavors, FCM foundation, WebRTC validation
7. Sketch: 3 Hub/shell variants → winner; update frontend ARCHITECTURE if DS changes materially
8. Legacy route redirects for transition period only
9. AiChatWidget remains global across modules

**Out of scope:**
- Full payment provider production hardening / store listing / Play-ready signing CI (beyond foundation)
- Full native Android Telecom/ConnectionService (unless research after WebRTC spike recommends a minimal path — baseline TBD in research)
- Deep offline data cache / action queues
- iOS simulator CI smoke (structure only)
- Rewriting to React Native

</domain>

<decisions>
## Implementation Decisions

### Desktop nav shell — module system
- **D-01:** App = набор **Modules**. Global Module Switcher → вход в модуль → **in-module nav**. Не плоский единый sidebar навсегда.
- **D-02:** **Hybrid Hub:** full-screen **Module Hub** (wow / marketplace) + **быстрый switcher** без обязательного возврата на Hub.
- **D-03:** In-module nav — **per module type** через единый **nav registry**: dense (PBX/Settings) → sidebar/rail; sparse → tabs. Один API регистрации для marketplace modules.
- **D-04:** Post-login — **role-aware default** + явная **матрица роль → стартовый модуль/экран**, конфигурируемая с максимальной гибкостью (per-tenant / per-role) в admin.
- **D-05:** Hub visual (discuss framing) = bento grid + dock (Recent + Favorites). **Superseded for production chrome by D-11 sketch winner 002-E** (dense single-column Hub list, no dock) — see `08-UI-SPEC.md` traceability note. Conceptual Hybrid Hub (Hub route + quick switch without forced return) still stands; bento/dock visual treatment does **not**.
- **D-06:** Quick switcher = **header chip** + **⌘K / Ctrl+K** command palette (модули + страницы текущего модуля).
- **D-07:** Marketplace UI в Hub: **Active + ghost Locked** (blur/lock); registry поле `licenseStatus`. Полный store UX завязан на billing skeleton (D-30).
- **D-08:** Hub = **route** (deep-linkable); quick switcher = **overlay**.
- **D-09:** Motion = **cinematic but short**; уважать `prefers-reduced-motion`. **Production:** staggered **list-row** reveal on first Hub mount (002-E), not bento-cell stagger — per UI-SPEC / D-11 winner.
- **D-10:** Клик по **логотипу** → всегда Module Hub (`/modules`).
- **D-11:** Sketch strategy: **3 визуальных варианта** Hub/shell → выбор пользователя → один production winner. **Winner locked:** Hub **002-E**, ModuleShell tabs **003-B**, mobile **004-B**, marketplace **005-B**, platform admin **006-B** (`sketch-findings-krasterisk-v4` / UI-SPEC).

### IA / modules / marketplace
- **D-12:** Baseline modules: **Base** = Core (PBX + pages) · Apps · System. **Marketplace (default)** = Analytics · Call Center · AI bots / related. Всё **конфигурируемо**.
- **D-13:** **Backend module catalog API** + полноценная **admin UI Modules**.
- **D-14:** **Dashboard / «Обзор»** — cross-cutting: плитка в Hub + возможный role-default target; не тяжёлый отдельный product-module.
- **D-15:** Стартовая раскладка пунктов — **baseline #1** (Core/PBX, Apps, System, marketplace CC/Analytics/AI); **queues / reports / orphan items** уточняет research. **Принадлежность пункта к модулю меняется в admin**.
- **D-16:** Default role→start (переопределяемо в admin): OPERATOR → Call Center agent; SUPERVISOR → Call Center supervisor; ADMIN → Overview; если CC выключен → fallback Core/Overview.
- **D-17:** Deep-link на выключенный модуль → **smart fallback** (role-default / Overview); Hub различает license-locked vs admin-disabled.
- **D-18:** **Wallboard TV** URL остаётся **вне module shell** (display-token); в модуле CC — страница настройки/токенов.
- **D-19:** **Service Requests** и прочие «осиротевшие» пункты — Claude/research выбирает baseline module; admin может переназначить.
- **D-20:** Research **MUST** изучить и оценить переработку:
  - `packages/frontend/src/pages/UsersPage/UsersPage.tsx`
  - `packages/frontend/src/pages/RolesPage/RolesPage.tsx`
  - `packages/frontend/src/pages/NumbersPage/NumbersPage.tsx`
  (роли, матрицы доступа, связь с module landing / System module).

### Platform roles & billing
- **D-21:** **Super-admin / platform operator** — **вне тенанта**: создаёт и управляет тенантами; **только он** конфигурирует отображение/состав/содержание модулей (catalog structure, item membership, defaults).
- **D-22:** **Tenant admin** — видит модули; может **включать/выключать** у себя и **совершать покупку**; не редактирует глобальный catalog/composition.
- **D-23:** В Phase 8 — **каркас реального биллинга** модулей (license/checkout hooks, не только UI-заглушка). Конкретный платёжный провайдер / PCI детали — research + planner; полный production hardening store может волноваться, но каркас обязателен.

### Mobile
- **D-24:** **Adaptive:** phone = Hub-first; tablet = dual-pane ≈ desktop.
- **D-25:** Phone module switch = **chip → bottom sheet** + **логотип → Hub**.
- **D-26:** In-module pages на phone = **hybrid by module type** (как registry).
- **D-27:** **Full responsive pass** всех reachable-страниц (planner разбивает на waves).
- **D-28:** Call Center agent на phone = **stacked tabs/sections** + sticky softphone controls.
- **D-29:** Tables = **hybrid**: критичные списки → cards; остальные → horizontal scroll + column priority.

### Android / Capacitor
- **D-30:** Оболочка = **Capacitor** над существующим Vite/React SPA (не RN rewrite).
- **D-31:** Depth = scaffold + platform bridges + **softphone/WebRTC validation** в Android WebView + audio-focus notes.
- **D-32:** **FCM foundation** — Capacitor Push plugin + backend hook skeleton (не full push UX campaigns).
- **D-33:** Auth tokens на Android → **Capacitor Secure Storage** (или encrypted Preferences); web auth path не ломать тотальным cookie-рефактором в этой фазе.
- **D-34:** API/WSS URL = **hybrid**: build flavors (dev/staging/prod) + optional override для on-prem/debug.
- **D-35:** Offline = **banner + retry** only; constraints документировать в research; no offline action queue.
- **D-36:** Background/call when minimized — **не фиксировать заранее**; baseline после WebRTC WebView spike в research (Foreground-only vs foreground-service notification).
- **D-37:** **iOS** = Capacitor project structure readiness; без Xcode CI / simulator smoke в этой фазе.

### Design system & shell language
- **D-38:** Shell = **refresh + bold Hub language** (expressive Hub cards/motion/density) при сохранении **FSD**. Страницы модулей не требуют тотального рескина в той же волне, что Hub, но full responsive — да.
- **D-39:** Если DS меняется существенно — **обновить** `packages/frontend/.idea/ARCHITECTURE.md` под новую систему.

### Cross-cutting
- **D-40:** **AiChatWidget** доступен **во всех модулях** (global overlay).
- **D-41:** Legacy URLs (`/operator`, старые paths) — **redirects только на переходный период**, затем удаление.

### Claude's Discretion
- Точный baseline mapping orphan routes (service-requests и т.п.) после research.
- Queues ↔ Apps vs Call Center; Reports split Core vs Analytics — после research.
- Конкретный payment provider для billing skeleton.
- Background call strategy после WebRTC spike.
- Детали prefers-reduced-motion / shared-element transitions.
- Объём переработки Users/Roles/Numbers в Phase 8 vs follow-up wave — research рекомендует, planner режет waves (пользователь ожидает вероятную полную переработку в рамках проекта/фазы).

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Architecture & GSD
- `packages/frontend/.idea/ARCHITECTURE.md` — FSD, Tailwind/shadcn, Stack, i18n; **update if DS changes (D-39)**
- `packages/backend/.idea/ARCHITECTURE.md` — NestJS modules, guards, tenant isolation
- `.planning/CANONICAL_REFS.md` — index
- `.planning/ROADMAP.md` — Phase 8 scope entry
- `.planning/PROJECT.md` — product constraints

### Current navigation / shell (replace/evolve)
- `packages/frontend/src/widgets/Sidebar/` — `buildNavigation.ts`, `Sidebar.tsx`, items
- `packages/frontend/src/app/layouts/AppLayout.tsx` — shell, mobile drawer
- `packages/frontend/src/app/router/router.tsx` — routes; wallboard public exception
- `packages/frontend/src/widgets/Header/` — header / menu toggle
- `packages/frontend/src/widgets/AiChatWidget/` — global chat (D-40)
- `packages/frontend/src/shared/hooks/useIsMobile.ts` — breakpoint 768 (revisit for tablet dual-pane)

### Roles / access (research mandatory)
- `packages/frontend/src/pages/UsersPage/UsersPage.tsx`
- `packages/frontend/src/pages/RolesPage/RolesPage.tsx`
- `packages/frontend/src/pages/NumbersPage/NumbersPage.tsx`
- `packages/frontend/src/entities/User/` — `UserLevel` and selectors
- Backend users/roles/tenants modules (discover in research) — platform operator outside tenant (D-21)

### Call Center / wallboard constraints
- `.idea/call-center/CC_WORKSPACES_CONCEPT.md` — agent 4-zone (mobile stacked per D-28)
- `.idea/call-center/CC_WEBRTC_CONCEPT.md` — softphone; Android WebView validation (D-31)
- `packages/frontend/src/pages/CallCenterAgentPage/` — mobile adaptation target
- Phase 7 context: `.planning/phases/07-call-center-overhaul-professional-agent-supervisor-workspace/07-CONTEXT.md` — display-token wallboard outside AppLayout (D-18)

### Stack / mobile port
- `packages/frontend/package.json` — React 19 + Vite; **no Capacitor yet**
- `packages/frontend/vite.config.ts` / standalone build configs — Capacitor webDir integration

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `buildNavigation` + role gates — replace with **module registry** + per-module nav contributors
- `AppLayout` / `Sidebar` / `Header` / `useIsMobile` — evolve into Module Hub shell + adaptive layouts
- `shared/ui` (Button, Sheet, Dialog, Stack, Card) — Hub cards, sheets, overlays
- `motion` — Hub staggered reveal (D-09)
- AiChatWidget — keep mounted at shell level (D-40)
- Call center `RequireRole` / UserLevel patterns — extend for platform operator + module license gates

### Established Patterns
- FSD feature/page split; i18n ru+en mandatory for new strings
- Public wallboard route **without** AppLayout — preserve
- Phase 2 sketch → 3 variants → one winner workflow for UI

### Integration Points
- Router: module-prefixed or module-aware routes; transitional redirects (D-41)
- Auth store: abstract token storage for Capacitor Secure Storage on native (D-33)
- Backend: new module catalog + tenant module enablement + billing skeleton endpoints
- SSE/WebRTC: mobile network + Android WebView constraints documented in research

</code_context>

<specifics>
## Specific Ideas

- Пользователь хочет **«вау»** при входе в Module Hub, но быструю работу через chip/⌘K без возврата на Hub каждый раз.
- Модули должны **масштабировать global bar/switcher** при появлении новых marketplace modules.
- Маркетплейс: базовые vs покупаемые; ghost Locked tiles; tenant admin покупает/включает; platform operator формирует catalog.
- Android — не «галочка в roadmap», а scaffold + bridges + softphone validation + FCM foundation.

</specifics>

<deferred>
## Deferred Ideas

- Production Google Play listing, signing secrets CI, store assets
- Full iOS QA / TestFlight pipeline
- Full offline sync / action queues
- Native Android Telecom/ConnectionService (unless research elevates a minimal slice)
- React Native rewrite
- Complete payment-provider production hardening beyond billing skeleton (if research splits it)

</deferred>

---

*Phase: 8-navigation-redesign-android-port-foundation*
*Context gathered: 2026-07-16*
