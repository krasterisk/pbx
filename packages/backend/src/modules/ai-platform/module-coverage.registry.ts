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
  /**
   * Agent capability surface:
   * - read: list/get only
   * - configure: propose/apply mutations allowed for tenant UI
   * - operation: live-ops without durable config (pause/reload)
   * - immutable: must never become tenant-agent writes
   */
  capability?: 'read' | 'configure' | 'operation' | 'immutable';
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
  'ai-chat': { kind: 'covered', domain: 'pbx', sharedSkill: 'diagnostics', capability: 'read' },
  'ai-platform': { kind: 'covered', domain: 'skills', sharedSkill: 'developer-convention', capability: 'read' },
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
  'call-groups': { kind: 'covered', capability: 'configure' },
  'callback-requests': {
    kind: 'excluded',
    reason:
      'Callback queue is driven by the AMI scanner and call-center UI; live queue mutation has no confirmable agent diff this phase.',
  },
  callcenter: { kind: 'covered', capability: 'operation' },
  'cloud-admin': {
    kind: 'excluded',
    reason:
      'Platform SuperAdmin hub, marketplace and tenant provisioning — not a tenant PBX domain the agent serves (immutable).',
  },
  config: {
    kind: 'infrastructure',
    reason: 'Nest ConfigModule wrapper, not a PBX product surface.',
  },
  contexts: { kind: 'covered', capability: 'configure' },
  diagnostics: { kind: 'covered', capability: 'read' },
  'dialplan-bridge': {
    kind: 'infrastructure',
    reason: 'Internal Asterisk/API bridge, not a tenant-facing catalog.',
  },
  'dialplan-dry-run': { kind: 'covered', domain: 'dialplan_dry_run', sharedSkill: 'routes', capability: 'operation' },
  directories: { kind: 'covered', capability: 'configure' },
  endpoints: { kind: 'covered', capability: 'configure' },
  health: {
    kind: 'infrastructure',
    reason: 'Process health probes with no tenant data.',
  },
  ivrs: { kind: 'covered', capability: 'configure' },
  'komandor-claims': { kind: 'covered', sharedSkill: 'operations', capability: 'operation' },
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
  moh: { kind: 'covered', capability: 'configure' },
  notifications: { kind: 'covered', sharedSkill: 'operations', capability: 'configure' },
  numbers: { kind: 'covered', capability: 'read' },
  plan: { kind: 'covered', domain: 'plan', sharedSkill: 'pbx-setup', capability: 'configure' },
  prompts: { kind: 'covered', sharedSkill: 'operations', capability: 'configure' },
  queues: { kind: 'covered', capability: 'configure' },
  redis: {
    kind: 'infrastructure',
    reason: 'Cache and pub/sub infrastructure, not a tenant entity.',
  },
  reports: { kind: 'covered', capability: 'read' },
  roles: {
    kind: 'infrastructure',
    reason: 'RBAC guard plumbing; tenant people are the users domain.',
  },
  'route-references': {
    kind: 'excluded',
    reason:
      'Read model for the route-builder picker; routes, IVRs and directories already have adapters.',
  },
  'route-templates': { kind: 'covered', domain: 'route_templates', sharedSkill: 'routes', capability: 'read' },
  routes: { kind: 'covered', capability: 'configure' },
  'service-requests': { kind: 'covered', sharedSkill: 'operations', capability: 'operation' },
  sms: { kind: 'covered', sharedSkill: 'messaging', capability: 'configure' },
  'stt-engines': { kind: 'covered', sharedSkill: 'speech-engines', capability: 'configure' },
  'system-settings': { kind: 'covered', sharedSkill: 'settings', capability: 'immutable' },
  telegram: { kind: 'covered', sharedSkill: 'messaging', capability: 'configure' },
  'tenant-settings': { kind: 'covered', sharedSkill: 'settings', capability: 'configure' },
  'time-groups': { kind: 'covered', capability: 'read' },
  trunks: { kind: 'covered', capability: 'configure' },
  'tts-engines': { kind: 'covered', sharedSkill: 'speech-engines', capability: 'configure' },
  users: { kind: 'covered', capability: 'immutable' },
  'voice-robots': { kind: 'covered', capability: 'configure' },
  voicemail: { kind: 'covered', capability: 'configure' },
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

export const BACKEND_SKILLS_DIR = path.resolve(__dirname, '../../skills');

const SKILL_FRONTMATTER = /^---\r?\n([\s\S]*?)\r?\n---\r?\n([\s\S]*)$/;

export function parseSkillFrontmatterStrict(
  raw: string,
): { name: string; description: string } | null {
  const match = SKILL_FRONTMATTER.exec(raw);
  if (!match) {
    return null;
  }
  const name = (new RegExp(`^name:\\s*(.+)$`, 'm').exec(match[1])?.[1] ?? '')
    .trim()
    .replace(/^["']|["']$/g, '');
  const description = (new RegExp(`^description:\\s*(.+)$`, 'm').exec(match[1])?.[1] ?? '')
    .trim()
    .replace(/^["']|["']$/g, '');
  if (!name || !description) {
    return null;
  }
  return { name, description };
}

export function resolveSkillTarget(
  dir: string,
  entry: ModuleCoverageEntry,
  skillsRoot: string,
): { domain: string; skillName: string; filePath: string } | null {
  if (entry.kind !== 'covered') {
    return null;
  }
  const domain = adapterDomainOf(dir, entry);
  if (entry.sharedSkill) {
    return {
      domain,
      skillName: entry.sharedSkill,
      filePath: path.join(skillsRoot, entry.sharedSkill, 'SKILL.md'),
    };
  }
  const ownNames = [domain, dir].filter((name, index, all) => all.indexOf(name) === index);
  for (const skillName of ownNames) {
    const filePath = path.join(skillsRoot, skillName, 'SKILL.md');
    if (fs.existsSync(filePath)) {
      return { domain, skillName, filePath };
    }
  }
  return {
    domain,
    skillName: domain,
    filePath: path.join(skillsRoot, domain, 'SKILL.md'),
  };
}

export function collectSkillFailures(input: {
  coverage: Record<string, ModuleCoverageEntry>;
  skillsRoot: string;
  tools: Array<{ name: string; domain: string }>;
}): string[] {
  const { coverage, skillsRoot, tools } = input;
  const failures: string[] = [];
  const resolvedOk = new Set<string>();

  for (const [dir, entry] of Object.entries(coverage)) {
    const target = resolveSkillTarget(dir, entry, skillsRoot);
    if (!target) {
      continue;
    }
    if (!fs.existsSync(target.filePath)) {
      failures.push(`covered domain missing skill: ${target.domain}`);
      continue;
    }
    const parsed = parseSkillFrontmatterStrict(fs.readFileSync(target.filePath, 'utf8'));
    if (!parsed) {
      failures.push(`skill frontmatter does not parse: ${target.filePath}`);
      continue;
    }
    resolvedOk.add(target.domain);
  }

  for (const tool of tools) {
    if (!resolvedOk.has(tool.domain)) {
      failures.push(`tool ${tool.name} domain ${tool.domain} has no skill`);
    }
  }

  return failures;
}
