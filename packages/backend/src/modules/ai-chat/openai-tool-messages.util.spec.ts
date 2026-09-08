import {
  normalizeOpenAiToolCalls,
  repairOpenAiChatMessages,
  type OpenAiChatMessage,
} from './openai-tool-messages.util';

describe('openai-tool-messages.util', () => {
  it('normalizes internal and OpenAI tool_call shapes', () => {
    expect(normalizeOpenAiToolCalls([
      { id: 'call_1', name: 'create_ivr', arguments: { name: 'A' } },
      {
        id: 'call_2',
        type: 'function',
        function: { name: 'list_endpoints', arguments: '{}' },
      },
    ])).toEqual([
      {
        id: 'call_1',
        type: 'function',
        function: { name: 'create_ivr', arguments: '{"name":"A"}' },
      },
      {
        id: 'call_2',
        type: 'function',
        function: { name: 'list_endpoints', arguments: '{}' },
      },
    ]);
  });

  it('synthesizes missing tool replies after assistant tool_calls', () => {
    const messages: OpenAiChatMessage[] = [
      { role: 'system', content: 'sys' },
      { role: 'user', content: 'make ivr' },
      {
        role: 'assistant',
        content: '',
        tool_calls: [{ id: 'call_aU0mkpyfeLkh0NSeVLX6tVT9', name: 'create_call_group', arguments: {} }],
      },
      { role: 'user', content: 'try again' },
    ];

    const repaired = repairOpenAiChatMessages(messages);
    expect(repaired.map((row) => row.role)).toEqual([
      'system',
      'user',
      'assistant',
      'tool',
      'user',
    ]);
    expect(repaired[3]).toMatchObject({
      role: 'tool',
      tool_call_id: 'call_aU0mkpyfeLkh0NSeVLX6tVT9',
      name: 'create_call_group',
    });
    expect(String(repaired[3].content)).toMatch(/missing_tool_result/);
  });

  it('drops orphan tool messages and keeps matched pairs', () => {
    const messages: OpenAiChatMessage[] = [
      { role: 'tool', tool_call_id: 'orphan', content: 'nope', name: 'x' },
      {
        role: 'assistant',
        content: '',
        tool_calls: [
          { id: 'c1', name: 'a', arguments: {} },
          { id: 'c2', name: 'b', arguments: {} },
        ],
      },
      { role: 'tool', tool_call_id: 'c1', content: 'ok1', name: 'a' },
      { role: 'user', content: 'next' },
    ];

    const repaired = repairOpenAiChatMessages(messages);
    expect(repaired.map((row) => ({ role: row.role, id: row.tool_call_id }))).toEqual([
      { role: 'assistant', id: undefined },
      { role: 'tool', id: 'c1' },
      { role: 'tool', id: 'c2' },
      { role: 'user', id: undefined },
    ]);
  });
});
