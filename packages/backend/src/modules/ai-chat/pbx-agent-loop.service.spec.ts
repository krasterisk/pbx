import { PbxAgentLoopService } from './pbx-agent-loop.service';
import type { AgentStreamEvent, AgentTurnContext } from './pbx-agent-loop.service';
import type { AgentCompletion } from './pbx-agent.types';

const TENANT = 42;
const AUTHOR = 7;
const ROLE = 3;
const THREAD = 11;

function providerRow() {
  return {
    uid: 1,
    name: 'Cascade',
    endpoint: 'https://api.openai.com',
    auth_type: 'bearer' as const,
    encrypted_api_key: 'enc',
    capabilities: ['llm', 'tools'],
    defaults: { model: 'gpt-4o-mini' },
    vendor: 'openai',
  };
}

function turnContext(overrides: Partial<AgentTurnContext> = {}): AgentTurnContext {
  return {
    tenantUid: TENANT,
    authorUid: AUTHOR,
    role: ROLE,
    locale: 'ru',
    ...overrides,
  };
}

async function collect(iter: AsyncIterable<AgentStreamEvent>): Promise<AgentStreamEvent[]> {
  const events: AgentStreamEvent[] = [];
  for await (const event of iter) events.push(event);
  return events;
}

function createHarness(
  completions: AgentCompletion[],
  options: {
    maxSteps?: number;
    tools?: Array<{ name: string; description: string; inputSchema: Record<string, unknown> }>;
  } = {},
) {
  const stored: Array<{ role: string; content?: string | null; tool_name?: string | null; tool_calls?: unknown }> = [];
  let chatCalls = 0;

  const llm = {
    chat: jest.fn(async () => {
      const next = completions[chatCalls] ?? completions[completions.length - 1];
      chatCalls += 1;
      return next;
    }),
  };

  const providers = {
    findDefaultLlm: jest.fn(async () => providerRow()),
  };

  const contextBuilder = {
    buildState: jest.fn(async () => ({ endpointsCount: 0 })),
    buildSystemPrompt: jest.fn(() => 'You are the KrAsterisk PBX assistant.'),
  };

  const threads = {
    listMessages: jest.fn(async () => stored.map((row, index) => ({ uid: index + 1, ...row }))),
    appendMessage: jest.fn(async (_threadUid: number, _tenant: number, _author: number, input: typeof stored[number]) => {
      stored.push(input);
      return { uid: stored.length, ...input };
    }),
    addUsage: jest.fn(async () => undefined),
  };

  const mcpTools = {
    getToolsList: jest.fn(() => options.tools ?? [
      {
        name: 'get_pbx_state',
        description: 'Compact PBX snapshot',
        inputSchema: { type: 'object', properties: { domain: { type: 'string' } } },
      },
    ]),
    callTool: jest.fn(async () => [{ type: 'text', text: '{"queues":3}' }]),
  };

  const config = {
    get: jest.fn((key: string, fallback?: unknown) => {
      if (key === 'CC_AI_MAX_AGENT_STEPS') return options.maxSteps ?? fallback ?? 12;
      if (key === 'CC_AI_TOOL_ARG_RETRIES') return fallback ?? 1;
      return fallback;
    }),
  };

  const service = new PbxAgentLoopService(
    llm as any,
    providers as any,
    contextBuilder as any,
    threads as any,
    mcpTools as any,
    config as any,
  );

  return { service, llm, providers, contextBuilder, threads, mcpTools, config, stored };
}

