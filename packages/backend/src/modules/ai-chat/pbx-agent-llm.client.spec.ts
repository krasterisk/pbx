import { encryptSecret } from '../ai-agents/util/secret-cipher.util';
import { PbxAgentLlmClient } from './pbx-agent-llm.client';
import type { AgentChatParams } from './pbx-agent.types';

const PLAIN_KEY = 'sk-agent-secret';

function provider(overrides: AgentChatParams['provider'] = {} as AgentChatParams['provider']): AgentChatParams['provider'] {
    return {
        uid: 1,
        name: 'Cascade',
        endpoint: 'https://api.openai.com',
        auth_type: 'bearer',
        encrypted_api_key: encryptSecret(PLAIN_KEY),
        capabilities: ['llm', 'tools'],
        defaults: { model: 'gpt-4o-mini', temperature: 0.2 },
        vendor: 'openai',
        ...overrides,
    };
}

function ssePayload(delta: Record<string, unknown>, extra: Record<string, unknown> = {}): string {
    return `data: ${JSON.stringify({ choices: [{ index: 0, delta }], ...extra })}\n\n`;
}

function streamResponse(chunks: string[], status = 200) {
    const encoded = chunks.map((chunk) => new TextEncoder().encode(chunk));
    let i = 0;
    return {
        ok: status >= 200 && status < 400,
        status,
        body: {
            getReader() {
                return {
                    async read() {
                        if (i >= encoded.length) return { done: true as const, value: undefined };
                        return { done: false as const, value: encoded[i++] };
                    },
                    async cancel() {
                        i = encoded.length;
                    },
                };
            },
        },
    };
}

