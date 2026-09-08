import { Logger } from '@nestjs/common';
import axios from 'axios';
import { encryptSecret } from '../ai-agents/util/secret-cipher.util';
import { PbxAgentLlmClient } from './pbx-agent-llm.client';
import type { AgentChatParams } from './pbx-agent.types';

jest.mock('axios');
const mockedAxios = axios as jest.Mocked<typeof axios>;

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
        mockedAxios.post.mockReset();
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
        expect(body.max_completion_tokens).toBeUndefined();
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
        expect(body.tool_choice).toBe('auto');
    });

    it('forwards required fields from full JSON Schema tool parameters', async () => {
        fetchMock.mockResolvedValueOnce(streamResponse([
            ssePayload({ content: 'ok' }),
            'data: [DONE]\n\n',
        ]));

        await client.chat({
            provider: provider(),
            messages: [{ role: 'user', content: 'hi' }],
            tools: [{
                name: 'create_call_group',
                description: 'Create group',
                inputSchema: {
                    type: 'object',
                    properties: {
                        name: { type: 'string' },
                        exten: { type: 'string' },
                    },
                    required: ['name', 'exten'],
                    additionalProperties: false,
                },
            }],
            stream: true,
        });

        const body = JSON.parse(fetchMock.mock.calls[0][1].body);
        expect(body.tools[0].function.parameters).toEqual({
            type: 'object',
            properties: {
                name: { type: 'string' },
                exten: { type: 'string' },
            },
            required: ['name', 'exten'],
            additionalProperties: false,
        });
    });

    it('uses max_completion_tokens for gpt-5 models that reject max_tokens', async () => {
        fetchMock.mockResolvedValueOnce(streamResponse([
            ssePayload({ content: 'ok' }),
            'data: [DONE]\n\n',
        ]));

        await client.chat({
            provider: provider({ defaults: { model: 'gpt-5-nano', temperature: 0.2 } }),
            messages: [{ role: 'user', content: 'hi' }],
            tools: [],
            stream: true,
        });

        const body = JSON.parse(fetchMock.mock.calls[0][1].body);
        expect(body.model).toBe('gpt-5-nano');
        expect(body.max_completion_tokens).toBeGreaterThanOrEqual(16_384);
        expect(body.max_tokens).toBeUndefined();
        expect(body.temperature).toBeUndefined();
        expect(body.reasoning_effort).toBe('low');
    });

    it('adds type=function when replaying AgentToolCall history to OpenAI', async () => {
        fetchMock.mockResolvedValueOnce(streamResponse([
            ssePayload({ content: 'ok' }),
            'data: [DONE]\n\n',
        ]));

        await client.chat({
            provider: provider(),
            messages: [
                { role: 'system', content: 'sys' },
                { role: 'user', content: 'создай' },
                {
                    role: 'assistant',
                    content: '',
                    tool_calls: [
                        { id: 'call_1', name: 'list_endpoints', arguments: { limit: 5 } },
                    ],
                },
                {
                    role: 'tool',
                    content: '[]',
                    tool_call_id: 'call_1',
                    name: 'list_endpoints',
                },
                { role: 'user', content: 'группа 9010, создавай' },
            ],
            tools: [{ name: 'create_ivr', description: 'Create IVR', inputSchema: {} }],
            stream: true,
        });

        const body = JSON.parse(fetchMock.mock.calls[0][1].body);
        expect(body.messages[2].tool_calls).toEqual([
            {
                id: 'call_1',
                type: 'function',
                function: { name: 'list_endpoints', arguments: '{"limit":5}' },
            },
        ]);
        expect(body.messages[3]).toEqual({
            role: 'tool',
            content: '[]',
            tool_call_id: 'call_1',
            name: 'list_endpoints',
        });
    });

    it('does not replace create_ivr root args with a longer menu-item snapshot', async () => {
        fetchMock.mockResolvedValueOnce(streamResponse([
            ssePayload({
                tool_calls: [{
                    index: 0,
                    id: 'call_ivr',
                    function: { name: 'create_ivr', arguments: '{"name":"IVR - Продажи"}' },
                }],
            }),
            ssePayload({
                tool_calls: [{
                    index: 0,
                    function: { arguments: '{"digit":2,"destination":{"kind":"extension","target":"102"}}' },
                }],
            }),
            'data: [DONE]\n\n',
        ]));

        const result = await client.chat({
            provider: provider(),
            messages: [{ role: 'user', content: 'ivr' }],
            tools: [{ name: 'create_ivr', description: 'Create IVR', inputSchema: {} }],
            stream: true,
        });

        expect(result.error).toBeUndefined();
        expect(result.toolCalls[0]?.arguments).toEqual(expect.objectContaining({
            name: 'IVR - Продажи',
        }));
        expect(result.toolCalls[0]?.arguments).not.toEqual(expect.objectContaining({ digit: 2 }));
    });

    it('retries without streaming when create_ivr args are a single menu item', async () => {
        fetchMock.mockResolvedValueOnce(streamResponse([
            ssePayload({
                tool_calls: [{
                    index: 0,
                    id: 'call_bad',
                    function: {
                        name: 'create_ivr',
                        arguments: '{"digit":2,"destination":{"kind":"extension","target":"102"}}',
                    },
                }],
            }),
            'data: [DONE]\n\n',
        ]));

        mockedAxios.post.mockResolvedValueOnce({
            status: 200,
            data: {
                choices: [{
                    message: {
                        role: 'assistant',
                        content: '',
                        tool_calls: [{
                            id: 'call_ok',
                            type: 'function',
                            function: {
                                name: 'create_ivr',
                                arguments: JSON.stringify({
                                    name: 'IVR - Продажи',
                                    menu_items: [
                                        { digit: '1', destination: { kind: 'extension', target: '101' } },
                                    ],
                                }),
                            },
                        }],
                    },
                }],
            },
        });

        const result = await client.chat({
            provider: provider(),
            messages: [{ role: 'user', content: 'ivr' }],
            tools: [{ name: 'create_ivr', description: 'Create IVR', inputSchema: {} }],
            stream: true,
        });

        expect(mockedAxios.post).toHaveBeenCalled();
        expect(result.toolCalls[0]?.arguments).toEqual(expect.objectContaining({
            name: 'IVR - Продажи',
        }));
    });

    it('recovers create_call_group when members array lost the opening brace in the stream', async () => {
        const broken = '{"name":"Продажи (101-103)","exten":"9003","strategy":"ringall","members":[member_type":"internal","value":"101","position":0,"ring_time":20},{"member_type":"internal","value":"102","position":1,"ring_time":8},{"member_type":"internal","value":"103","position":2,"ring_time":20}]}';
        fetchMock.mockResolvedValueOnce(streamResponse([
            ssePayload({
                tool_calls: [{
                    index: 0,
                    id: 'call_fix',
                    function: { name: 'create_call_group', arguments: broken },
                }],
            }),
            'data: [DONE]\n\n',
        ]));

        const result = await client.chat({
            provider: provider(),
            messages: [{ role: 'user', content: 'группа' }],
            tools: [{ name: 'create_call_group', description: 'Create group', inputSchema: {} }],
            stream: true,
        });

        expect(result.error).toBeUndefined();
        expect(result.toolCalls[0]?.arguments).toEqual(expect.objectContaining({
            name: 'Продажи (101-103)',
            exten: '9003',
        }));
        expect((result.toolCalls[0]?.arguments as { members?: unknown[] }).members).toHaveLength(3);
    });

    it('retries without streaming when create_call_group args are a member fragment', async () => {
        fetchMock.mockResolvedValueOnce(streamResponse([
            ssePayload({
                tool_calls: [{
                    index: 0,
                    id: 'call_bad',
                    function: {
                        name: 'create_call_group',
                        arguments: '{"value":"103","position":2,"ring_time":20,"member_type":"internal"}',
                    },
                }],
            }),
            'data: [DONE]\n\n',
        ]));

        mockedAxios.post.mockResolvedValueOnce({
            status: 200,
            data: {
                choices: [{
                    message: {
                        role: 'assistant',
                        content: '',
                        tool_calls: [{
                            id: 'call_ok',
                            type: 'function',
                            function: {
                                name: 'create_call_group',
                                arguments: JSON.stringify({
                                    name: '101-103',
                                    exten: '9010',
                                    members: [{ member_type: 'internal', value: '101' }],
                                }),
                            },
                        }],
                    },
                }],
            },
        });

        const result = await client.chat({
            provider: provider(),
            messages: [{ role: 'user', content: 'группа' }],
            tools: [{ name: 'create_call_group', description: 'Create group', inputSchema: {} }],
            stream: true,
        });

        expect(mockedAxios.post).toHaveBeenCalled();
        expect(result.toolCalls[0]?.arguments).toEqual(expect.objectContaining({
            name: '101-103',
            exten: '9010',
        }));
    });

    it('synthesizes missing tool replies before sending history to OpenAI', async () => {
        fetchMock.mockResolvedValueOnce(streamResponse([
            ssePayload({ content: 'ok' }),
            'data: [DONE]\n\n',
        ]));

        await client.chat({
            provider: provider(),
            messages: [
                { role: 'user', content: 'создай' },
                {
                    role: 'assistant',
                    content: '',
                    tool_calls: [
                        { id: 'call_aU0mkpyfeLkh0NSeVLX6tVT9', name: 'create_call_group', arguments: {} },
                    ],
                },
                { role: 'user', content: 'ещё раз' },
            ],
            tools: [],
            stream: true,
        });

        const body = JSON.parse(fetchMock.mock.calls[0][1].body);
        expect(body.messages.map((row: { role: string }) => row.role)).toEqual([
            'user',
            'assistant',
            'tool',
            'user',
        ]);
        expect(body.messages[2]).toMatchObject({
            role: 'tool',
            tool_call_id: 'call_aU0mkpyfeLkh0NSeVLX6tVT9',
            name: 'create_call_group',
        });
    });

    it('sends tool_choice=required when the loop asks for a forced tool call', async () => {
        fetchMock.mockResolvedValueOnce(streamResponse([
            ssePayload({
                tool_calls: [{
                    index: 0,
                    id: 'call_1',
                    function: { name: 'list_endpoints', arguments: '{}' },
                }],
            }),
            'data: [DONE]\n\n',
        ]));

        await client.chat({
            provider: provider(),
            messages: [{ role: 'user', content: 'Создай IVR' }],
            tools: [{ name: 'list_endpoints', description: 'List', inputSchema: {} }],
            toolChoice: 'required',
            stream: true,
        });

        const body = JSON.parse(fetchMock.mock.calls[0][1].body);
        expect(body.tool_choice).toBe('required');
    });

    it('omits model when the provider leaves it empty so the gateway can choose', async () => {
        fetchMock.mockResolvedValueOnce(streamResponse([
            ssePayload({ content: 'ok' }),
            'data: [DONE]\n\n',
        ]));

        await client.chat({
            provider: provider({ defaults: {} }),
            messages: [{ role: 'user', content: 'hi' }],
            stream: true,
        });

        const body = JSON.parse(fetchMock.mock.calls[0][1].body);
        expect(body).not.toHaveProperty('model');
    });

    it('maps a seeded OpenAI realtime websocket to the chat-completions URL', async () => {
        fetchMock.mockResolvedValueOnce(streamResponse([
            ssePayload({ content: 'ok' }),
            'data: [DONE]\n\n',
        ]));

        await client.chat({
            provider: provider({
                endpoint: 'wss://api.openai.com/v1/realtime?model=gpt-4o-realtime-preview',
            }),
            messages: [{ role: 'user', content: 'hi' }],
            stream: true,
        });

        expect(fetchMock.mock.calls[0][0]).toBe('https://api.openai.com/v1/chat/completions');
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

    it('keeps reasoning out of the visible text on a streamed turn', async () => {
        fetchMock.mockResolvedValueOnce(streamResponse([
            ssePayload({ reasoning_content: 'сначала посмотрю очереди' }),
            ssePayload({ content: 'Готово' }),
            'data: [DONE]\n\n',
        ]));

        const completion = await client.chat({
            provider: provider(),
            messages: [{ role: 'user', content: 'hi' }],
            stream: true,
        });
        expect(completion.text).toBe('Готово');
        expect(completion.reasoning).toContain('сначала посмотрю очереди');
    });

    it('keeps reasoning out of the visible text on a JSON turn', async () => {
        fetchMock.mockResolvedValueOnce({
            ok: true,
            status: 200,
            headers: { get: (name: string) => name === 'content-type' ? 'application/json; charset=utf-8' : null },
            text: async () => JSON.stringify({
                choices: [{ message: { content: '', reasoning_content: 'думаю' } }],
            }),
        });

        const completion = await client.chat({
            provider: provider({ capabilities: ['llm'] }),
            messages: [{ role: 'user', content: 'hi' }],
            stream: true,
        });
        expect(completion.text).toBe('');
        expect(completion.reasoning).toBe('думаю');
    });

    it('does not stream reasoning chunks to onToken', async () => {
        const tokens: string[] = [];
        fetchMock.mockResolvedValueOnce(streamResponse([
            ssePayload({ reasoning_content: 'сначала посмотрю очереди' }),
            ssePayload({ content: 'Готово' }),
            'data: [DONE]\n\n',
        ]));

        await client.chat({
            provider: provider(),
            messages: [{ role: 'user', content: 'hi' }],
            stream: true,
            onToken: (chunk) => tokens.push(chunk),
        });
        expect(tokens.join('')).toBe('Готово');
    });

    it('keeps finish_reason=length so the loop can treat a cut-off essay as incomplete', async () => {
        fetchMock.mockResolvedValueOnce(streamResponse([
            ssePayload({ content: 'menu_items = [{digit' }),
            `data: ${JSON.stringify({ choices: [{ index: 0, delta: {}, finish_reason: 'length' }] })}\n\n`,
            'data: [DONE]\n\n',
        ]));

        const result = await client.chat({
            provider: provider({ vendor: 'aipbx' }),
            messages: [{ role: 'user', content: 'создай IVR' }],
            stream: true,
        });

        expect(result.finishReason).toBe('length');
        expect(result.text).toMatch(/menu_items/);
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

    it('treats repeated Ollama snapshot arguments {}{} as an empty object, not a parse error', async () => {
        fetchMock.mockResolvedValueOnce(streamResponse([
            ssePayload({
                tool_calls: [{
                    index: 0,
                    id: 'call_1',
                    function: { name: 'list_call_groups', arguments: '{}' },
                }],
            }),
            ssePayload({
                tool_calls: [{
                    index: 0,
                    function: { arguments: '{}' },
                }],
            }),
            'data: [DONE]\n\n',
        ]));

        const result = await client.chat({
            provider: provider(),
            messages: [{ role: 'user', content: 'группы?' }],
            tools: [{ name: 'list_call_groups', description: 'List groups', inputSchema: {} }],
            stream: true,
        });

        expect(result.error).toBeUndefined();
        expect(result.toolCalls).toEqual([
            { id: 'call_1', name: 'list_call_groups', arguments: {} },
        ]);
    });

    it('does not wipe OpenAI incremental create_ivr args when a {} heartbeat arrives mid-stream', async () => {
        const prefix = '{"name":"Продажи","greeting":"Вы позвонили';
        const mid = ' в компанию","exten":"70';
        const suffix = '1"}';
        fetchMock.mockResolvedValueOnce(streamResponse([
            ssePayload({
                tool_calls: [{
                    index: 0,
                    id: 'call_ivr',
                    function: { name: 'create_ivr', arguments: prefix },
                }],
            }),
            ssePayload({
                tool_calls: [{
                    index: 0,
                    function: { arguments: '{}' },
                }],
            }),
            ssePayload({
                tool_calls: [{
                    index: 0,
                    function: { arguments: mid },
                }],
            }),
            ssePayload({
                tool_calls: [{
                    index: 0,
                    function: { arguments: suffix },
                }],
            }),
            'data: [DONE]\n\n',
        ]));

        const result = await client.chat({
            provider: provider({ defaults: { model: 'gpt-5-nano' } }),
            messages: [{ role: 'user', content: 'создай IVR' }],
            tools: [{ name: 'create_ivr', description: 'Create IVR', inputSchema: {} }],
            stream: true,
        });

        expect(result.error).toBeUndefined();
        expect(result.toolCalls[0]?.name).toBe('create_ivr');
        expect(result.toolCalls[0]?.arguments).toEqual({
            name: 'Продажи',
            greeting: 'Вы позвонили в компанию',
            exten: '701',
        });
    });

    it('concatenates incremental OpenAI argument tokens ending like the create_ivr tail', async () => {
        fetchMock.mockResolvedValueOnce(streamResponse([
            ssePayload({
                tool_calls: [{
                    index: 0,
                    id: 'call_ivr',
                    function: { name: 'create_ivr', arguments: '{"name":"Продажи","members":"101' },
                }],
            }),
            ssePayload({
                tool_calls: [{
                    index: 0,
                    function: { arguments: '-103"}' },
                }],
            }),
            'data: [DONE]\n\n',
        ]));

        const result = await client.chat({
            provider: provider({ defaults: { model: 'gpt-5-nano' } }),
            messages: [{ role: 'user', content: 'IVR' }],
            tools: [{ name: 'create_ivr', description: 'Create IVR', inputSchema: {} }],
            stream: true,
        });

        expect(result.error).toBeUndefined();
        expect(result.toolCalls[0]?.arguments).toEqual({
            name: 'Продажи',
            members: '101-103',
        });
    });

    it('accumulates every tool_call in one SSE chunk, not only the first', async () => {
        fetchMock.mockResolvedValueOnce(streamResponse([
            ssePayload({
                tool_calls: [
                    { index: 0, id: 'c1', function: { name: 'list_call_groups', arguments: '{}' } },
                    { index: 1, id: 'c2', function: { name: 'list_tts_engines', arguments: '{}' } },
                ],
            }),
            'data: [DONE]\n\n',
        ]));

        const result = await client.chat({
            provider: provider(),
            messages: [{ role: 'user', content: 'x' }],
            stream: true,
        });

        expect(result.toolCalls.map((call) => call.name)).toEqual([
            'list_call_groups',
            'list_tts_engines',
        ]);
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
            provider: provider({ endpoint: 'wss://example.com/voice-ai/realtime' }),
            messages: [{ role: 'user', content: 'hi' }],
            stream: true,
        });

        expect(fetchMock).not.toHaveBeenCalled();
        expect(result.error).toEqual(expect.objectContaining({
            code: expect.any(String),
            message: expect.stringMatching(/endpoint|url|normalize|websocket/i),
        }));
    });

    it('returns a structured error naming a provider that lacks the language-model capability', async () => {
        const result = await client.chat({
            provider: provider({ name: 'Yandex STT', capabilities: ['stt'] }),
            messages: [{ role: 'user', content: 'hi' }],
            stream: true,
        });

        expect(fetchMock).not.toHaveBeenCalled();
        expect(result.error).toEqual(expect.objectContaining({
            code: expect.any(String),
            message: expect.stringMatching(/Yandex STT|missing|llm|language-model/i),
        }));
    });

    it('posts OpenAI messages+tools to aipbx completions and never sends message/threadUid', async () => {
        fetchMock.mockResolvedValueOnce(streamResponse([
            ssePayload({ content: 'ok' }),
            'data: [DONE]\n\n',
        ]));

        await client.chat({
            provider: provider({
                name: 'aipbx',
                vendor: 'aipbx',
                endpoint: 'https://aipbx.net/api/chats/12/message',
                capabilities: ['llm'],
                defaults: { model: 'gpt-4o-mini' },
            }),
            messages: [
                { role: 'system', content: 'ты голосовой ассистент...' },
                { role: 'user', content: 'алле, ты меня слышишь?' },
            ],
            tools: [{ name: 'list_queues', description: 'List queues', inputSchema: {} }],
            stream: true,
        });

        expect(fetchMock).toHaveBeenCalledTimes(1);
        const [url, init] = fetchMock.mock.calls[0];
        expect(url).toBe('https://aipbx.net/api/v1/chat/completions');
        const body = JSON.parse(init.body);
        expect(body.message).toBeUndefined();
        expect(body.threadUid).toBeUndefined();
        expect(body.messages).toEqual([
            { role: 'system', content: 'ты голосовой ассистент...' },
            { role: 'user', content: 'алле, ты меня слышишь?' },
        ]);
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

    it('falls back to in-message tool instructions when the provider does not advertise tool calling', async () => {
        const warn = jest.spyOn(Logger.prototype, 'warn').mockImplementation();
        fetchMock.mockResolvedValueOnce(streamResponse([
            ssePayload({ content: '{"name":"list_queues","arguments":{"limit":2}}' }),
            'data: [DONE]\n\n',
        ]));

        const result = await client.chat({
            provider: provider({
                vendor: 'custom-no-tools',
                endpoint: 'https://llm.example.com/v1/chat/completions',
                capabilities: ['llm'],
            }),
            messages: [{ role: 'system', content: 'You are helpful.' }, { role: 'user', content: 'queues?' }],
            tools: [{ name: 'list_queues', description: 'List queues', inputSchema: { limit: { type: 'number' } } }],
            stream: true,
        });

        expect(fetchMock).toHaveBeenCalledTimes(1);
        const body = JSON.parse(fetchMock.mock.calls[0][1].body);
        expect(body.tools).toBeUndefined();
        expect(body.messages[0].content).toMatch(/list_queues/);
        expect(warn.mock.calls.some((call) => /tools|degraded|fallback/i.test(String(call[0])))).toBe(true);
        expect(result.error).toBeUndefined();
        expect(result.toolCalls).toEqual([
            expect.objectContaining({ name: 'list_queues', arguments: { limit: 2 } }),
        ]);
        warn.mockRestore();
    });

    it('parses a tool JSON object from prose when the gateway sent no native tool_calls', async () => {
        fetchMock.mockResolvedValueOnce(streamResponse([
            ssePayload({ content: 'Сначала проверю очереди.\n{"name":"list_queues","arguments":{}}' }),
            'data: [DONE]\n\n',
        ]));

        const result = await client.chat({
            provider: provider({ vendor: 'aipbx', capabilities: ['llm', 'tools'] }),
            messages: [{ role: 'user', content: 'создай IVR' }],
            tools: [{ name: 'list_queues', description: 'List queues', inputSchema: {} }],
            stream: true,
        });

        expect(result.error).toBeUndefined();
        expect(result.toolCalls).toEqual([
            expect.objectContaining({ name: 'list_queues', arguments: {} }),
        ]);
    });

    it('reports provider_timeout when the stream is aborted by the deadline, not the user', async () => {
        fetchMock.mockRejectedValueOnce(Object.assign(new Error('The operation was aborted'), { name: 'AbortError' }));

        const result = await client.chat({
            provider: provider(),
            messages: [{ role: 'user', content: 'hi' }],
            stream: true,
        });

        expect(result.error).toEqual(expect.objectContaining({ code: 'provider_timeout' }));
    });

    it('reads Ollama-style message.content SSE chunks from aipbx', async () => {
        fetchMock.mockResolvedValueOnce(streamResponse([
            `data: ${JSON.stringify({ choices: [{ message: { content: 'Да, слышу' } }] })}\n\n`,
            'data: [DONE]\n\n',
        ]));

        const result = await client.chat({
            provider: provider({
                vendor: 'aipbx',
                endpoint: 'https://aipbx.net/api/v1/chat/completions',
                capabilities: ['llm', 'tools'],
            }),
            messages: [{ role: 'user', content: 'алле' }],
            stream: true,
        });

        expect(result.error).toBeUndefined();
        expect(result.text).toBe('Да, слышу');
    });

    it('reads a non-stream OpenAI JSON body when the gateway ignores stream:true', async () => {
        fetchMock.mockResolvedValueOnce({
            ok: true,
            status: 200,
            headers: { get: (name: string) => name === 'content-type' ? 'application/json; charset=utf-8' : null },
            text: async () => JSON.stringify({
                choices: [{ message: { content: 'слышу' } }],
                usage: { prompt_tokens: 4, completion_tokens: 2 },
            }),
        });

        const result = await client.chat({
            provider: provider({ capabilities: ['llm'] }),
            messages: [{ role: 'user', content: 'алле' }],
            stream: true,
        });

        expect(result.error).toBeUndefined();
        expect(result.text).toBe('слышу');
        expect(result.usage).toEqual({ promptTokens: 4, completionTokens: 2 });
    });

    it('returns a structured error carrying the HTTP status on a non-success response', async () => {
        fetchMock.mockResolvedValueOnce({
            ok: false,
            status: 429,
            text: async () => JSON.stringify({ error: { message: 'rate limited', type: 'insufficient_quota' } }),
            body: { getReader: () => ({ read: async () => ({ done: true }), cancel: async () => undefined }) },
        });

        const result = await client.chat({
            provider: provider(),
            messages: [{ role: 'user', content: 'hi' }],
            stream: true,
        });

        expect(result.error).toEqual(expect.objectContaining({
            code: expect.any(String),
            status: 429,
            message: expect.stringMatching(/429.*https:\/\/api\.openai\.com\/v1\/chat\/completions.*Cascade.*rate limited/),
        }));
    });

    it('logs the resolved URL before send and redacts secrets from an HTTP error body', async () => {
        const debug = jest.spyOn(Logger.prototype, 'debug').mockImplementation();
        const warn = jest.spyOn(Logger.prototype, 'warn').mockImplementation();
        fetchMock.mockResolvedValueOnce({
            ok: false,
            status: 404,
            text: async () => JSON.stringify({
                error: { message: 'No such route', api_key: 'sk-leaked-secret-value' },
            }),
            body: { getReader: () => ({ read: async () => ({ done: true }), cancel: async () => undefined }) },
        });

        const result = await client.chat({
            provider: provider({ name: 'Local Ollama', uid: 7, endpoint: 'http://127.0.0.1:11434/api/chat' }),
            messages: [{ role: 'user', content: 'hi' }],
            stream: true,
        });

        expect(debug.mock.calls.some((call) => (
            /LLM POST http:\/\/127\.0\.0\.1:11434\/v1\/chat\/completions/.test(String(call[0]))
            && /Local Ollama uid=7/.test(String(call[0]))
        ))).toBe(true);
        const warnLine = warn.mock.calls.map((call) => String(call[0])).find((line) => /provider_http/.test(line));
        expect(warnLine).toMatch(/404 POST http:\/\/127\.0\.0\.1:11434\/v1\/chat\/completions/);
        expect(warnLine).toMatch(/Local Ollama uid=7/);
        expect(warnLine).toMatch(/No such route/);
        expect(warnLine).not.toMatch(/sk-leaked-secret-value/);
        expect(result.error?.status).toBe(404);
        debug.mockRestore();
        warn.mockRestore();
    });

    it('issues no request when the signal is already aborted', async () => {
        const abort = new AbortController();
        abort.abort();

        const result = await client.chat({
            provider: provider(),
            messages: [{ role: 'user', content: 'hi' }],
            signal: abort.signal,
            stream: true,
        });

        expect(fetchMock).not.toHaveBeenCalled();
        expect(mockedAxios.post).not.toHaveBeenCalled();
        expect(result.error?.code).toBe('aborted');
    });

    it('uses axios with a non-throwing status validator for a non-streaming completion', async () => {
        mockedAxios.post.mockResolvedValueOnce({
            status: 503,
            data: { error: { message: 'busy' } },
        });

        const result = await client.chat({
            provider: provider(),
            messages: [{ role: 'user', content: 'summarize the thread' }],
            stream: false,
        });

        expect(mockedAxios.post).toHaveBeenCalledTimes(1);
        expect(fetchMock).not.toHaveBeenCalled();
        const config = mockedAxios.post.mock.calls[0][2] as { validateStatus: (s: number) => boolean; timeout: number };
        expect(config.validateStatus(503)).toBe(true);
        expect(config.timeout).toEqual(expect.any(Number));
        expect(result.error).toEqual(expect.objectContaining({
            status: 503,
            message: expect.stringMatching(/503.*\/v1\/chat\/completions.*busy/),
        }));
    });
});
