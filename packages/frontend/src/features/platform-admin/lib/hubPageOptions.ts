import type { MultiSelectOption } from '@/shared/ui';

/** Known Hub page codes/paths (aligned with hub-modules.seed). */
export const HUB_PAGE_OPTIONS: MultiSelectOption[] = [
  { value: 'dashboard', label: 'dashboard (/)' },
  { value: 'endpoints', label: 'endpoints (/endpoints)' },
  { value: 'contexts', label: 'contexts (/contexts)' },
  { value: 'trunks', label: 'trunks (/trunks)' },
  { value: 'routes', label: 'routes (/routes)' },
  { value: 'time_groups', label: 'time_groups (/time-groups)' },
  { value: 'phonebooks', label: 'phonebooks (/phonebooks)' },
  { value: 'provision', label: 'provision (/provision-templates)' },
  { value: 'ivr', label: 'ivr (/ivrs)' },
  { value: 'queues', label: 'queues (/queues)' },
  { value: 'prompts', label: 'prompts (/prompts)' },
  { value: 'moh', label: 'moh (/moh)' },
  { value: 'voice_robot', label: 'voice_robot (/voice-robots)' },
  { value: 'call_groups', label: 'call_groups (/call-groups)' },
  { value: 'integrations', label: 'integrations (/integrations)' },
  { value: 'users_roles', label: 'users_roles (/users)' },
  { value: 'roles', label: 'roles (/roles)' },
  { value: 'numbers', label: 'numbers (/numbers)' },
  { value: 'settings', label: 'settings (/settings)' },
  { value: 'tts_engines', label: 'tts_engines (/settings/tts-engines)' },
  { value: 'stt_engines', label: 'stt_engines (/settings/stt-engines)' },
  { value: 'audit_log', label: 'audit_log (/audit-log)' },
  { value: 'tenant_modules', label: 'tenant_modules (/system/modules)' },
  { value: 'service_requests', label: 'service_requests (/service-requests)' },
  { value: 'cc_agent', label: 'cc_agent (/callcenter/agent)' },
  { value: 'cc_supervisor', label: 'cc_supervisor (/callcenter/supervisor)' },
  { value: 'cc_reports', label: 'cc_reports (/callcenter/reports)' },
  { value: 'cc_settings', label: 'cc_settings (/callcenter/settings)' },
  { value: 'reports', label: 'reports (/reports)' },
  { value: 'cdr', label: 'cdr (/reports/cdr)' },
  { value: 'voice_robot_cdr', label: 'voice_robot_cdr (/reports/voice-robot-cdr)' },
  { value: 'ai_agents', label: 'ai_agents (/ai-agents)' },
];

const PATH_BY_PAGE: Record<string, string> = Object.fromEntries(
  HUB_PAGE_OPTIONS.map((o) => {
    const match = /\(([^)]+)\)\s*$/.exec(o.label);
    return [o.value, match?.[1] ?? null];
  }).filter(([, path]) => path != null) as Array<[string, string]>,
);

export function pathForPageCode(pageCode: string): string | null {
  return PATH_BY_PAGE[pageCode] ?? null;
}
