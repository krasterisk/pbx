import { DiagnosticsAiAdapter } from './diagnostics-ai.adapter';

const TENANT_A = 12;
const TENANT_B = 34;

function getTool(adapter: DiagnosticsAiAdapter, name: string) {
  const tool = adapter.getTools().find((entry) => entry.name === name);
  if (!tool) throw new Error(`Missing tool ${name}`);
  return tool;
}

function isMutating(tool: { name: string; proposes?: boolean; destructive?: boolean }): boolean {
  return Boolean(tool.proposes || tool.destructive || /create|update|delete|apply|hangup|reload|originate|send/i.test(tool.name));
}

describe('DiagnosticsAiAdapter (D-12, D-13)', () => {
  let diagnostics: {
    readLiveChannels: jest.Mock;
    readRecentEvents: jest.Mock;
    readCompiledDialplan: jest.Mock;
  };
  let registry: { register: jest.Mock };
  let adapter: DiagnosticsAiAdapter;

  beforeEach(() => {
    diagnostics = {
      readLiveChannels: jest.fn().mockResolvedValue({ channels: [], truncated: false, cap: 25, matched: 0 }),
      readRecentEvents: jest.fn().mockResolvedValue({ events: [], truncated: false, cap: 20, matched: 0, windowMs: 900000 }),
      readCompiledDialplan: jest.fn().mockResolvedValue({
        context: 'ctx-12',
        rules: [],
        evaluationOrder: true,
        orderNote: 'Rules are listed in evaluation order',
      }),
    };
    registry = { register: jest.fn() };
    adapter = new DiagnosticsAiAdapter(diagnostics as any, registry as any);
  });

  it('declares exactly three read tools and no mutating tool', () => {
    const names = adapter.getTools().map((t) => t.name).sort();
    expect(names).toEqual(['get_compiled_dialplan', 'get_live_channels', 'get_recent_call_events']);
    expect(adapter.getTools().some(isMutating)).toBe(false);
    for (const tool of adapter.getTools()) {
      expect(tool.proposes).toBeFalsy();
      expect(tool.destructive).toBeFalsy();
    }
  });

  it('passes the call-time tenant to every handler and never closes over uid', async () => {
    await getTool(adapter, 'get_live_channels').handler({}, TENANT_A);
    await getTool(adapter, 'get_recent_call_events').handler({}, TENANT_B);
    await getTool(adapter, 'get_compiled_dialplan').handler({ context: 'ctx-12' }, TENANT_A);

    expect(diagnostics.readLiveChannels).toHaveBeenCalledWith(TENANT_A);
    expect(diagnostics.readRecentEvents).toHaveBeenCalledWith(TENANT_B);
    expect(diagnostics.readCompiledDialplan).toHaveBeenCalledWith(TENANT_A, 'ctx-12');
  });

  it('registers itself on module init', () => {
    adapter.onModuleInit();
    expect(registry.register).toHaveBeenCalledWith(adapter);
  });
});
