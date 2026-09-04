import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { AiAdapterRegistryService } from './ai-adapter-registry.service';
import {
  AgentSkillRegistryService,
  resolveSkillsRootCandidates,
  SKILL_BODY_MAX_CHARS,
} from './agent-skill-registry.service';

function writeSkill(root: string, dirName: string, name: string, description: string, body: string): void {
  const dir = path.join(root, dirName);
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(
    path.join(dir, 'SKILL.md'),
    `---\nname: ${name}\ndescription: ${description}\n---\n\n${body}`,
    'utf8',
  );
}

function createService(skillsRoot?: string): {
  service: AgentSkillRegistryService;
  registry: AiAdapterRegistryService;
} {
  const registry = new AiAdapterRegistryService();
  const service = new AgentSkillRegistryService(registry, skillsRoot);
  return { service, registry };
}

describe('AgentSkillRegistryService', () => {
  let tmpRoot: string;

  beforeEach(() => {
    tmpRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'krasterisk-skills-'));
  });

  afterEach(() => {
    fs.rmSync(tmpRoot, { recursive: true, force: true });
  });

  it('getCatalog returns name and description from frontmatter and never the body', () => {
    const body = 'UNIQUE_BODY_PHRASE_MUST_NOT_LEAK_INTO_CATALOG';
    writeSkill(tmpRoot, 'fixture-skill', 'fixture-skill', 'One-line fixture description', body);

    const { service } = createService(tmpRoot);
    const catalog = service.getCatalog();

    expect(catalog).toEqual([{ name: 'fixture-skill', description: 'One-line fixture description' }]);
    expect(JSON.stringify(catalog)).not.toContain(body);
  });

  it("readSkill('developer-convention') returns the markdown body", () => {
    const { service } = createService();
    const body = service.readSkill('developer-convention');

    expect(body).toMatch(/<module>-ai\.adapter\.ts/);
    expect(body).toMatch(/src\/skills\/<module>\/SKILL\.md/);
    expect(body).toMatch(/vpbxUserUid/);
    expect(body).not.toMatch(/^---/);
  });

  it('unknown skill name returns structured not-found text rather than throwing', () => {
    writeSkill(tmpRoot, 'fixture-skill', 'fixture-skill', 'Fixture', 'body');
    const { service } = createService(tmpRoot);

    expect(() => service.readSkill('no-such-skill')).not.toThrow();
    const result = service.readSkill('no-such-skill');
    expect(result).toMatch(/not found/i);
    expect(result).toContain('no-such-skill');
  });

  it('body longer than the cap is truncated with a trailing note', () => {
    const longBody = 'X'.repeat(SKILL_BODY_MAX_CHARS + 200);
    writeSkill(tmpRoot, 'oversized', 'oversized', 'Too large', longBody);

    const { service } = createService(tmpRoot);
    const result = service.readSkill('oversized');

    expect(result.length).toBeLessThan(longBody.length);
    expect(result.startsWith('X'.repeat(SKILL_BODY_MAX_CHARS))).toBe(true);
    expect(result.slice(SKILL_BODY_MAX_CHARS)).toMatch(/truncat/i);
  });

  it('list_skills and read_skill are non-destructive skill tools that accept vpbxUserUid', async () => {
    writeSkill(tmpRoot, 'fixture-skill', 'fixture-skill', 'Fixture description', 'fixture body text');
    const { service } = createService(tmpRoot);
    const tools = service.getTools();
    const list = tools.find((t) => t.name === 'list_skills');
    const read = tools.find((t) => t.name === 'read_skill');

    expect(list).toMatchObject({ entityType: 'skill', inputSchema: {} });
    expect(list?.destructive).toBeFalsy();
    expect(read).toMatchObject({
      entityType: 'skill',
      inputSchema: { name: { type: 'string' } },
    });
    expect(read?.destructive).toBeFalsy();

    const listed = await list!.handler({}, 42);
    expect(listed).toEqual([{ name: 'fixture-skill', description: 'Fixture description' }]);

    const body = await read!.handler({ name: 'fixture-skill' }, 99);
    expect(body).toContain('fixture body text');
  });

  it('onModuleInit registers the adapter as domain skills', () => {
    writeSkill(tmpRoot, 'fixture-skill', 'fixture-skill', 'Fixture', 'body');
    const { service, registry } = createService(tmpRoot);

    service.onModuleInit();

    expect(registry.getDomains()).toEqual(['skills']);
    expect(registry.getToolByName('read_skill')).toBeDefined();
    expect(registry.getToolByName('list_skills')).toBeDefined();
  });

  it('loads a non-empty catalog from the repository skills root', () => {
    const { service } = createService();
    const catalog = service.getCatalog();
    expect(catalog.length).toBeGreaterThan(0);

    const byName = Object.fromEntries(catalog.map((entry) => [entry.name, entry.description]));
    for (const name of ['developer-convention', 'directories', 'voicemail', 'callcenter']) {
      expect(byName[name]).toEqual(expect.any(String));
      expect(byName[name].length).toBeGreaterThan(0);
    }
  });
});

describe('resolveSkillsRootCandidates', () => {
  it('derives the primary candidate from the compiled module directory', () => {
    const moduleDir = path.join(path.sep, 'compiled', 'modules', 'ai-platform');
    const candidates = resolveSkillsRootCandidates(moduleDir);
    const cwdFallback = path.resolve(process.cwd(), 'src/skills');

    expect(candidates[0]).toBe(path.resolve(moduleDir, '../../skills'));
    expect(candidates).toContain(cwdFallback);
    expect(candidates[0]).not.toBe(cwdFallback);
  });
});