describe('PbxAgentLoopService', () => {
  it('runs one read tool then an answer and yields progress, tool call, tool result, text, done', async () => {
    const { service, llm, mcpTools } = createHarness([
      {
        text: '',
        toolCalls: [{ id: 'call_1', name: 'get_pbx_state', arguments: { domain: 'queues', vpbxUserUid: 999 } }],
        usage: { promptTokens: 10, completionTokens: 4 },
      },
      {
        text: 'У вас три очереди.',
        toolCalls: [],
        usage: { promptTokens: 20, completionTokens: 8 },
      },
    ]);

    const events = await collect(service.runTurn('Сколько очередей?', { uid: THREAD }, turnContext()));
    const names = events.map((event) => event.name);

    expect(names).toEqual(['progress', 'tool_call', 'tool_result', 'text', 'done']);
    expect(events[0].data).toEqual(expect.objectContaining({ tool: 'get_pbx_state' }));
    expect(String((events[0].data as { label?: string }).label ?? '')).toMatch(/get_pbx_state/);
    expect(events[1].data).toEqual(expect.objectContaining({ name: 'get_pbx_state' }));
    expect(events[2].data).toEqual(expect.objectContaining({ name: 'get_pbx_state' }));
    expect(events[3].data).toBe('У вас три очереди.');
    expect(llm.chat).toHaveBeenCalledTimes(2);
    expect(mcpTools.callTool).toHaveBeenCalledTimes(1);
    expect(mcpTools.callTool).toHaveBeenCalledWith(
      'get_pbx_state',
      expect.objectContaining({ domain: 'queues' }),
      TENANT,
      expect.objectContaining({ userUid: AUTHOR, role: ROLE, threadUid: THREAD }),
    );
    expect(mcpTools.callTool.mock.calls[0][2]).toBe(TENANT);
    expect(mcpTools.callTool.mock.calls[0][2]).not.toBe(999);
  });

  it('appends the user message, tool exchange and final answer in order and accumulates tokens', async () => {
    const { service, threads } = createHarness([
      {
        text: '',
        toolCalls: [{ id: 'call_1', name: 'get_pbx_state', arguments: { domain: 'queues' } }],
        usage: { promptTokens: 10, completionTokens: 4 },
      },
      {
        text: 'У вас три очереди.',
        toolCalls: [],
        usage: { promptTokens: 20, completionTokens: 8 },
      },
    ]);

    await collect(service.runTurn('Сколько очередей?', { uid: THREAD }, turnContext()));

    const roles = threads.appendMessage.mock.calls.map((call) => call[3].role);
    expect(roles).toEqual(['user', 'assistant', 'tool', 'assistant']);
    expect(threads.appendMessage.mock.calls[0][3].content).toBe('Сколько очередей?');
    expect(threads.appendMessage.mock.calls[2][3].tool_name).toBe('get_pbx_state');
    expect(threads.appendMessage.mock.calls[3][3].content).toBe('У вас три очереди.');
    expect(threads.addUsage).toHaveBeenCalledWith(THREAD, TENANT, AUTHOR, { in: 10, out: 4 });
    expect(threads.addUsage).toHaveBeenCalledWith(THREAD, TENANT, AUTHOR, { in: 20, out: 8 });
  });

  it('stops at the configured step ceiling and makes no further model call', async () => {
    const endless: AgentCompletion = {
      text: '',
      toolCalls: [{ id: 'loop', name: 'get_pbx_state', arguments: { domain: 'queues' } }],
      usage: { promptTokens: 1, completionTokens: 1 },
    };
    const { service, llm } = createHarness(
      [endless, endless, endless, { text: 'should not reach', toolCalls: [] }],
      { maxSteps: 2 },
    );

    const events = await collect(service.runTurn('крутись', { uid: THREAD }, turnContext()));
    const terminal = events[events.length - 1];

    expect(llm.chat).toHaveBeenCalledTimes(2);
    expect(terminal.name).toBe('error');
    expect(terminal.data).toEqual(expect.objectContaining({ code: 'max_steps_exceeded' }));
  });

  it('aborts the in-flight model request and emits cancelled without further tools', async () => {
    const abort = new AbortController();
    const { service, llm, mcpTools } = createHarness([]);
    let releaseStarted!: () => void;
    const chatStarted = new Promise<void>((resolve) => {
      releaseStarted = resolve;
    });
    llm.chat.mockImplementation(async (params: { signal?: AbortSignal }) => {
      releaseStarted();
      const signal = params.signal;
      if (!signal?.aborted) {
        await new Promise<void>((resolve) => {
          const timer = setTimeout(resolve, 50);
          signal?.addEventListener('abort', () => {
            clearTimeout(timer);
            resolve();
          }, { once: true });
        });
      }
      return { text: '', toolCalls: [], error: { code: 'aborted', message: 'Request aborted' } };
    });

    const pending = collect(service.runTurn('stop', { uid: THREAD }, turnContext({ signal: abort.signal })));
    await chatStarted;
    abort.abort();
    const events = await pending;
    const terminal = events[events.length - 1];

    expect(llm.chat.mock.calls[0][0].signal).toBe(abort.signal);
    expect(mcpTools.callTool).not.toHaveBeenCalled();
    expect(terminal.name).toBe('error');
    expect(terminal.data).toEqual(expect.objectContaining({ code: 'cancelled' }));
  });

  it('skips remaining tool calls of a batch when aborted between them', async () => {
    const abort = new AbortController();
    const { service, mcpTools } = createHarness([
      {
        text: '',
        toolCalls: [
          { id: 'c1', name: 'get_pbx_state', arguments: { domain: 'queues' } },
          { id: 'c2', name: 'list_queues', arguments: {} },
        ],
      },
      { text: 'should not reach if cancelled', toolCalls: [] },
    ]);
    mcpTools.getToolsList.mockReturnValue([
      { name: 'get_pbx_state', description: 'state', inputSchema: { type: 'object', properties: {} } },
      { name: 'list_queues', description: 'queues', inputSchema: { type: 'object', properties: {} } },
    ]);
    mcpTools.callTool.mockImplementation(async (name: string) => {
      if (name === 'get_pbx_state') abort.abort();
      return [{ type: 'text', text: '{}' }];
    });

    const events = await collect(service.runTurn('два тула', { uid: THREAD }, turnContext({ signal: abort.signal })));
    const names = mcpTools.callTool.mock.calls.map((call) => call[0]);

    expect(names).toEqual(['get_pbx_state']);
    expect(events[events.length - 1]).toEqual(
      expect.objectContaining({ name: 'error', data: expect.objectContaining({ code: 'cancelled' }) }),
    );
  });

  it('emits a pending proposal event and continues the turn without a write', async () => {
    const view = {
      proposalId: '11111111-1111-1111-1111-111111111111',
      entityType: 'directory',
      entityLabel: 'Customers',
      summary: ['create directory'],
      before: null,
      after: { name: 'Customers' },
      includesDialplanReload: false,
      status: 'pending',
      expiresAt: new Date().toISOString(),
    };
    const { service, mcpTools, llm } = createHarness([
      {
        text: '',
        toolCalls: [{ id: 'c1', name: 'create_directory', arguments: { name: 'Customers' } }],
      },
      { text: 'Предложил создать справочник.', toolCalls: [] },
    ]);
    mcpTools.getToolsList.mockReturnValue([
      { name: 'create_directory', description: 'Create', inputSchema: { type: 'object', properties: { name: { type: 'string' } } } },
    ]);
    mcpTools.callTool.mockResolvedValue([{ type: 'text', text: JSON.stringify(view) }]);

    const events = await collect(service.runTurn('создай справочник', { uid: THREAD }, turnContext()));
    const names = events.map((event) => event.name);

    expect(names).toContain('proposal');
    expect(events.find((event) => event.name === 'proposal')?.data).toEqual(expect.objectContaining({
      proposalId: view.proposalId,
      status: 'pending',
    }));
    expect(events.find((event) => event.name === 'proposal')?.data).not.toEqual(
      expect.objectContaining({ applyPayload: expect.anything() }),
    );
    expect(names[names.length - 1]).toBe('done');
    expect(llm.chat).toHaveBeenCalledTimes(2);
    expect(mcpTools.callTool).toHaveBeenCalledTimes(1);
  });

  it('returns a structured tool error for invalid args and ends after a second failure on the same tool', async () => {
    const invalid: AgentCompletion = {
      text: '',
      toolCalls: [{ id: 'bad', name: 'get_pbx_state', arguments: {} }],
    };
    const { service, llm, mcpTools } = createHarness([
      invalid,
      invalid,
      { text: 'should not run', toolCalls: [] },
    ], {
      tools: [{
        name: 'get_pbx_state',
        description: 'state',
        inputSchema: {
          type: 'object',
          properties: { domain: { type: 'string' } },
          required: ['domain'],
        },
      }],
    });

    const events = await collect(service.runTurn('состояние', { uid: THREAD }, turnContext()));
    const toolResults = events.filter((event) => event.name === 'tool_result');

    expect(llm.chat).toHaveBeenCalledTimes(2);
    expect(mcpTools.callTool).not.toHaveBeenCalled();
    expect(toolResults).toHaveLength(1);
    expect(JSON.stringify(toolResults[0].data)).toMatch(/domain/);
    expect(events[events.length - 1]).toEqual(
      expect.objectContaining({ name: 'error', data: expect.objectContaining({ code: 'tool_arg_retries_exceeded' }) }),
    );
  });
});
