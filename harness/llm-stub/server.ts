import { createServer, type IncomingMessage, type Server, type ServerResponse } from 'node:http';
import { STUB_SCENARIOS, type StubScenario, type StubTurn } from './scenarios.js';

export interface LlmStubHandle {
  url: string;
  /** Выбрать сценарий для следующих ходов и обнулить курсор. */
  useScenario(id: string): void;
  /** Что модель «увидела» — для проверки, что в промпт не попало лишнее. */
  requests(): Array<{ messages: Array<{ role: string; content: string }>; tools: string[]; toolChoice?: string }>;
  close(): Promise<void>;
}

type RecordedRequest = {
  messages: Array<{ role: string; content: string }>;
  tools: string[];
  toolChoice?: string;
};

export async function startLlmStub(options?: { port?: number }): Promise<LlmStubHandle> {
  const state = {
    scenario: requireScenario(STUB_SCENARIOS[0]?.id ?? ''),
    cursor: 0,
    recorded: [] as RecordedRequest[],
  };

  const applyScenario = (id: string): void => {
    state.scenario = requireScenario(id);
    state.cursor = 0;
  };

  const server = createServer((req, res) => {
    void handleRequest(req, res, state, applyScenario);
  });

  await listen(server, options?.port ?? 0);
  const address = server.address();
  const port = typeof address === 'object' && address ? address.port : 0;

  return {
    url: `http://127.0.0.1:${port}`,
    useScenario: applyScenario,
    requests: () => state.recorded.map((item) => ({
      messages: item.messages.map((message) => ({ ...message })),
      tools: [...item.tools],
      ...(item.toolChoice !== undefined ? { toolChoice: item.toolChoice } : {}),
    })),
    close: () => closeServer(server),
  };
}

function requireScenario(id: string): StubScenario {
  const found = STUB_SCENARIOS.find((scenario) => scenario.id === id);
  if (!found) {
    throw new Error(`Unknown stub scenario: ${id}`);
  }
  return found;
}

async function handleRequest(
  req: IncomingMessage,
  res: ServerResponse,
  state: { scenario: StubScenario; cursor: number; recorded: RecordedRequest[] },
  applyScenario: (id: string) => void,
): Promise<void> {
  const url = new URL(req.url ?? '/', 'http://127.0.0.1');

  try {
    if (req.method === 'GET' && url.pathname === '/__stub/health') {
      writeJson(res, 200, { ok: true });
      return;
    }

    if (req.method === 'POST' && url.pathname === '/__stub/scenario') {
      const body = await readJson(req);
      const id = typeof body.id === 'string' ? body.id : '';
      applyScenario(id);
      writeJson(res, 200, { ok: true });
      return;
    }

    if (req.method === 'POST' && url.pathname === '/v1/chat/completions') {
      const body = await readJson(req);
      state.recorded.push(recordRequest(body));
      const turn = nextTurn(state);
      writeSse(res, turn);
      return;
    }

    writeJson(res, 404, { error: 'not found' });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'bad request';
    const status = message.startsWith('Unknown stub scenario') ? 404 : 400;
    if (!res.headersSent) {
      writeJson(res, status, { error: message });
    } else {
      res.end();
    }
  }
}

function nextTurn(state: { scenario: StubScenario; cursor: number }): StubTurn {
  const turns = state.scenario.turns;
  const turn = turns[state.cursor] ?? turns[turns.length - 1] ?? { text: '' };
  state.cursor += 1;
  return turn;
}

function writeSse(res: ServerResponse, turn: StubTurn): void {
  res.writeHead(200, {
    'content-type': 'text/event-stream',
    'cache-control': 'no-cache',
    connection: 'keep-alive',
  });

  if (turn.reasoning) {
    writeSseEvent(res, { choices: [{ delta: { reasoning_content: turn.reasoning } }] });
  }
  if (turn.text) {
    writeSseEvent(res, { choices: [{ delta: { content: turn.text } }] });
  }
  if (turn.toolCalls?.length) {
    writeSseEvent(res, {
      choices: [{
        index: 0,
        delta: {
          tool_calls: turn.toolCalls.map((call, index) => ({
            index,
            id: call.id ?? `call_${index + 1}`,
            function: {
              name: call.name,
              arguments: JSON.stringify(call.arguments),
            },
          })),
        },
      }],
    });
  }

  writeSseEvent(res, {
    choices: [{ finish_reason: turn.toolCalls?.length ? 'tool_calls' : 'stop' }],
    usage: { prompt_tokens: 10, completion_tokens: 5 },
  });
  res.write('data: [DONE]\n\n');
  res.end();
}

function writeSseEvent(res: ServerResponse, payload: unknown): void {
  res.write(`data: ${JSON.stringify(payload)}\n\n`);
}

function recordRequest(body: Record<string, unknown>): RecordedRequest {
  const messages = Array.isArray(body.messages)
    ? body.messages.map((message) => {
        const row = message as { role?: unknown; content?: unknown };
        return {
          role: typeof row.role === 'string' ? row.role : '',
          content: typeof row.content === 'string' ? row.content : '',
        };
      })
    : [];

  const tools = Array.isArray(body.tools)
    ? body.tools.flatMap((tool) => {
        if (typeof tool === 'string') return [tool];
        const name = (tool as { function?: { name?: unknown }; name?: unknown })?.function?.name
          ?? (tool as { name?: unknown })?.name;
        return typeof name === 'string' ? [name] : [];
      })
    : [];

  const toolChoice = typeof body.tool_choice === 'string' ? body.tool_choice : undefined;
  return { messages, tools, ...(toolChoice !== undefined ? { toolChoice } : {}) };
}

function writeJson(res: ServerResponse, status: number, body: unknown): void {
  res.writeHead(status, { 'content-type': 'application/json' });
  res.end(JSON.stringify(body));
}

function readJson(req: IncomingMessage): Promise<Record<string, unknown>> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    req.on('data', (chunk: Buffer) => {
      chunks.push(chunk);
    });
    req.on('error', reject);
    req.on('end', () => {
      const raw = Buffer.concat(chunks).toString('utf8').trim();
      if (!raw) {
        resolve({});
        return;
      }
      try {
        const parsed = JSON.parse(raw) as unknown;
        resolve(parsed && typeof parsed === 'object' && !Array.isArray(parsed)
          ? parsed as Record<string, unknown>
          : {});
      } catch (error) {
        reject(error);
      }
    });
  });
}

function listen(server: Server, port: number): Promise<void> {
  return new Promise((resolve, reject) => {
    server.once('error', reject);
    server.listen(port, '127.0.0.1', () => {
      server.off('error', reject);
      resolve();
    });
  });
}

function closeServer(server: Server): Promise<void> {
  return new Promise((resolve, reject) => {
    server.close((error) => {
      if (error) reject(error);
      else resolve();
    });
  });
}
