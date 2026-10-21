# Phase 8: Navigation redesign & Android port foundation - Pattern Map

**Mapped:** 2026-07-16
**Files analyzed:** 28
**Analogs found:** 26 / 28

> **Visual contract note:** UI-SPEC Hub **002-E** (dense list) supersedes CONTEXT D-05 bento/dock visuals. Analogs below map *behavior and code structure*, not sketch chrome.

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|-------------------|------|-----------|----------------|---------------|
| `packages/frontend/src/features/modules/` (registry + licenseStatus) | utility / feature | transform | `widgets/Sidebar/lib/buildNavigation.ts` + `shared/hooks/useMyModules.ts` | exact |
| `packages/frontend/src/widgets/ModuleHub/` | component | request-response | `pages/MarketplacePage/MarketplacePage.tsx` + `pages/MyModulesPage/MyModulesPage.tsx` | role-match |
| `packages/frontend/src/widgets/ModuleShell/` | component | request-response | `app/layouts/AppLayout.tsx` + `widgets/Header/Header.tsx` + `widgets/Sidebar/Sidebar.tsx` | exact |
| `packages/frontend/src/widgets/MobileBottomBar/` | component | request-response | `widgets/Sidebar/Sidebar.tsx` (mobile drawer) + `shared/hooks/useIsMobile.ts` | role-match |
| `packages/frontend/src/shared/ui/CommandPalette/` | component | request-response | `shared/ui/Dialog/Dialog.tsx` + Header search chrome | role-match |
| `packages/frontend/src/app/layouts/AppLayout.tsx` | layout | request-response | self (evolve) + `StandaloneLayout.tsx` | exact |
| `packages/frontend/src/app/layouts/PlatformLayout.tsx` | layout | request-response | `app/layouts/StandaloneLayout.tsx` + `pages/SuperAdminPage/SuperAdminPage.tsx` | role-match |
| `packages/frontend/src/app/router/router.tsx` | route | request-response | self (`RequireRole`, wallboard sibling, `/operator` redirect) | exact |
| `packages/frontend/src/app/router/RequireRole.tsx` | middleware | request-response | self (extend for SUPERADMIN / module gates) | exact |
| `packages/frontend/src/shared/config/modules/` | config | transform | `buildNavigation.ts` page list + `MODULES_SEED` in backend | role-match |
| `packages/frontend/src/shared/api/endpoints/cloudAdminApi.ts` | store / API | CRUD | self (`activateModule`, `getMyModules`, billing) | exact |
| `packages/frontend/src/features/platform-admin/` | feature | CRUD | `features/cloud-admin/` + `pages/SuperAdminPage/` | exact |
| `packages/frontend/src/features/modules/ui/CheckoutSheet/` | component | request-response | `shared/ui/Sheet/Sheet.tsx` + Marketplace Buy CTA | role-match |
| `packages/frontend/src/features/auth/` (token storage adapter) | utility / store | file-I/O | `features/auth/model/authSlice.ts` | exact |
| `packages/frontend/src/shared/lib/capacitor/` | utility | request-response | *(no Capacitor yet)* — follow RESEARCH Capacitor patterns; structure like `shared/hooks/` | none |
| `packages/frontend/capacitor.config.ts` + `android/` `ios/` | config | file-I/O | *(greenfield)* Capacitor official scaffold | none |
| `packages/shared/src/enums/index.ts` (`UserLevel.SUPERADMIN`) | model | transform | `packages/backend/src/modules/users/user.model.ts` `UserLevel` | exact |
| `packages/frontend/src/entities/User/model/consts/userConsts.ts` | config | transform | self (`LEVEL_COLORS` / `LEVEL_OPTIONS`) | exact |
| `packages/frontend/src/pages/UsersPage/` `RolesPage/` `NumbersPage/` | component | CRUD | self + `features/roles` / `features/numbers` tables | exact |
| `packages/backend/src/modules/cloud-admin/modules-registry.service.ts` | service | CRUD | self (`activateModule`, `tenantHasModule`, seed) | exact |
| `packages/backend/src/modules/cloud-admin/tenant-modules.controller.ts` | controller | CRUD | self + `MarketplaceController` | exact |
| `packages/backend/.../billing/` purchase endpoint | controller / service | CRUD | `billing.controller.ts` `charge` + `activateModule` | exact |
| `packages/backend/.../role-start/` (NEW) | controller / service | CRUD | `cloud-settings.controller.ts` / settings JSON pattern | role-match |
| `packages/backend/.../device-token` (FCM skeleton) | controller | request-response | `MarketplaceController.getMyModules` (JWT tenant bind) | role-match |
| `packages/backend/src/modules/auth/superadmin.guard.ts` | middleware | request-response | self | exact |
| `packages/backend/src/modules/cloud-admin/module-access.guard.ts` | middleware | request-response | self (`@RequiresModule`) | exact |
| `features/modules/**/*.test.ts` (registry, roleStart, tokenStorage) | test | transform | `features/auth/model/authSlice.test.ts` | role-match |
| `cloud-admin/**/*.spec.ts` (purchase, device-token) | test | CRUD | existing Jest cloud-admin / billing specs | role-match |

