/**
 * Hub-aware role grant mapping (D-20 / NAV-16).
 * Backend stores `roles.role` as TEXT JSON; v2 uses `{ version: 2, hub: { moduleCode: pageId[] } }`.
 * Legacy `table_module_*` keys are migrated on read.
 */

export type HubRoleGrants = Record<string, string[]>;

export interface RoleGrantsV2 {
  version: 2;
  hub: HubRoleGrants;
}

/** Legacy sidebar module table keys → Hub module codes. */
const LEGACY_MODULE_TO_HUB: Record<string, string> = {
  table_module_pbx: 'core',
  table_module_inbound: 'core',
  table_module_outbound: 'core',
  table_module_apps: 'apps',
  table_module_ivr: 'apps',
  table_module_cc: 'callcenter',
  table_module_callcenter: 'callcenter',
  table_module_system: 'system',
  table_module_reports: 'analytics',
  table_module_analytics: 'analytics',
  table_module_ai: 'ai',
  table_module_overview: 'overview',
};

/** Legacy page / menu ids → Hub page ids (moduleRegistry). */
const LEGACY_PAGE_ALIASES: Record<string, string> = {
  peers: 'endpoints',
  endpoints: 'endpoints',
  contexts: 'contexts',
  trunks: 'trunks',
  routes: 'routes',
  time_groups: 'time-groups',
  'time-groups': 'time-groups',
  phonebooks: 'phonebooks',
  provision: 'provision-templates',
  provision_templates: 'provision-templates',
  'provision-templates': 'provision-templates',
  ivr: 'ivrs',
  ivrs: 'ivrs',
  queues: 'queues',
  prompts: 'prompts',
  moh: 'moh',
  voice_robot: 'voice-robots',
  voice_robots: 'voice-robots',
  'voice-robots': 'voice-robots',
  call_groups: 'call-groups',
  'call-groups': 'call-groups',
  integrations: 'integrations',
  users: 'users',
  users_roles: 'users',
  roles: 'roles',
  numbers: 'numbers',
  settings: 'settings',
  tts_engines: 'tts-engines',
  'tts-engines': 'tts-engines',
  stt_engines: 'stt-engines',
  'stt-engines': 'stt-engines',
  audit_log: 'audit-log',
  'audit-log': 'audit-log',
  tenant_modules: 'tenant-modules',
  'tenant-modules': 'tenant-modules',
  service_requests: 'service-requests',
  'service-requests': 'service-requests',
  cc_agent: 'cc-agent',
  'cc-agent': 'cc-agent',
  cc_supervisor: 'cc-supervisor',
  'cc-supervisor': 'cc-supervisor',
  cc_reports: 'cc-reports',
  'cc-reports': 'cc-reports',
  cc_settings: 'cc-settings',
  'cc-settings': 'cc-settings',
  reports: 'reports',
  cdr: 'cdr',
  voice_robot_cdr: 'voice-robot-cdr',
  'voice-robot-cdr': 'voice-robot-cdr',
  ai_agents: 'ai-agents',
  'ai-agents': 'ai-agents',
  dashboard: 'dashboard',
};

function normalizePageId(raw: string): string {
  const key = raw.trim();
  return LEGACY_PAGE_ALIASES[key] ?? key;
}

/** Unique page ids preserving first-seen order (registry / editor order). */
function uniqStable(ids: string[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const id of ids) {
    if (!id || seen.has(id)) continue;
    seen.add(id);
    out.push(id);
  }
  return out;
}

function normalizeGrants(raw: HubRoleGrants): HubRoleGrants {
  const out: HubRoleGrants = {};
  for (const [mod, pages] of Object.entries(raw)) {
    if (!mod || !Array.isArray(pages)) continue;
    const normalized = uniqStable(pages.map((p) => normalizePageId(String(p))));
    if (normalized.length) out[mod] = normalized;
  }
  return out;
}

function migrateLegacy(obj: Record<string, unknown>): HubRoleGrants {
  const out: HubRoleGrants = {};
  for (const [key, value] of Object.entries(obj)) {
    if (!key.startsWith('table_module_')) continue;
    const hubCode = LEGACY_MODULE_TO_HUB[key];
    if (!hubCode) continue;
    const pages = Array.isArray(value)
      ? value.map((p) => normalizePageId(String(p)))
      : [];
    const merged = uniqStable([...(out[hubCode] ?? []), ...pages]);
    if (merged.length) out[hubCode] = merged;
  }
  return out;
}

/** Parse roles.role TEXT (or object) into Hub module→page grants. Never throws. */
export function parseRoleGrants(raw: string | object | null | undefined): HubRoleGrants {
  if (raw == null || raw === '') return {};
  let obj: unknown;
  if (typeof raw === 'string') {
    try {
      obj = JSON.parse(raw);
    } catch {
      return {};
    }
  } else {
    obj = raw;
  }
  if (!obj || typeof obj !== 'object' || Array.isArray(obj)) return {};
  const record = obj as Record<string, unknown>;

  if (record.version === 2 && record.hub && typeof record.hub === 'object' && !Array.isArray(record.hub)) {
    return normalizeGrants(record.hub as HubRoleGrants);
  }

  if (record.hub && typeof record.hub === 'object' && !Array.isArray(record.hub)) {
    return normalizeGrants(record.hub as HubRoleGrants);
  }

  return migrateLegacy(record);
}

/** Serialize Hub grants to TEXT JSON for POST/PUT /roles. */
export function serializeRoleGrants(grants: HubRoleGrants): string {
  const hub = normalizeGrants(grants);
  const payload: RoleGrantsV2 = { version: 2, hub };
  return JSON.stringify(payload);
}

export function isPageGranted(grants: HubRoleGrants, moduleCode: string, pageId: string): boolean {
  return (grants[moduleCode] ?? []).includes(pageId);
}

export function togglePageGrant(
  grants: HubRoleGrants,
  moduleCode: string,
  pageId: string,
  enabled: boolean,
): HubRoleGrants {
  const current = new Set(grants[moduleCode] ?? []);
  if (enabled) current.add(pageId);
  else current.delete(pageId);
  const next = { ...grants };
  const pages = uniqStable(Array.from(current));
  if (pages.length) next[moduleCode] = pages;
  else delete next[moduleCode];
  return next;
}

export function toggleModuleGrant(
  grants: HubRoleGrants,
  moduleCode: string,
  pageIds: string[],
  enabled: boolean,
): HubRoleGrants {
  let next = { ...grants };
  for (const pageId of pageIds) {
    next = togglePageGrant(next, moduleCode, pageId, enabled);
  }
  return next;
}
