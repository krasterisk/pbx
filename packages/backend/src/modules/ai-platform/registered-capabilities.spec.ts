import * as fs from 'node:fs';
import * as path from 'node:path';
import { AiAdapterRegistryService } from './ai-adapter-registry.service';
import { AgentSkillRegistryService } from './agent-skill-registry.service';
import { jsonSchemaOf } from './ai-mutation.contract';
import { McpToolsService } from '../mcp/mcp-tools.service';
import { collectCoverageFailures, MODULE_COVERAGE, listModuleDirectories } from './module-coverage.registry';

function adapterFiles(dir: string): string[] {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const file = path.join(dir, entry.name);
    return entry.isDirectory() ? adapterFiles(file) : entry.name.endsWith('-ai.adapter.ts') ? [file] : [];
  });
}

/** Actual tool factories and MCP discovery, with service handlers left uncalled. */
describe('registered configuration capabilities', () => {
  it('discovers real adapter schemas, confirms MCP parity and connects their skills', () => {
    const registry = new AiAdapterRegistryService();
    const skills = new AgentSkillRegistryService(registry);
    skills.onModuleInit();
    for (const file of adapterFiles(path.resolve(__dirname, '..'))) {
      const domain = /readonly domain = ['"]([^'"]+)['"]/.exec(fs.readFileSync(file, 'utf8'))?.[1];
      if (!domain) continue;
      // Import the real factory, rather than stubbing one tool per domain.
      const exports = require(file) as Record<string, { prototype?: { getTools?: unknown } }>;
      const factory = Object.values(exports).find((candidate) => typeof candidate?.prototype?.getTools === 'function');
      expect(factory).toBeDefined();
      const adapter = Object.create(factory!.prototype);
      adapter.domain = domain;
      registry.register(adapter);
    }
    expect(collectCoverageFailures({ coverage: MODULE_COVERAGE, directories: listModuleDirectories(), registeredDomains: registry.getDomains() })).toEqual([]);
    for (const [module, entry] of Object.entries(MODULE_COVERAGE)) {
      if (entry.kind !== 'covered') continue;
      const adapter = registry.getAdapter(entry.domain ?? module)!;
      if (entry.capability === 'configure') {
        expect(adapter.getTools().some((tool) => !!tool.mutation || !!tool.proposes)).toBe(true);
      }
      expect(skills.findByDomain(entry.domain ?? module).length > 0 || !!(entry.sharedSkill && skills.getSkill(entry.sharedSkill))).toBe(true);
    }
    const mcp = new McpToolsService(registry, {} as never, {} as never);
    mcp.registerAll();
    const discovered = mcp.getToolsList(42);
    expect(discovered.length).toBeLessThanOrEqual(128);
    expect(discovered.map((tool) => tool.name).sort()).toEqual(registry.getAllTools().map((tool) => tool.name).sort());
    const modules = registry.getDomains().sort().map((domain) => ({
      domain,
      skills: skills.findByDomain(domain).map((skill) => skill.name),
      tools: registry.getAdapter(domain)!.getTools().map((tool) => ({
        name: tool.name, mutation: !!tool.mutation, proposes: !!tool.proposes,
        fields: Object.keys(tool.mutation ? jsonSchemaOf(tool.mutation.input).properties : tool.inputSchema.properties ?? tool.inputSchema),
      })),
    }));
    for (const name of ['get_configuration_capabilities', 'get_endpoint_configuration', 'update_endpoint', 'get_trunk_configuration', 'update_trunk', 'get_context_configuration', 'apply_context']) {
      expect(discovered.some((tool) => tool.name === name)).toBe(true);
    }
    if (process.env.AICHAT_CAPABILITY_REPORT) fs.writeFileSync(process.env.AICHAT_CAPABILITY_REPORT, JSON.stringify({ toolCount: discovered.length, modules }, null, 2));
  });
});