## Pattern Assignments

### `features/modules/` nav registry (utility, transform)

**Analog:** `packages/frontend/src/widgets/Sidebar/lib/buildNavigation.ts`

**Imports + role-gated page list** (lines 1–32, 93–120):
```typescript
import type { TFunction } from 'i18next';
import { LayoutDashboard, Users, Phone /* … */ } from 'lucide-react';
import { UserLevel } from '@/entities/User';
import type { SidebarItemType } from '../ui/SidebarItem/SidebarItem';

export type SidebarNavEntry = SidebarItemType | { type: 'divider'; label: string };

export function buildNavigation(t: TFunction, level: UserLevel | undefined): SidebarNavEntry[] {
  return [
    { name: t('nav.dashboard'), path: '/', icon: LayoutDashboard },
    { type: 'divider', label: t('nav.pbx') },
    { name: t('endpoints.title'), path: '/endpoints', icon: Phone },
    // … Apps / Call Center / Analytics / System blocks
  ];
}
```

**License merge analog** — `packages/frontend/src/shared/hooks/useMyModules.ts` (lines 11–28):
```typescript
export const useMyModules = () => {
  const user = useAppSelector((s) => s.auth.user);
  const isSuperAdmin = user?.level === 0;
  const { data: modules, isLoading } = useGetMyModulesQuery(undefined, {
    skip: isSuperAdmin || !user,
  });
  const activeCodes = useMemo(
    () => new Set((modules ?? []).filter((m) => m.status === 'active').map((m) => m.module_code)),
    [modules],
  );
  const hasModule = (code: string) => activeCodes.has(code);
  return { modules: modules ?? [], activeCodes, hasModule, isLoading };
};
```

**Planner note:** Replace flat `buildNavigation` with typed `ModuleDef` / `ModulePageDef` (RESEARCH Pattern 1). Keep path strings for D-41 redirects. Merge client registry with backend membership + map `status` → Hub `licenseStatus` (`active` | `locked` | `disabled`).

---

### `widgets/ModuleHub/` (component, request-response)

**Analog:** `packages/frontend/src/pages/MarketplacePage/MarketplacePage.tsx` + `MyModulesPage/MyModulesPage.tsx`

**Catalog query + Active/Marketplace split** (Marketplace lines 29–39; MyModules 37–38):
```typescript
const { data: catalog, isLoading } = useGetModuleCatalogQuery();
// MyModules pattern:
const active   = modules.filter((m) => m.status === 'active');
const inactive = modules.filter((m) => m.status !== 'active');
```

**Card / pill chrome** (Marketplace 86–120): `Card` + icon badge + price + CTA — restyle to UI-SPEC **002-E dense list rows** (not hero grid). Locked → Marketplace section dashed card + Buy; disabled → Active muted row (no Buy).

**FSD / Stack imports** (Marketplace 1–9):
```typescript
import { Card, CardHeader, CardContent, Button, Badge, Text, Loader } from '@/shared/ui';
import { VStack, HStack } from '@/shared/ui/Stack';
import { useGetModuleCatalogQuery } from '@/shared/api/endpoints/cloudAdminApi';
```

**Motion stagger analog** — `Sidebar.tsx` lines 47–56, 68–78:
```typescript
transition={{ duration: 0.3, ease: 'easeInOut' }}
// AnimatePresence + opacity for reveal; respect prefers-reduced-motion
```

---

### `widgets/ModuleShell/` (component, request-response)

**Analog:** `AppLayout.tsx` + `Header.tsx` + `Sidebar.tsx` + `SidebarLogo.tsx`

