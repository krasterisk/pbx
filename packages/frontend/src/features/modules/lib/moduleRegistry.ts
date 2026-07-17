import {
  LayoutDashboard,
  Phone,
  Network,
  Waypoints,
  Route,
  Calendar,
  BookOpen,
  FileCode,
  Bot,
  AppWindow,
  ListOrdered,
  Mic,
  Music,
  ClipboardList,
  Headphones,
  Monitor,
  BarChart3,
  Settings,
  Users,
  Shield,
  List,
  Volume2,
  AudioLines,
  ClipboardCheck,
  PhoneCall,
  Activity,
  Sparkles,
  Package,
} from 'lucide-react';
import { UserLevel } from '@krasterisk/shared';
import type { HubModuleRow, LicenseStatus, ModuleDef, ModulePageDef } from '../types';
import { sortByFavorites } from './favorites';

/** Minimal catalog shape for license merge (matches IHubCatalogItem). */
export interface HubCatalogLicenseItem {
  code: string;
  licenseStatus: LicenseStatus;
  name?: string;
}

const ADMIN_PLUS: UserLevel[] = [UserLevel.ADMIN, UserLevel.SUPERADMIN];
const CC_AGENT_LEVELS: UserLevel[] = [
  UserLevel.OPERATOR,
  UserLevel.SUPERVISOR,
  UserLevel.ADMIN,
  UserLevel.SUPERADMIN,
];
const CC_SUPERVISOR_LEVELS: UserLevel[] = [
  UserLevel.SUPERVISOR,
  UserLevel.ADMIN,
  UserLevel.SUPERADMIN,
];

/**
 * Baseline Hub module → page mapping (D-15 / D-19 discretion table).
 * Wallboard TV (`/callcenter/wallboard`) stays outside ModuleShell — not listed here.
 */
