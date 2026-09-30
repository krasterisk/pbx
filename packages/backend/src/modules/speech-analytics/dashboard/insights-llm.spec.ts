import { buildInsightsUserMessage, completeInsightsChat, insightsChatBody, insightsProviderModel } from './insights-llm';

const facts = {
  period: { currentLabel: '2026-09-01 - 2026-09-30', previousLabel: '2026-08-01 - 2026-08-31', comparable: true, comparisonNote: null },
  summary: { calls: { current: 12, previous: 10, delta: 2 } },
};

function card(value = 12) {
  return {
    type: 'gap',
    priority: 'high',
    title: 'Мало звонков',
    observation: `В выборке ${value} разговоров`,
    recommendation: 'Супервизору разобрать 12 звонков',
    evidence: { metric: 'calls', value, operators: [], periodLabel: '2026-09-01 - 2026-09-30' },
  };
}

describe('insightsProviderModel', () => {
  it('uses the scoring provider model instead of the placeholder id', () => {
    expect(insightsProviderModel('default-call-analysis', 'deepseek-chat')).toBe('deepseek-chat');
    expect(insightsProviderModel('cabinet-insights', 'deepseek-chat')).toBe('cabinet-insights');
    expect(insightsProviderModel('', 'deepseek-chat')).toBe('deepseek-chat');
  });
});

describe('insights chat', () => {
  it('asks for temperature 0 JSON and repeats the fact rules next to the pack', () => {
    const userText = buildInsightsUserMessage({
      projectName: 'Медцентр',
      systemPrompt: 'Клиника',
      insightsFocus: 'смотри запись к врачу',
      facts,
    });
    expect(userText).toContain('Не выдумывай числа');
    expect(userText).toContain('Если язык неясен, пиши на русском');
    expect(userText).toContain('смотри запись к врачу');
    expect(userText).toContain('period.comparable');
    expect(userText).toContain('"current":12');
    const body = insightsChatBody({
      model: 'demo-model',
      endpoint: 'https://llm.example/v1',
      skillText: 'skill',
      userText,
    });
    expect(body.temperature).toBe(0);
    expect(body.response_format).toEqual({ type: 'json_object' });
  });

  it('retries once when the first schema is invalid and then accepts fact numbers', async () => {
    const post = jest.fn()
      .mockResolvedValueOnce({ text: 'nope', tokens: 3 })
      .mockResolvedValueOnce({ text: JSON.stringify({ insights: [card()] }), tokens: 5 });
    const result = await completeInsightsChat({
      post,
      model: 'demo-model',
      endpoint: 'https://llm.example/v1',
      skillText: 'skill',
      projectName: 'Медцентр',
      systemPrompt: null,
      insightsFocus: '',
      facts,
    });
    expect(post).toHaveBeenCalledTimes(2);
    expect(result.providerTokens).toBe(8);
    expect(result.insights).toHaveLength(1);
    const retryBody = post.mock.calls[1][0] as { messages: Array<{ content: string }> };
    expect(retryBody.messages[1].content).toContain('Предыдущий ответ отклонён');
  });

  it('does not call the model a third time when numbers stay invented', async () => {
    const post = jest.fn().mockResolvedValue({ text: JSON.stringify({ insights: [card(500)] }), tokens: 2 });
    const result = await completeInsightsChat({
      post,
      model: 'demo-model',
      endpoint: 'https://llm.example/v1',
      skillText: 'skill',
      projectName: 'Медцентр',
      systemPrompt: null,
      insightsFocus: '',
      facts,
    });
    expect(post).toHaveBeenCalledTimes(2);
    expect(result.insights).toEqual([]);
  });
});
