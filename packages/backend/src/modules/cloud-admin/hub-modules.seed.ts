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
  // Same code as MODULES_SEED so no LEGACY_HUB_LICENSE_CODES entry is needed.
  { code: 'autodial', name: 'Autodial', kind: 'market', sort_order: 70, requires_cloud: false },
  { code: 'speech_analytics', name: 'Speech analytics', kind: 'market', sort_order: 80, requires_cloud: false },
  { code: 'ai_voice_robots', name: 'AI robots', kind: 'market', sort_order: 90, requires_cloud: false },
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
  { hub_code: 'core', page_code: 'directories', path: '/directories', sort_order: 60 },
  { hub_code: 'core', page_code: 'provision', path: '/provision-templates', sort_order: 70 },

  // Apps (base) — queues stay in Apps (D-15)
  { hub_code: 'apps', page_code: 'ivr', path: '/ivrs', sort_order: 10 },
  { hub_code: 'apps', page_code: 'queues', path: '/queues', sort_order: 20 },
  { hub_code: 'apps', page_code: 'prompts', path: '/prompts', sort_order: 30 },
  { hub_code: 'apps', page_code: 'moh', path: '/moh', sort_order: 40 },
  { hub_code: 'apps', page_code: 'voice_robot', path: '/voice-robots', sort_order: 50 },
  { hub_code: 'apps', page_code: 'call_groups', path: '/call-groups', sort_order: 60 },
  { hub_code: 'apps', page_code: 'conferences', path: '/conferences', sort_order: 65 },
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

  // Call Center (market) — custom robot tables stay off the general menu
  { hub_code: 'callcenter', page_code: 'cc_agent', path: '/callcenter/agent', sort_order: 20 },
  { hub_code: 'callcenter', page_code: 'cc_supervisor', path: '/callcenter/supervisor', sort_order: 30 },
  { hub_code: 'callcenter', page_code: 'cc_reports', path: '/callcenter/reports', sort_order: 40 },
  { hub_code: 'callcenter', page_code: 'cc_settings', path: '/callcenter/settings', sort_order: 50 },

  // Autodial (market)
  { hub_code: 'autodial', page_code: 'autodial_campaigns', path: '/autodial', sort_order: 10 },
  { hub_code: 'autodial', page_code: 'autodial_bases', path: '/autodial/bases', sort_order: 20 },
  { hub_code: 'autodial', page_code: 'autodial_monitor', path: '/autodial/monitor', sort_order: 30 },
  { hub_code: 'autodial', page_code: 'autodial_reports', path: '/autodial/reports', sort_order: 40 },

  // Analytics (market)
  { hub_code: 'analytics', page_code: 'reports', path: '/reports', sort_order: 10 },
  { hub_code: 'analytics', page_code: 'cdr', path: '/reports/cdr', sort_order: 20 },
  { hub_code: 'analytics', page_code: 'voice_robot_cdr', path: '/reports/voice-robot-cdr', sort_order: 30 },

  // AI (market)
  { hub_code: 'ai', page_code: 'ai_providers', path: '/ai-providers', sort_order: 10 },
  { hub_code: 'ai', page_code: 'ai_agents', path: '/ai-agents', sort_order: 20 },

  // Independent AI products (landing + connections; scenario robots stay under apps)
  { hub_code: 'speech_analytics', page_code: 'speech_analytics_landing', path: '/speech-analytics', sort_order: 10 },
  { hub_code: 'speech_analytics', page_code: 'speech_analytics_projects', path: '/speech-analytics/projects', sort_order: 15 },
  { hub_code: 'speech_analytics', page_code: 'speech_analytics_dashboard', path: '/speech-analytics/dashboard', sort_order: 16 },
  // D-37: journal replaces Reports product path; Excel is a journal toolbar action
  { hub_code: 'speech_analytics', page_code: 'speech_analytics_conversations', path: '/speech-analytics/conversations', sort_order: 17 },
  { hub_code: 'speech_analytics', page_code: 'speech_analytics_connections', path: '/speech-analytics/connections', sort_order: 20 },
  { hub_code: 'ai_voice_robots', page_code: 'ai_voice_robots_landing', path: '/ai-robots', sort_order: 10 },
  { hub_code: 'ai_voice_robots', page_code: 'ai_voice_robots_studio', path: '/ai-robots/studio', sort_order: 12 },
  { hub_code: 'ai_voice_robots', page_code: 'ai_voice_robots_sessions', path: '/ai-robots/sessions', sort_order: 14 },
  { hub_code: 'ai_voice_robots', page_code: 'ai_voice_robots_preview', path: '/ai-robots/preview', sort_order: 16 },
  { hub_code: 'ai_voice_robots', page_code: 'ai_voice_robots_sip', path: '/ai-robots/sip', sort_order: 17 },
  { hub_code: 'ai_voice_robots', page_code: 'ai_voice_robots_tools', path: '/ai-robots/tools', sort_order: 18 },
  { hub_code: 'ai_voice_robots', page_code: 'ai_voice_robots_knowledge', path: '/ai-robots/knowledge', sort_order: 19 },
  { hub_code: 'ai_voice_robots', page_code: 'ai_voice_robots_connections', path: '/ai-robots/connections', sort_order: 20 },
];