export const BASELINE_MODULES: ModuleDef[] = [
  {
    code: 'overview',
    kind: 'base',
    navVariant: 'sidebar',
    labelKey: 'nav.dashboard',
    pages: [
      {
        id: 'dashboard',
        path: '/',
        labelKey: 'nav.dashboard',
        icon: LayoutDashboard,
      },
    ],
  },
  {
    code: 'core',
    kind: 'base',
    navVariant: 'sidebar',
    labelKey: 'nav.pbx',
    pages: [
      { id: 'endpoints', path: '/endpoints', labelKey: 'endpoints.title', icon: Phone },
      { id: 'contexts', path: '/contexts', labelKey: 'contexts.title', icon: Network },
      { id: 'trunks', path: '/trunks', labelKey: 'nav.trunks', icon: Waypoints },
      { id: 'routes', path: '/routes', labelKey: 'nav.routes', icon: Route },
      { id: 'time-groups', path: '/time-groups', labelKey: 'nav.timeGroups', icon: Calendar },
      { id: 'phonebooks', path: '/phonebooks', labelKey: 'nav.phonebooks', icon: BookOpen },
      {
        id: 'provision-templates',
        path: '/provision-templates',
        labelKey: 'nav.provisionTemplates',
        icon: FileCode,
      },
    ],
  },
  {
    code: 'apps',
    kind: 'base',
    navVariant: 'sidebar',
    labelKey: 'nav.apps',
    pages: [
      { id: 'ivrs', path: '/ivrs', labelKey: 'nav.ivrs', icon: AppWindow },
      { id: 'queues', path: '/queues', labelKey: 'nav.queues', icon: ListOrdered },
      { id: 'prompts', path: '/prompts', labelKey: 'promptsPage.title', icon: Mic },
      { id: 'moh', path: '/moh', labelKey: 'moh.title', icon: Music },
      { id: 'voice-robots', path: '/voice-robots', labelKey: 'nav.voiceRobots', icon: Bot },
      { id: 'call-groups', path: '/call-groups', labelKey: 'nav.callGroups', icon: Phone },
      {
        id: 'integrations',
        path: '/integrations',
        labelKey: 'nav.integrations',
        icon: Package,
      },
    ],
  },
  {
    code: 'system',
    kind: 'base',
    navVariant: 'sidebar',
    labelKey: 'nav.system',
    pages: [
      { id: 'users', path: '/users', labelKey: 'nav.users', icon: Users, minLevels: ADMIN_PLUS },
      { id: 'roles', path: '/roles', labelKey: 'nav.roles', icon: Shield, minLevels: ADMIN_PLUS },
      { id: 'numbers', path: '/numbers', labelKey: 'nav.numbers', icon: List, minLevels: ADMIN_PLUS },
      { id: 'settings', path: '/settings', labelKey: 'nav.settings', icon: Settings, minLevels: ADMIN_PLUS },
      {
        id: 'tts-engines',
        path: '/settings/tts-engines',
        labelKey: 'nav.ttsEngines',
        icon: Volume2,
        minLevels: ADMIN_PLUS,
      },
      {
        id: 'stt-engines',
        path: '/settings/stt-engines',
        labelKey: 'nav.sttEngines',
        icon: AudioLines,
        minLevels: ADMIN_PLUS,
      },
      {
        id: 'audit-log',
        path: '/audit-log',
        labelKey: 'nav.auditLog',
        icon: ClipboardCheck,
        minLevels: ADMIN_PLUS,
      },
      {
        id: 'tenant-modules',
        path: '/system/modules',
        labelKey: 'nav.modules',
        icon: Package,
        minLevels: ADMIN_PLUS,
      },
    ],
  },
  {
    code: 'callcenter',
    kind: 'market',
    navVariant: 'sidebar',
    labelKey: 'nav.callcenter',
    pages: [
      {
        id: 'service-requests',
        path: '/service-requests',
        labelKey: 'nav.serviceRequests',
        icon: ClipboardList,
      },
      {
        id: 'cc-agent',
        path: '/callcenter/agent',
        labelKey: 'nav.operator',
        icon: Headphones,
        minLevels: CC_AGENT_LEVELS,
      },
      {
        id: 'cc-supervisor',
        path: '/callcenter/supervisor',
        labelKey: 'nav.supervisor',
        icon: Monitor,
        minLevels: CC_SUPERVISOR_LEVELS,
      },
      {
        id: 'cc-reports',
        path: '/callcenter/reports',
        labelKey: 'nav.ccReports',
        icon: BarChart3,
        minLevels: CC_SUPERVISOR_LEVELS,
      },
      {
        id: 'cc-settings',
        path: '/callcenter/settings',
        labelKey: 'nav.ccSettings',
        icon: Settings,
        minLevels: ADMIN_PLUS,
      },
    ],
  },
  {
    code: 'analytics',
    kind: 'market',
    navVariant: 'sidebar',
    labelKey: 'nav.analytics',
    pages: [
      { id: 'reports', path: '/reports', labelKey: 'nav.reports', icon: BarChart3 },
      { id: 'cdr', path: '/reports/cdr', labelKey: 'nav.cdr', icon: PhoneCall },
      {
        id: 'voice-robot-cdr',
        path: '/reports/voice-robot-cdr',
        labelKey: 'nav.voiceRobotCdr',
        icon: Activity,
      },
    ],
  },
  {
    code: 'ai',
    kind: 'market',
    navVariant: 'sidebar',
    labelKey: 'nav.ai',
    pages: [
      { id: 'ai-agents', path: '/ai-agents', labelKey: 'nav.aiAgents', icon: Sparkles },
    ],
  },
];

export function getBaselineModule(code: string): ModuleDef | undefined {
  return BASELINE_MODULES.find((m) => m.code === code);
}

/** Pages visible for the given UserLevel (no minLevels = visible to all). */
export function filterPagesByLevel(
  pages: ModulePageDef[],
  level: UserLevel | undefined,
): ModulePageDef[] {
  if (level === undefined) {
    return pages.filter((p) => !p.minLevels || p.minLevels.length === 0);
  }
  return pages.filter((p) => !p.minLevels || p.minLevels.includes(level));
}

/** Module with pages filtered by UserLevel. */
export function filterModuleForLevel(
  module: ModuleDef,
  level: UserLevel | undefined,
): ModuleDef {
  return { ...module, pages: filterPagesByLevel(module.pages, level) };
}