**Shell host + AiChat global** (`AppLayout.tsx` 9–54):
```typescript
export const AppLayout = () => {
  const isAuthenticated = useAppSelector((s) => s.auth.isAuthenticated);
  const isMobile = useIsMobile();
  if (!isAuthenticated) return <Navigate to="/login" replace />;
  return (
    <div /* … */>
      <Sidebar /* … */ />
      <Header /* … */ />
      <main><Outlet /></main>
      <AiChatWidget />
    </div>
  );
};
```

**Topbar actions** (`Header.tsx` 15–67): user menu, lang/theme, search placeholder → become logo→Hub, module chip, ⌘K trigger (UI-SPEC §2). Keep `backdrop-blur` / `layer-header` z-index vars.

**Logo (make navigable to Hub)** — `SidebarLogo.tsx` 11–33: currently non-link `Phone` icon + “Krasterisk”. Wire `Link`/`navigate('/modules')` per D-10.

**In-module tabs visual** — `SuperAdminPage.tsx` 17–32 (`cls.tab` / `cls.tabActive`): local tab bar pattern; ModuleShell tabs use SCSS + primary underline per ARCHITECTURE / UI-SPEC (avoid Tailwind `div` debt of legacy AppLayout).

**Anti-pattern:** Do not copy AppLayout’s native `div` + Tailwind in features/widgets — use Stack/Text + SCSS modules (RESEARCH Pitfall 3).

---

### `widgets/MobileBottomBar/` (component, request-response)

**Analog:** `useIsMobile.ts` + Sidebar mobile drawer

**Breakpoint** (`useIsMobile.ts` 3–16):
```typescript
export function useIsMobile(breakpoint = 768) {
  const [isMobile, setIsMobile] = useState(window.innerWidth < breakpoint);
  // resize listener…
  return isMobile;
}
```

**Mobile overlay / swipe** (`Sidebar.tsx` 30–44, 47–55): touch close + `motion` slide. Phone switcher uses `Sheet` (chip → bottom sheet) per UI-SPEC §3 — not a third tablet layout (≥768 = desktop shell).

**Sheet analog** (`Sheet.tsx` 6–49): Radix Dialog-based side sheet; for phone module switch prefer bottom placement class override on `SheetContent`.

---

### `shared/ui/CommandPalette/` (component, request-response)

**Analog:** `shared/ui/Dialog/Dialog.tsx` (+ Header search as UX cue only)

**Dialog structure** (lines 12–72):
```typescript
const Dialog = DialogPrimitive.Root;
// DialogOverlay layer-modal, DialogContent cva sizes, focus ring via --color-ring
```

**Do not add `cmdk`.** Compose: `Dialog` + `Input` + keyboard-navigable list; empty copy from UI-SPEC Copywriting Contract. Data source = module registry + current module pages (client-side filter).

---

### `app/router/router.tsx` (route, request-response)

**Analog:** self

**Wallboard outside shell** (lines 59–63) — preserve:
```typescript
{
  path: '/callcenter/wallboard',
  element: <CallCenterWallboardPage />,
},
```

**Legacy redirects** (lines 87–88):
```typescript
{ path: 'operator', element: <Navigate to="/callcenter/agent" replace /> },
{ path: 'supervisor', element: <Navigate to="/callcenter/supervisor" replace /> },
```

**Role gate** (lines 90–112) + `RequireRole.tsx` 11–18:
```typescript
export function RequireRole({ allow, children }: RequireRoleProps) {
  const level = useAppSelector(selectUserLevel);
  if (level === undefined || !allow.includes(level)) {
    return <Navigate to="/" replace />;
  }
  return children;
}
```

**Planner adds:** `/modules` Hub route; `/platform/*` tree under `PlatformLayout` + SUPERADMIN; fold `/marketplace` `/my-modules` `/superadmin` → redirects (D-41); post-login role→start resolver before default child.

---

### `app/layouts/PlatformLayout.tsx` (layout, request-response)

**Analog:** `StandaloneLayout.tsx` (separate chrome, no tenant Sidebar) + `SuperAdminPage.tsx` (platform content)

```typescript
// StandaloneLayout — thin Outlet host outside AppLayout
export const StandaloneLayout = () => (
  <div className="p-4 bg-transparent min-h-screen">
    <Outlet />
  </div>
);
```

Add UI-SPEC **006-B** console-chrome banner (warning caption). Guard routes with `RequireRole` allowing level `0` once `UserLevel.SUPERADMIN` exists in shared.

---

### Backend catalog / membership (service + controller, CRUD)

