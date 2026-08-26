/**
 * Phase 8 Hub catalog baseline (D-12 / D-15 / D-19).
 * Additive layer over page-level MODULES_SEED — do not remove registry rows.
 */

export type HubModuleKind = 'base' | 'market';

export interface HubModuleSeed {
  code: string;
  name: string;
  kind: HubModuleKind;
  sort_order: number;
  requires_cloud: boolean;
  /** Overview is a cross-cutting tile (D-14), still seeded for Hub metadata. */
  is_tile?: boolean;
}

export interface HubModulePageSeed {
  hub_code: string;
  page_code: string;
  path: string | null;
  sort_order: number;
}

export const HUB_TABLES = [
  'hub_modules',
  'hub_module_pages',
  'role_start_defaults',
  'tenant_role_start',
] as const;

export const HUB_MODULES_SEED: HubModuleSeed[] = [
  { code: 'overview', name: 'Overview', kind: 'base', sort_order: 0, requires_cloud: false, is_tile: true },
  { code: 'core', name: 'Core', kind: 'base', sort_order: 10, requires_cloud: false },
  { code: 'apps', name: 'Apps', kind: 'base', sort_order: 20, requires_cloud: false },
  { code: 'system', name: 'System', kind: 'base', sort_order: 30, requires_cloud: false },
  { code: 'callcenter', name: 'Call Center', kind: 'market', sort_order: 40, requires_cloud: false },
  { code: 'analytics', name: 'Analytics', kind: 'market', sort_order: 50, requires_cloud: false },
  { code: 'ai', name: 'AI', kind: 'market', sort_order: 60, requires_cloud: false },
];

/** page_code aligns with MODULES_SEED / ModuleAccessGuard where possible. */
export const HUB_MODULE_PAGES_SEED: HubModulePageSeed[] = [
  // Overview tile
  { hub_code: 'overview', page_code: 'dashboard', path: '/', sort_order: 0 },

  // Core (base)
  { hub_code: 'core', page_code: 'endpoints', path: '/endpoints', sort_order: 10 },
  { hub_code: 'core', page_code: 'contexts', path: '/contexts', sort_order: 20 },
  { hub_code: 'core', page_code: 'trunks', path: '/trunks', sort_order: 30 },
  { hub_code: 'core', page_code: 'routes', path: '/routes', sort_order: 40 },
  { hub_code: 'core', page_code: 'time_groups', path: '/time-groups', sort_order: 50 },
  { hub_code: 'core', page_code: 'phonebooks', path: '/phonebooks', sort_order: 60 },
  { hub_code: 'core', page_code: 'provision', path: '/provision-templates', sort_order: 70 },

  // Apps (base) — queues stay in Apps (D-15)
  { hub_code: 'apps', page_code: 'ivr', path: '/ivrs', sort_order: 10 },
  { hub_code: 'apps', page_code: 'queues', path: '/queues', sort_order: 20 },
  { hub_code: 'apps', page_code: 'prompts', path: '/prompts', sort_order: 30 },
  { hub_code: 'apps', page_code: 'moh', path: '/moh', sort_order: 40 },
  { hub_code: 'apps', page_code: 'voice_robot', path: '/voice-robots', sort_order: 50 },
  { hub_code: 'apps', page_code: 'call_groups', path: '/call-groups', sort_order: 60 },
  { hub_code: 'apps', page_code: 'integrations', path: '/integrations', sort_order: 70 },

  // System (base)
  { hub_code: 'system', page_code: 'users_roles', path: '/users', sort_order: 10 },
  { hub_code: 'system', page_code: 'roles', path: '/roles', sort_order: 20 },
  { hub_code: 'system', page_code: 'numbers', path: '/numbers', sort_order: 30 },
  { hub_code: 'system', page_code: 'settings', path: '/settings', sort_order: 40 },
  { hub_code: 'system', page_code: 'tts_engines', path: '/settings/tts-engines', sort_order: 50 },
  { hub_code: 'system', page_code: 'stt_engines', path: '/settings/stt-engines', sort_order: 60 },
  { hub_code: 'system', page_code: 'audit_log', path: '/audit-log', sort_order: 70 },
  { hub_code: 'system', page_code: 'tenant_modules', path: '/my-modules', sort_order: 80 },

  // Call Center (market) — service_requests under CC (D-19)
  { hub_code: 'callcenter', page_code: 'service_requests', path: '/service-requests', sort_order: 10 },
  { hub_code: 'callcenter', page_code: 'komandor_claims', path: '/komandor-claims', sort_order: 15 },
  { hub_code: 'callcenter', page_code: 'cc_agent', path: '/callcenter/agent', sort_order: 20 },
  { hub_code: 'callcenter', page_code: 'cc_supervisor', path: '/callcenter/supervisor', sort_order: 30 },
  { hub_code: 'callcenter', page_code: 'cc_reports', path: '/callcenter/reports', sort_order: 40 },
  { hub_code: 'callcenter', page_code: 'cc_settings', path: '/callcenter/settings', sort_order: 50 },

  // Analytics (market)
  { hub_code: 'analytics', page_code: 'reports', path: '/reports', sort_order: 10 },
  { hub_code: 'analytics', page_code: 'cdr', path: '/reports/cdr', sort_order: 20 },
  { hub_code: 'analytics', page_code: 'voice_robot_cdr', path: '/reports/voice-robot-cdr', sort_order: 30 },

  // AI (market)
  { hub_code: 'ai', page_code: 'ai_agents', path: '/ai-agents', sort_order: 10 },
];