export function filterModulesForLevel(
  modules: ModuleDef[],
  level: UserLevel | undefined,
): ModuleDef[] {
  return modules
    .map((m) => filterModuleForLevel(m, level))
    .filter((m) => m.pages.length > 0);
}

export interface LicensePartition {
  active: ModuleDef[];
  disabled: ModuleDef[];
  locked: ModuleDef[];
}

/** Split modules into Hub Active / Disabled / Locked sections by license map. */
export function partitionModulesByLicense(
  modules: ModuleDef[],
  statusByCode: Record<string, LicenseStatus>,
): LicensePartition {
  const active: ModuleDef[] = [];
  const disabled: ModuleDef[] = [];
  const locked: ModuleDef[] = [];

  for (const mod of modules) {
    // Base modules default to active when status omitted; market defaults to locked
    const status =
      statusByCode[mod.code] ?? (mod.kind === 'base' ? 'active' : 'locked');
    if (status === 'active') active.push(mod);
    else if (status === 'disabled') disabled.push(mod);
    else locked.push(mod);
  }

  return { active, disabled, locked };
}

/** Resolve licenseStatus for a baseline module from hub-catalog (server is source of truth). */
export function licenseStatusFromCatalog(
  catalog: HubCatalogLicenseItem[] | undefined,
  module: ModuleDef,
): LicenseStatus {
  const hit = catalog?.find((c) => c.code === module.code);
  if (hit) return hit.licenseStatus;
  // Client must not invent active for market modules when catalog absent
  return module.kind === 'base' ? 'active' : 'locked';
}

/** Merge BASELINE_MODULES with RTK hub catalog → Hub rows. */
export function mergeModulesWithCatalog(
  modules: ModuleDef[],
  catalog: HubCatalogLicenseItem[] | undefined,
  favoriteCodes: string[] = [],
): HubModuleRow[] {
  const favSet = new Set(favoriteCodes);
  return modules.map((mod) => {
    const cat = catalog?.find((c) => c.code === mod.code);
    return {
      ...mod,
      licenseStatus: licenseStatusFromCatalog(catalog, mod),
      favorite: favSet.has(mod.code),
      catalogName: cat?.name,
    };
  });
}

export interface HubSections {
  /** Active section: active + disabled (disabled are not Buy targets). */
  active: HubModuleRow[];
  /** Marketplace section: locked only. */
  marketplace: HubModuleRow[];
}

/**
 * Split Hub rows into Active (active+disabled, favorites sorted to top)
 * and Marketplace (locked only — never disabled).
 */
export function buildHubSections(
  rows: HubModuleRow[],
  favoriteCodes: string[],
): HubSections {
  const activeRaw = rows.filter(
    (r) => r.licenseStatus === 'active' || r.licenseStatus === 'disabled',
  );
  const marketplace = rows.filter((r) => r.licenseStatus === 'locked');
  const active = sortByFavorites(activeRaw, favoriteCodes).map((r) => ({
    ...r,
    favorite: favoriteCodes.includes(r.code),
  }));
  return { active, marketplace };
}

/**
 * Resolve which Hub module owns a pathname (longest page path wins).
 * Returns undefined on Hub route `/modules` or when no match.
 */
export function findModuleByPath(
  pathname: string,
  modules: ModuleDef[] = BASELINE_MODULES,
): ModuleDef | undefined {
  if (pathname === '/modules' || pathname.startsWith('/modules/')) {
    return undefined;
  }

  let best: { mod: ModuleDef; len: number } | undefined;
  for (const mod of modules) {
    for (const page of mod.pages) {
      const exact = pathname === page.path;
      const nested =
        page.path !== '/' &&
        (pathname === page.path || pathname.startsWith(`${page.path}/`));
      if (exact || nested) {
        if (!best || page.path.length > best.len) {
          best = { mod, len: page.path.length };
        }
      }
    }
  }
  return best?.mod;
}

/** First navigable page path for a module (after level filter). */
export function getModuleEntryPath(
  module: ModuleDef,
  level: UserLevel | undefined,
): string {
  const pages = filterPagesByLevel(module.pages, level);
  return pages[0]?.path ?? '/';
}