**Analog:** `modules-registry.service.ts` + `tenant-modules.controller.ts`

**Seed + activate** (service 8–34, 108–128):
```typescript
async activateModule(tenantId: number, moduleCode: string): Promise<TenantModule> {
  const [record] = await this.tenantModuleModel.upsert({
    tenant_id: tenantId, module_code: moduleCode, status: 'active', activated_at: new Date(),
  } as any);
  return record;
}
```

**BOX unlock** (service 66–68):
```typescript
const mode = this.configService.get<string>('DEPLOYMENT_MODE', 'BOX').toUpperCase();
if (mode !== 'CLOUD') return true;
```

**Marketplace JWT tenant bind** (controller 70–77):
```typescript
@Get('my-modules')
async getMyModules(@Req() req: any) {
  const tenantId: number = req.user.tenant_id;
  if (!tenantId) return [];
  return this.modulesService.getTenantModules(tenantId);
}
```

**SuperAdmin-only tenant module CRUD** (controller 12–15): `@UseGuards(JwtAuthGuard, SuperAdminGuard)`.

**Extend:** Hub module codes + page membership; tenant enable/disable; API field `licenseStatus`; do not invent parallel marketplace tables without migration plan (RESEARCH Pitfall 1).

---

### Billing checkout skeleton (controller/service, CRUD)

**Analog:** `billing.controller.ts` charge + `ModulesRegistryService.activateModule`

```typescript
@Post('charge')
charge(@Param('id', ParseIntPipe) id: number, @Body() dto: ChargeDto, @Req() req: any) {
  return this.billingService.charge(id, dto.amount, req.user.sub, dto.description, dto.module_code);
}
```

**Frontend RTK** (`cloudAdminApi.ts` 103–126): `activateModule` / `getMyModules` / `getModuleCatalog` — add `purchaseModule` mutation → new tenant `POST /marketplace/purchase` that charge+activate in one transaction.

**Do not** add Stripe/CloudPayments in Phase 8.

---

### Platform vs module license guards (middleware, request-response)

**SuperAdminGuard** (`superadmin.guard.ts` 8–16):
```typescript
if (!user || user.level !== UserLevel.SUPERADMIN) {
  throw new ForbiddenException('SuperAdmin access required');
}
```

**ModuleAccessGuard** (`module-access.guard.ts` 28–50): `@RequiresModule('code')` + BOX skip + SuperAdmin bypass. Extend for Hub market modules (CC/Analytics/AI) on sensitive routes.

---

### Auth token storage adapter (utility/store, file-I/O)

**Analog:** `features/auth/model/authSlice.ts` (lines 15–44, 70–78)

```typescript
const initialState: AuthState = {
  user: JSON.parse(localStorage.getItem('user') || 'null'),
  accessToken: localStorage.getItem('accessToken'),
  refreshToken: localStorage.getItem('refreshToken'),
  isAuthenticated: !!localStorage.getItem('accessToken'),
  // …
};
// login.fulfilled / logout → localStorage.setItem / removeItem
```

**Test stub pattern** (`authSlice.test.ts` 15–21):
```typescript
vi.stubGlobal('localStorage', {
  getItem: vi.fn(), setItem: vi.fn(), removeItem: vi.fn(),
});
```

**Change:** introduce `TokenStorage` interface (RESEARCH Pattern 4); web wrapper sync localStorage; native `@aparajita/capacitor-secure-storage`. Keep web keys; hydrate async on native boot. Unit-test adapter with mocked SecureStorage (NAV-10).

---

### `UserLevel.SUPERADMIN` shared enum (model, transform)

**Backend source of truth** (`user.model.ts` 3–8):
```typescript
export enum UserLevel {
  SUPERADMIN = 0,
  ADMIN = 1,
  OPERATOR = 2,
  SUPERVISOR = 3,
  READONLY = 5,
}
```

**Frontend gap** (`packages/shared/src/enums/index.ts` 1–6): missing `SUPERADMIN = 0`. Add to shared; update `entities/User/model/consts/userConsts.ts` `LEVEL_COLORS` / `LEVEL_OPTIONS` / badges. Frontend already checks `user?.level === 0` in `useMyModules`.

---

### Users / Roles / Numbers rework (component, CRUD)

**Analog pages:** thin FSD orchestrators — `RolesPage.tsx` 10–37 (`VStack` + feature table + page slice actions). Same for Users/Numbers.

**RolesTable** lives under `features/roles` — full editor rework maps grants to Hub modules/pages (depends on registry wave). Keep Numbers JSON model; hybrid cards/table per D-29.

