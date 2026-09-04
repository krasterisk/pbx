import * as fs from 'fs';
import * as path from 'path';

/**
 * D-16/D-17 classification of every `src/modules/*` directory.
 *
 * Covered entries must have a registered adapter (via getDomains()).
 * Infrastructure and excluded entries must carry a non-empty reason —
 * a one-word opt-out is indistinguishable from an oversight (T-15-104).
 */
export type CoveredModule = {
  kind: 'covered';
  /** Adapter domain when it differs from the directory name. */
  domain?: string;
  /** Catalog skill name when the domain has no own `src/skills/<dir>/SKILL.md`. */
  sharedSkill?: string;
};

export type ReasonedModule = {
  kind: 'infrastructure' | 'excluded';
  reason: string;
};

export type ModuleCoverageEntry = CoveredModule | ReasonedModule;

export const MODULE_COVERAGE: Record<string, ModuleCoverageEntry> = {
  'ai-agents': {
    kind: 'infrastructure',
    reason:
      'Platform provider catalog, toolsets and billing (D-07); tenants never operate this module.',
  },
  'ai-chat': { kind: 'covered', domain: 'pbx', sharedSkill: 'diagnostics' },
  'ai-platform': { kind: 'covered', domain: 'skills', sharedSkill: 'developer-convention' },
  ami: {
    kind: 'infrastructure',
    reason: 'Asterisk AMI connection and dialplan-apply transport, not a tenant catalog.',
  },
  ari: {
    kind: 'infrastructure',
    reason: 'Asterisk ARI session transport; the tenant domain is voice-robots.',
  },
  auth: {
    kind: 'infrastructure',
    reason: 'JWT and RBAC entry; tenant identity is the users domain.',
  },
  'call-groups': { kind: 'covered' },
  'callback-requests': {
    kind: 'excluded',
    reason:
      'Callback queue is driven by the AMI scanner and call-center UI; live queue mutation has no confirmable agent diff this phase.',
  },
  callcenter: { kind: 'covered' },
  'cloud-admin': {
    kind: 'excluded',
    reason:
      'Platform SuperAdmin hub, marketplace and tenant provisioning — not a tenant PBX domain the agent serves.',
  },
  config: {
    kind: 'infrastructure',
    reason: 'Nest ConfigModule wrapper, not a PBX product surface.',
  },
  contexts: { kind: 'covered' },
  diagnostics: { kind: 'covered' },
  'dialplan-bridge': {
    kind: 'infrastructure',
    reason: 'Internal Asterisk/API bridge, not a tenant-facing catalog.',
  },
  'dialplan-dry-run': { kind: 'covered', domain: 'dialplan_dry_run', sharedSkill: 'routes' },
  directories: { kind: 'covered' },
  endpoints: { kind: 'covered' },
  health: {
    kind: 'infrastructure',
    reason: 'Process health probes with no tenant data.',
  },
  ivrs: { kind: 'covered' },
  'komandor-claims': { kind: 'covered', sharedSkill: 'operations' },
  logger: {
    kind: 'infrastructure',
    reason: 'Audit writer used by mutating paths; not a tenant catalog the agent lists.',
  },
  mailer: {
    kind: 'infrastructure',
    reason: 'SMTP transport; outbound history belongs to the notifications domain.',
  },
  mcp: {
    kind: 'infrastructure',
    reason: 'External JSON-RPC transport; tools come from adapters, not this module.',
  },
  moh: { kind: 'covered' },
  notifications: { kind: 'covered', sharedSkill: 'operations' },
  numbers: { kind: 'covered' },
  prompts: { kind: 'covered', sharedSkill: 'operations' },
  queues: { kind: 'covered' },
  redis: {
    kind: 'infrastructure',
    reason: 'Cache and pub/sub infrastructure, not a tenant entity.',
  },
  reports: { kind: 'covered' },
  roles: {
    kind: 'infrastructure',
    reason: 'RBAC guard plumbing; tenant people are the users domain.',
  },
  'route-references': {
    kind: 'excluded',
    reason:
      'Read model for the route-builder picker; routes, IVRs and directories already have adapters.',
  },
  'route-templates': { kind: 'covered', domain: 'route_templates', sharedSkill: 'routes' },
  routes: { kind: 'covered' },
  'service-requests': { kind: 'covered', sharedSkill: 'operations' },
  sms: { kind: 'covered', sharedSkill: 'messaging' },
  'stt-engines': { kind: 'covered', sharedSkill: 'speech-engines' },
  'system-settings': { kind: 'covered', sharedSkill: 'settings' },
  telegram: { kind: 'covered', sharedSkill: 'messaging' },
  'tenant-settings': { kind: 'covered', sharedSkill: 'settings' },
  'time-groups': { kind: 'covered' },
  trunks: { kind: 'covered' },
  'tts-engines': { kind: 'covered', sharedSkill: 'speech-engines' },
  users: { kind: 'covered' },
  'voice-robots': { kind: 'covered' },
  voicemail: { kind: 'covered' },
};

export const BACKEND_MODULES_DIR = path.resolve(__dirname, '..');

export function listModuleDirectories(modulesDir: string = BACKEND_MODULES_DIR): string[] {
  return fs
    .readdirSync(modulesDir, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name)
    .sort();
}

export function adapterDomainOf(dir: string, entry: ModuleCoverageEntry): string {
  return entry.kind === 'covered' ? (entry.domain ?? dir) : dir;
}

export function collectCoverageFailures(input: {
  coverage: Record<string, ModuleCoverageEntry>;
  directories: string[];
  registeredDomains: string[];
}): string[] {
  const { coverage, directories, registeredDomains } = input;
  const failures: string[] = [];
  const dirSet = new Set(directories);
  const registered = new Set(registeredDomains);
  const classifiedAdapterDomains = new Set<string>();

  for (const dir of directories) {
    if (!(dir in coverage)) {
      failures.push(`unclassified module directory: ${dir}`);
    }
  }

  for (const key of Object.keys(coverage)) {
    if (!dirSet.has(key)) {
      failures.push(`classified directory missing from filesystem: ${key}`);
    }
  }

  for (const [dir, entry] of Object.entries(coverage)) {
    if (entry.kind === 'covered') {
      const domain = adapterDomainOf(dir, entry);
      classifiedAdapterDomains.add(domain);
      if (!registered.has(domain)) {
        failures.push(`covered domain missing adapter: ${domain}`);
      }
    } else if (!entry.reason.trim()) {
      failures.push(`classification ${dir} (${entry.kind}) has no reason`);
    }
  }

  for (const domain of registeredDomains) {
    if (!classifiedAdapterDomains.has(domain)) {
      failures.push(`registered adapter domain is not classified: ${domain}`);
    }
  }

  return failures;
}
