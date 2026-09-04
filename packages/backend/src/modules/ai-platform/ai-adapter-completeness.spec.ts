import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { AiAdapterRegistryService } from './ai-adapter-registry.service';
import { AiToolDefinition } from './ai-adapter.types';
import {
  BACKEND_MODULES_DIR,
  BACKEND_SKILLS_DIR,
  MODULE_COVERAGE,
  ModuleCoverageEntry,
  adapterDomainOf,
  collectCoverageFailures,
  collectSkillFailures,
  listModuleDirectories,
} from './module-coverage.registry';

const stubTool = (name: string): AiToolDefinition => ({
  name,
  description: name,
  inputSchema: {},
  entityType: 'test',
  handler: async () => 'ok',
});

function registerDomains(domains: string[]): AiAdapterRegistryService {
  const registry = new AiAdapterRegistryService();
  for (const domain of domains) {
    registry.register({ domain, getTools: () => [stubTool(`tool_${domain}`)] });
  }
  return registry;
}

/** Adapter files plus the skill registry — the live getDomains() population. */
function discoverAdapterDomains(modulesDir: string): string[] {
  const domains: string[] = [];
  const visit = (dir: string) => {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        visit(full);
        continue;
      }
      const isAdapter = entry.name.endsWith('-ai.adapter.ts');
      const isSkillRegistry = entry.name === 'agent-skill-registry.service.ts';
      if (!isAdapter && !isSkillRegistry) {
        continue;
      }
      const src = fs.readFileSync(full, 'utf8');
      const match = /readonly domain = '([^']+)'/.exec(src);
      if (match) {
        domains.push(match[1]);
      }
    }
  };
  visit(modulesDir);
  return domains.sort();
}

describe('D-17 AI adapter completeness', () => {
  it('names an unclassified module directory from the filesystem listing', () => {
    const coverage: Record<string, ModuleCoverageEntry> = {
      endpoints: { kind: 'covered' },
    };
    const registry = registerDomains(['endpoints']);
    const failures = collectCoverageFailures({
      coverage,
      directories: ['endpoints', 'brand-new-module'],
      registeredDomains: registry.getDomains(),
    });
    expect(failures.some((line) => line.includes('brand-new-module'))).toBe(true);
  });

  it('names a covered domain that has no registered adapter', () => {
    const coverage: Record<string, ModuleCoverageEntry> = {
      endpoints: { kind: 'covered' },
      trunks: { kind: 'covered' },
    };
    const registry = registerDomains(['endpoints']);
    const failures = collectCoverageFailures({
      coverage,
      directories: ['endpoints', 'trunks'],
      registeredDomains: registry.getDomains(),
    });
    expect(failures.some((line) => /trunks/.test(line) && /missing adapter/.test(line))).toBe(true);
  });

  it('names a non-covered classification that has an empty reason', () => {
    const coverage: Record<string, ModuleCoverageEntry> = {
      endpoints: { kind: 'covered' },
      ami: { kind: 'infrastructure', reason: '' },
      'cloud-admin': { kind: 'excluded', reason: '   ' },
    };
    const registry = registerDomains(['endpoints']);
    const failures = collectCoverageFailures({
      coverage,
      directories: ['endpoints', 'ami', 'cloud-admin'],
      registeredDomains: registry.getDomains(),
    });
    expect(failures.some((line) => line.includes('ami') && /no reason/.test(line))).toBe(true);
    expect(failures.some((line) => line.includes('cloud-admin') && /no reason/.test(line))).toBe(true);
  });

  it('names a registered adapter domain that is absent from the classification', () => {
    const coverage: Record<string, ModuleCoverageEntry> = {
      endpoints: { kind: 'covered' },
    };
    const registry = registerDomains(['endpoints', 'orphan-domain']);
    const failures = collectCoverageFailures({
      coverage,
      directories: ['endpoints'],
      registeredDomains: registry.getDomains(),
    });
    expect(failures.some((line) => line.includes('orphan-domain'))).toBe(true);
  });

  it('reports every failure in one run rather than stopping at the first', () => {
    const coverage: Record<string, ModuleCoverageEntry> = {
      endpoints: { kind: 'covered' },
      trunks: { kind: 'covered' },
      ami: { kind: 'infrastructure', reason: '' },
      ghost: { kind: 'excluded', reason: 'not a real directory' },
    };
    const registry = registerDomains(['endpoints', 'orphan-domain']);
    const failures = collectCoverageFailures({
      coverage,
      directories: ['endpoints', 'trunks', 'ami', 'brand-new-module'],
      registeredDomains: registry.getDomains(),
    });
    const blob = failures.join('\n');
    expect(blob).toContain('brand-new-module');
    expect(blob).toContain('trunks');
    expect(blob).toContain('ami');
    expect(blob).toContain('orphan-domain');
    expect(blob).toContain('ghost');
    expect(failures.length).toBeGreaterThanOrEqual(5);
  });

  it('live classification matches on-disk modules and getDomains() with no leftovers', () => {
    const directories = listModuleDirectories(BACKEND_MODULES_DIR);
    const registry = registerDomains(discoverAdapterDomains(BACKEND_MODULES_DIR));
    const failures = collectCoverageFailures({
      coverage: MODULE_COVERAGE,
      directories,
      registeredDomains: registry.getDomains(),
    });
    expect(failures).toEqual([]);
  });

  it('adapterDomainOf uses the explicit domain override when present', () => {
    expect(adapterDomainOf('route-templates', { kind: 'covered', domain: 'route_templates' })).toBe(
      'route_templates',
    );
    expect(adapterDomainOf('endpoints', { kind: 'covered' })).toBe('endpoints');
  });
});