---

### Capacitor scaffold + `shared/lib/capacitor/` (config/utility)

**No in-repo analog.** Follow RESEARCH Standard Stack install + official snippets:

- `npx cap init` with Vite `webDir` = `dist`
- Push: `@capacitor/push-notifications` register → POST device-token skeleton (JWT-bound like `getMyModules`)
- Env flavors: Capacitor environment-specific configs + `VITE_API_URL`

Structure new helpers under `shared/lib/capacitor/` similar to `shared/hooks/` (named exports, thin wrappers, Vitest-mockable).

---

### Tests (test, transform/CRUD)

**Frontend:** Vitest + `describe`/`it`/`vi` as in `authSlice.test.ts`. Targets: `moduleRegistry.test.ts`, `roleStartResolver.test.ts`, `tokenStorage.test.ts`, CommandPalette filter.

**Backend:** Jest next to cloud-admin services; purchase = charge+activate transaction; device-token DTO validation; SuperAdminGuard rejection for non-0.

## Shared Patterns

### Authentication / role gates
**Source:** `RequireRole.tsx`, `SuperAdminGuard`, `ModuleAccessGuard`  
**Apply to:** Hub deep-links, `/platform/*`, CC/Analytics routes, purchase endpoints  
```typescript
// Frontend route: RequireRole allow={[UserLevel.ADMIN, …]}
// Backend platform: @UseGuards(JwtAuthGuard, SuperAdminGuard)
// Backend module: @UseGuards(JwtAuthGuard, ModuleAccessGuard) + @RequiresModule('code')
```

### Tenant isolation
**Source:** `MarketplaceController.getMyModules` — `req.user.tenant_id` / `vpbx_user_uid`  
**Apply to:** purchase, enable/disable, device-token, role→start reads  
Never trust tenant id from client body on tenant APIs.

### RTK Query cloud-admin
**Source:** `cloudAdminApi.ts` injectEndpoints + tag invalidation  
**Apply to:** Hub catalog, my-modules licenseStatus, purchase mutation, role→start CRUD  
```typescript
activateModule: builder.mutation(/* … */, {
  invalidatesTags: (_r, _e, { tenantId }) => [{ type: 'Tenants', id: `modules-${tenantId}` }],
}),
```

### FSD UI composition
**Source:** Marketplace / RolesPage / Sidebar  
**Apply to:** ModuleHub, ModuleShell, BottomBar, CommandPalette, Checkout  
- `shared/ui` + `VStack`/`HStack`/`Text` — no raw `button`/`input` in widgets  
- Tailwind only inside `shared/ui`  
- SCSS modules + `var(--color-*)` above that layer  
- i18n `ru`+`en`; no em dash in copy  
- z-index only via CSS variables (`layer-*`)

### Motion
**Source:** `Sidebar.tsx` `motion` / `AnimatePresence` duration `0.3`  
**Apply to:** Hub first-mount row stagger; skip when `prefers-reduced-motion`

### Billing ledger
**Source:** `BillingBalanceService.charge` + `activateModule`  
**Apply to:** Checkout confirm step only — no new payment processor

### Wallboard + AiChat
**Source:** `router.tsx` wallboard sibling; `AppLayout` mounts `AiChatWidget`  
**Apply to:** ModuleShell host — keep both invariants (D-18, D-40)

## No Analog Found

| File | Role | Data Flow | Reason |
|------|------|-----------|--------|
| `packages/frontend/capacitor.config.ts` + native `android/` `ios/` | config | file-I/O | Capacitor not in repo; use official Capacitor 8 scaffold from RESEARCH |
| `packages/frontend/src/shared/lib/capacitor/*` | utility | request-response | No native bridge layer yet; invent thin wrappers per RESEARCH Pattern 4 + Push docs |

## Metadata

**Analog search scope:** `packages/frontend/src/{app,widgets,features,shared,pages,entities}`, `packages/backend/src/modules/{cloud-admin,auth,users}`, `packages/shared/src/enums`  
**Files scanned:** ~70 (glob + targeted reads)  
**Strong analogs used:** 8 primary (buildNavigation, AppLayout/Sidebar/Header, Marketplace/MyModules, cloudAdminApi/useMyModules, modules-registry + tenant-modules, SuperAdminGuard/ModuleAccessGuard, authSlice, billing charge)  
**Pattern extraction date:** 2026-07-16
