import { AiAdapterRegistryService } from './ai-adapter-registry.service';
import { DomainAiAdapter, AiToolDefinition } from './ai-adapter.types';

/**
 * Unit tests for AiAdapterRegistryService (D-14).
 *
 * Verifies: registering two domains merges their tools into one flat list,
 * and getStateProviders/getKnowledgeBlocks filter out adapters that don't
 * implement the optional State/Knowledge components.
 */
describe('AiAdapterRegistryService', () => {
  let service: AiAdapterRegistryService;

  const makeTool = (name: string): AiToolDefinition => ({
    name,
    description: `desc ${name}`,
    inputSchema: {},
    entityType: 'test',
    handler: jest.fn().mockResolvedValue('ok'),
  });

  beforeEach(() => {
    service = new AiAdapterRegistryService();
  });

  it('getAllTools returns a merged list across multiple registered domains', () => {
    const adapterA: DomainAiAdapter = { domain: 'a', getTools: () => [makeTool('tool_a1'), makeTool('tool_a2')] };
    const adapterB: DomainAiAdapter = { domain: 'b', getTools: () => [makeTool('tool_b1')] };

    service.register(adapterA);
    service.register(adapterB);

    const tools = service.getAllTools();
    expect(tools.map((t) => t.name).sort()).toEqual(['tool_a1', 'tool_a2', 'tool_b1']);
  });

  it('getStateProviders filters out adapters without getStateProvider', () => {
    const withState: DomainAiAdapter = {
      domain: 'withState',
      getTools: () => [],
      getStateProvider: () => ({ domain: 'withState', buildSummary: async () => 'summary' }),
    };
    const withoutState: DomainAiAdapter = { domain: 'withoutState', getTools: () => [] };

    service.register(withState);
    service.register(withoutState);

    const providers = service.getStateProviders();
    expect(providers).toHaveLength(1);
    expect(providers[0].domain).toBe('withState');
  });

  it('getKnowledgeBlocks filters out adapters without getKnowledgeBlock', () => {
    const withKb: DomainAiAdapter = { domain: 'withKb', getTools: () => [], getKnowledgeBlock: () => 'KB block' };
    const withoutKb: DomainAiAdapter = { domain: 'withoutKb', getTools: () => [] };

    service.register(withKb);
    service.register(withoutKb);

    expect(service.getKnowledgeBlocks()).toEqual(['KB block']);
  });

  it('getToolByName finds a tool across all registered adapters', () => {
    const adapterA: DomainAiAdapter = { domain: 'a', getTools: () => [makeTool('unique_tool')] };
    service.register(adapterA);

    expect(service.getToolByName('unique_tool')).toBeDefined();
    expect(service.getToolByName('missing_tool')).toBeUndefined();
  });

  it('register overwrites a previous registration for the same domain', () => {
    const first: DomainAiAdapter = { domain: 'dup', getTools: () => [makeTool('first_tool')] };
    const second: DomainAiAdapter = { domain: 'dup', getTools: () => [makeTool('second_tool')] };

    service.register(first);
    service.register(second);

    expect(service.getAllTools().map((t) => t.name)).toEqual(['second_tool']);
  });
});
