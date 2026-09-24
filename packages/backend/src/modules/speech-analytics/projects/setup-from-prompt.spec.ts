import { parseSetupFromPrompt } from './setup-from-prompt';

describe('parseSetupFromPrompt', () => {
  it('reads metrics and topics from a fenced JSON answer', () => {
    const parsed = parseSetupFromPrompt(`\`\`\`json
{"metrics":[{"name":"Обещание перезвонить","type":"boolean","description":"Оператор обещал перезвонить"}],
 "topics":[{"name":"Доставка","aliases":["курьер"],"description":"Статус заказа"}]}
\`\`\``);
    expect(parsed.metrics).toEqual([expect.objectContaining({
      name: 'Обещание перезвонить', type: 'boolean', sourceScaleId: null,
    })]);
    expect(parsed.topics[0]).toMatchObject({ name: 'Доставка', aliases: ['курьер'] });
  });

  it('coerces a number metric range', () => {
    const parsed = parseSetupFromPrompt(JSON.stringify({
      metrics: [{ name: 'Скорость', type: 'number', min: 1, max: 5, unit: 'балл' }],
      topics: [],
    }));
    expect(parsed.metrics[0]).toMatchObject({ type: 'number', min: 1, max: 5, unit: 'балл', polarity: 'positive' });
  });
});