describe('PbxAgentLlmClient', () => {
    let client: PbxAgentLlmClient;
    let fetchMock: jest.Mock;

    beforeEach(() => {
        client = new PbxAgentLlmClient();
        fetchMock = jest.fn();
        global.fetch = fetchMock as unknown as typeof fetch;
    });

    afterEach(() => {
        jest.restoreAllMocks();
    });

    it('posts to the resolved completions URL with a decrypted bearer key', async () => {
        fetchMock.mockResolvedValueOnce(streamResponse([
            ssePayload({ content: 'ok' }),
            'data: [DONE]\n\n',
        ]));

        await client.chat({
            provider: provider(),
            messages: [{ role: 'user', content: 'hi' }],
            tools: [{ name: 'list_queues', description: 'List queues', inputSchema: {} }],
            stream: true,
        });

        expect(fetchMock).toHaveBeenCalledTimes(1);
        const [url, init] = fetchMock.mock.calls[0];
        expect(url).toBe('https://api.openai.com/v1/chat/completions');
        expect(init.headers.Authorization).toBe(`Bearer ${PLAIN_KEY}`);
        expect(init.signal).toBeDefined();
        const body = JSON.parse(init.body);
        expect(body.model).toBe('gpt-4o-mini');
        expect(body.max_tokens).toEqual(expect.any(Number));
        expect(body.max_tokens).toBeGreaterThan(0);
        expect(body.tools).toEqual([
            {
                type: 'function',
                function: {
                    name: 'list_queues',
                    description: 'List queues',
                    parameters: { type: 'object', properties: {} },
                },
            },
        ]);
    });

    it('applies an API-key header for api_key_header auth and sends no key for none', async () => {
        fetchMock.mockResolvedValue(streamResponse([ssePayload({ content: 'x' }), 'data: [DONE]\n\n']));

        await client.chat({
            provider: provider({ auth_type: 'api_key_header' }),
            messages: [{ role: 'user', content: 'hi' }],
            stream: true,
        });
        expect(fetchMock.mock.calls[0][1].headers['X-API-Key']).toBe(PLAIN_KEY);
        expect(fetchMock.mock.calls[0][1].headers.Authorization).toBeUndefined();

        await client.chat({
            provider: provider({ auth_type: 'none', encrypted_api_key: encryptSecret(PLAIN_KEY) }),
            messages: [{ role: 'user', content: 'hi' }],
            stream: true,
        });
        expect(fetchMock.mock.calls[1][1].headers.Authorization).toBeUndefined();
        expect(fetchMock.mock.calls[1][1].headers['X-API-Key']).toBeUndefined();
    });

    it('streams text through onToken and returns accumulated parsed tool calls plus usage', async () => {
        const tokens: string[] = [];
        fetchMock.mockResolvedValueOnce(streamResponse([
            ssePayload({ content: 'Hello' }),
            ssePayload({ content: ' there' }),
            ssePayload({
                tool_calls: [{
                    index: 0,
                    id: 'call_1',
                    type: 'function',
                    function: { name: 'list_queues', arguments: '' },
                }],
            }),
            ssePayload({
                tool_calls: [{ index: 0, function: { arguments: '{"limit":' } }],
            }),
            ssePayload({
                tool_calls: [{ index: 0, function: { arguments: '5}' } }],
            }, { usage: { prompt_tokens: 12, completion_tokens: 8 } }),
            'data: [DONE]\n\n',
        ]));

        const result = await client.chat({
            provider: provider(),
            messages: [{ role: 'user', content: 'queues?' }],
            tools: [{ name: 'list_queues', description: 'List queues', inputSchema: { limit: { type: 'number' } } }],
            stream: true,
            onToken: (chunk) => tokens.push(chunk),
        });

        expect(tokens).toEqual(['Hello', ' there']);
        expect(result.error).toBeUndefined();
        expect(result.text).toBe('Hello there');
        expect(result.toolCalls).toEqual([
            { id: 'call_1', name: 'list_queues', arguments: { limit: 5 } },
        ]);
        expect(result.usage).toEqual({ promptTokens: 12, completionTokens: 8 });
    });

    it('surfaces a tool-argument parse failure as a structured error', async () => {
        fetchMock.mockResolvedValueOnce(streamResponse([
            ssePayload({
                tool_calls: [{
                    index: 0,
                    id: 'call_bad',
                    function: { name: 'list_queues', arguments: '{not-json' },
                }],
            }),
            'data: [DONE]\n\n',
        ]));

        const result = await client.chat({
            provider: provider(),
            messages: [{ role: 'user', content: 'x' }],
            stream: true,
        });

        expect(result.error).toEqual(expect.objectContaining({
            code: expect.any(String),
            message: expect.stringMatching(/parse|json|arguments/i),
        }));
        expect(result.toolCalls).toEqual([]);
    });

    it('stops reading when the signal aborts mid-stream and issues no further request', async () => {
        const abort = new AbortController();
        fetchMock.mockResolvedValueOnce(streamResponse([
            ssePayload({ content: 'partial' }),
            ssePayload({ content: 'more' }),
            'data: [DONE]\n\n',
        ]));

        const tokens: string[] = [];
        const result = await client.chat({
            provider: provider(),
            messages: [{ role: 'user', content: 'hi' }],
            signal: abort.signal,
            stream: true,
            onToken: (chunk) => {
                tokens.push(chunk);
                abort.abort();
            },
        });

        expect(tokens).toEqual(['partial']);
        expect(tokens).not.toContain('more');
        expect(fetchMock).toHaveBeenCalledTimes(1);
        expect(result.error?.code === 'aborted' || result.text === 'partial').toBe(true);
    });

    it('returns a structured error when the endpoint cannot be normalized', async () => {
        const result = await client.chat({
            provider: provider({ endpoint: 'wss://api.openai.com/v1/realtime' }),
            messages: [{ role: 'user', content: 'hi' }],
            stream: true,
        });

        expect(fetchMock).not.toHaveBeenCalled();
        expect(result.error).toEqual(expect.objectContaining({
            code: expect.any(String),
            message: expect.stringMatching(/endpoint|url|normalize|websocket/i),
        }));
    });
});