function writeSkill(root: string, name: string, raw: string): string {
  const dir = path.join(root, name);
  fs.mkdirSync(dir, { recursive: true });
  const filePath = path.join(dir, 'SKILL.md');
  fs.writeFileSync(filePath, raw, 'utf8');
  return filePath;
}

function discoverToolsFromAdapterSources(modulesDir: string): Array<{ name: string; domain: string }> {
  const tools: Array<{ name: string; domain: string }> = [];
  const visit = (dir: string) => {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        visit(full);
        continue;
      }
      const isAdapter = entry.name.endsWith('-ai.adapter.ts');
      const isSkillRegistry = entry.name === 'agent-skill-registry.service.ts';
      if (!isAdapter && !isSkillRegistry) {
        continue;
      }
      const src = fs.readFileSync(full, 'utf8');
      const domainMatch = /readonly domain = '([^']+)'/.exec(src);
      if (!domainMatch) {
        continue;
      }
      const domain = domainMatch[1];
      const nameRe = /name:\s*'([a-z][a-z0-9_]*)'/g;
      let match: RegExpExecArray | null;
      while ((match = nameRe.exec(src))) {
        tools.push({ name: match[1], domain });
      }
    }
  };
  visit(modulesDir);
  return tools;
}

describe('D-16/D-17 skill currency', () => {
  let skillsRoot: string;

  beforeEach(() => {
    skillsRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'krasterisk-coverage-skills-'));
  });

  afterEach(() => {
    fs.rmSync(skillsRoot, { recursive: true, force: true });
  });

  it('names a covered domain that has neither its own nor a shared skill', () => {
    const coverage: Record<string, ModuleCoverageEntry> = {
      endpoints: { kind: 'covered' },
    };
    const failures = collectSkillFailures({
      coverage,
      skillsRoot,
      tools: [{ name: 'list_endpoints', domain: 'endpoints' }],
    });
    expect(failures.some((line) => line.includes('endpoints'))).toBe(true);
  });

  it('names the skill file when frontmatter does not parse', () => {
    const broken = writeSkill(skillsRoot, 'endpoints', 'this is not frontmatter\n');
    const coverage: Record<string, ModuleCoverageEntry> = {
      endpoints: { kind: 'covered' },
    };
    const failures = collectSkillFailures({
      coverage,
      skillsRoot,
      tools: [{ name: 'list_endpoints', domain: 'endpoints' }],
    });
    expect(failures.some((line) => line.includes(broken) || line.includes('endpoints'))).toBe(true);
    expect(failures.some((line) => /frontmatter|parse/i.test(line) && line.includes('SKILL.md'))).toBe(
      true,
    );
  });

  it('accepts one declared shared skill for several covered domains', () => {
    writeSkill(
      skillsRoot,
      'speech-engines',
      '---\nname: speech-engines\ndescription: Shared TTS and STT conventions.\n---\n\nbody\n',
    );
    const coverage: Record<string, ModuleCoverageEntry> = {
      'tts-engines': { kind: 'covered', sharedSkill: 'speech-engines' },
      'stt-engines': { kind: 'covered', sharedSkill: 'speech-engines' },
    };
    const failures = collectSkillFailures({
      coverage,
      skillsRoot,
      tools: [
        { name: 'list_tts_engines', domain: 'tts-engines' },
        { name: 'list_stt_engines', domain: 'stt-engines' },
      ],
    });
    expect(failures).toEqual([]);
  });

  it('names a tool whose domain does not resolve to a skill', () => {
    writeSkill(
      skillsRoot,
      'endpoints',
      '---\nname: endpoints\ndescription: Extensions.\n---\n\nbody\n',
    );
    const coverage: Record<string, ModuleCoverageEntry> = {
      endpoints: { kind: 'covered' },
      undocumented: { kind: 'covered' },
    };
    const failures = collectSkillFailures({
      coverage,
      skillsRoot,
      tools: [
        { name: 'list_endpoints', domain: 'endpoints' },
        { name: 'invent_convention', domain: 'undocumented' },
      ],
    });
    expect(failures.some((line) => line.includes('invent_convention'))).toBe(true);
  });

  it('live covered domains and registered tools resolve to a parseable skill', () => {
    const tools = discoverToolsFromAdapterSources(BACKEND_MODULES_DIR);
    const failures = collectSkillFailures({
      coverage: MODULE_COVERAGE,
      skillsRoot: BACKEND_SKILLS_DIR,
      tools,
    });
    expect(failures).toEqual([]);
  });
});
