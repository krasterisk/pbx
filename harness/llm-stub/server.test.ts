import { afterEach, describe, expect, it } from 'vitest';
import { startLlmStub, type LlmStubHandle } from './index.js';

function parseSseData(body: string): unknown[] {
  return body
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => line.startsWith('data:'))
    .map((line) => {
      const payload = line.slice(5).trim();
      if (payload === '[DONE]') return '[DONE]';
      return JSON.parse(payload);
    });
}

function contentFromEvents(events: unknown[]): string[] {
  return events.flatMap((event) => {
    if (event === '[DONE]' || typeof event !== 'object' || event == null) return [];
    const content = (event as { choices?: Array<{ delta?: { content?: string } }> }).choices?.[0]?.delta?.content;
    return typeof content === 'string' ? [content] : [];
  });
}

async function postCompletions(url: string, body: Record<string, unknown>): Promise<Response> {
  return fetch(`${url}/v1/chat/completions`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  });
}

describe('llm stub', () => {
  let handle: LlmStubHandle | undefined;

  afterEach(async () => {
    await handle?.close();
    handle = undefined;
  });

  it('answers /v1/chat/completions with an OpenAI-shaped SSE stream', async () => {
    handle = await startLlmStub();
    handle.useScenario('with-tools');

    const response = await postCompletions(handle.url, {
      messages: [{ role: 'user', content: 'list queues' }],
      tools: [{ type: 'function', function: { name: 'list_queues' } }],
    });

    expect(response.status).toBe(200);
    expect(response.headers.get('content-type')).toMatch(/text\/event-stream/);

    const events = parseSseData(await response.text());
    expect(events.at(-1)).toBe('[DONE]');

    const chunks = events.filter((event) => event !== '[DONE]') as Array<{
      choices?: Array<{
        index?: number;
        delta?: {
          content?: string;
          tool_calls?: Array<{ index: number; id: string; function: { name: string; arguments: string } }>;
        };
        finish_reason?: string;
      }>;
      usage?: { prompt_tokens: number; completion_tokens: number };
    }>;

    const contentChunk = chunks.find((chunk) => chunk.choices?.[0]?.delta?.content);
    expect(contentChunk?.choices?.[0]?.delta?.content).toBe('calling');

    const toolChunk = chunks.find((chunk) => chunk.choices?.[0]?.delta?.tool_calls?.length);
    expect(toolChunk?.choices?.[0]?.index).toBe(0);
    expect(toolChunk?.choices?.[0]?.delta?.tool_calls?.[0]).toMatchObject({
      index: 0,
      id: 'call_1',
      function: { name: 'list_queues' },
    });
    expect(JSON.parse(toolChunk?.choices?.[0]?.delta?.tool_calls?.[0]?.function.arguments ?? '{}')).toEqual({
      limit: 10,
    });

    const finishChunk = chunks.find((chunk) => chunk.choices?.[0]?.finish_reason);
    expect(finishChunk?.choices?.[0]?.finish_reason).toBe('tool_calls');
    expect(finishChunk?.usage).toEqual({ prompt_tokens: 10, completion_tokens: 5 });
  });

  it('replays turns in order and repeats the last one', async () => {
    handle = await startLlmStub();
    handle.useScenario('two-turns');

    const texts: string[] = [];
    for (let i = 0; i < 3; i += 1) {
      const response = await postCompletions(handle.url, {
        messages: [{ role: 'user', content: `turn ${i}` }],
      });
      expect(response.status).toBe(200);
      texts.push(...contentFromEvents(parseSseData(await response.text())));
    }

    expect(texts).toEqual(['first', 'second', 'second']);
  });

  it('serves reasoning in a separate delta field', async () => {
    handle = await startLlmStub();
    handle.useScenario('with-reasoning');

    const response = await postCompletions(handle.url, {
      messages: [{ role: 'user', content: 'why?' }],
    });
    const events = parseSseData(await response.text()).filter((event) => event !== '[DONE]') as Array<{
      choices?: Array<{ delta?: { content?: string; reasoning_content?: string } }>;
    }>;

    const reasoningChunk = events.find((event) => event.choices?.[0]?.delta?.reasoning_content);
    const contentChunk = events.find((event) => event.choices?.[0]?.delta?.content);

    expect(reasoningChunk?.choices?.[0]?.delta?.reasoning_content).toBe('сначала подумаю');
    expect(reasoningChunk?.choices?.[0]?.delta?.content).toBeUndefined();
    expect(contentChunk?.choices?.[0]?.delta?.content).toBe('ответ');
    expect(contentChunk?.choices?.[0]?.delta?.reasoning_content).toBeUndefined();
    expect(reasoningChunk).not.toBe(contentChunk);
  });

  it('records the prompt it received', async () => {
    handle = await startLlmStub();
    handle.useScenario('two-turns');

    await postCompletions(handle.url, {
      messages: [
        { role: 'system', content: 'You are a PBX agent' },
        { role: 'user', content: 'hi' },
      ],
      tools: [{ type: 'function', function: { name: 'list_queues' } }],
      tool_choice: 'auto',
    });

    expect(handle.requests()[0]?.messages[0]?.role).toBe('system');
    expect(handle.requests()[0]?.messages[0]?.content).toBe('You are a PBX agent');
    expect(handle.requests()[0]?.tools).toEqual(['list_queues']);
    expect(handle.requests()[0]?.toolChoice).toBe('auto');
  });

  it('switches scenario over http', async () => {
    handle = await startLlmStub();
    handle.useScenario('two-turns');

    const switched = await fetch(`${handle.url}/__stub/scenario`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ id: 'with-reasoning' }),
    });
    expect(switched.status).toBe(200);

    const response = await postCompletions(handle.url, {
      messages: [{ role: 'user', content: 'switch' }],
    });
    const events = parseSseData(await response.text()).filter((event) => event !== '[DONE]') as Array<{
      choices?: Array<{ delta?: { content?: string; reasoning_content?: string } }>;
    }>;

    expect(events.find((event) => event.choices?.[0]?.delta?.reasoning_content)?.choices?.[0]?.delta?.reasoning_content)
      .toBe('сначала подумаю');
    expect(contentFromEvents(events)).toEqual(['ответ']);
  });

  it('exposes the horns-and-hooves IVR lookup-then-plan scenario', async () => {
    handle = await startLlmStub();
    handle.useScenario('plan-horns-hooves');
    const names: string[] = [];
    for (let i = 0; i < 5; i += 1) {
      const response = await postCompletions(handle.url, {
        messages: [{ role: 'user', content: `turn ${i}` }],
        tools: [
          { type: 'function', function: { name: 'list_tts_engines' } },
          { type: 'function', function: { name: 'list_endpoints' } },
          { type: 'function', function: { name: 'propose_plan' } },
        ],
      });
      const events = parseSseData(await response.text()).filter((event) => event !== '[DONE]') as Array<{
        choices?: Array<{ delta?: { content?: string; tool_calls?: Array<{ function: { name: string } }> } }>;
      }>;
      const tool = events.find((event) => event.choices?.[0]?.delta?.tool_calls?.length)
        ?.choices?.[0]?.delta?.tool_calls?.[0]?.function.name;
      const text = events.find((event) => event.choices?.[0]?.delta?.content)?.choices?.[0]?.delta?.content;
      names.push(tool ?? text ?? '');
    }
    expect(names).toEqual([
      'list_tts_engines',
      'list_endpoints',
      'list_endpoints',
      'propose_plan',
      'Подтвердите план: меню «Рога и копыта», кнопки 1–3 на 101–103, таймаут — группа ringall.',
    ]);
  });

  it('exposes the three basic PBX setup scenarios', async () => {
    handle = await startLlmStub();
    for (const id of ['plan-reception', 'plan-queues', 'plan-trunk'] as const) {
      handle.useScenario(id);
      const response = await postCompletions(handle.url, {
        messages: [{ role: 'user', content: id }],
        tools: [{ type: 'function', function: { name: 'propose_plan' } }],
      });
      const events = parseSseData(await response.text()).filter((event) => event !== '[DONE]') as Array<{
        choices?: Array<{ delta?: { tool_calls?: Array<{ function: { name: string; arguments: string } }> } }>;
      }>;
      const call = events.find((event) => event.choices?.[0]?.delta?.tool_calls?.length)
        ?.choices?.[0]?.delta?.tool_calls?.[0];
      expect(call?.function.name).toBe('propose_plan');
      const args = JSON.parse(call?.function.arguments ?? '{}') as { steps?: Array<{ tool?: string }> };
      expect(args.steps?.map((step) => step.tool)).toEqual(
        id === 'plan-reception'
          ? ['create_endpoints_bulk', 'create_call_group', 'create_ivr']
          : id === 'plan-queues'
            ? ['create_queue', 'create_queue', 'create_ivr']
            : ['create_directory', 'create_trunk', 'create_endpoints_bulk'],
      );
    }
  });

  it('answers the health probe', async () => {
    handle = await startLlmStub();

    const response = await fetch(`${handle.url}/__stub/health`);
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ ok: true });
  });
});
