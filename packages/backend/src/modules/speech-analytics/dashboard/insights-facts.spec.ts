import type { DashboardAggregate, DashboardCall } from './dashboard.service';
import { buildInsightsFacts, insightsCacheKey } from './insights-facts';
import { attachInsightRecordingIds } from './insights-evidence';
import type { SaInsight } from './insights.service';
import { insightMatchesFacts, parseInsightsPayload, sanitizeInsights } from './insights-validate';

function aggregate(patch: Partial<DashboardAggregate> = {}): DashboardAggregate {
  return {
    conversationCount: 12,
    lowSttCount: 0,
    costTotal: '120.00',
    averageCost: '10.00',
    averageDurationMs: 90_000,
    currency: 'RUB',
    successRate: 0.5,
    averageScore: 8,
    sentiment: { positive: 4, neutral: 5, negative: 3 },
    metrics: [{ id: 'greeting', label: 'Приветствие', avg: 7 }],
    dynamics: [],
    ranking: 'insufficient_sample',
    operators: [],
    topics: [{ label: 'Запись', count: 4 }],
    calls: [],
    ...patch,
  };
}

function call(patch: Partial<DashboardCall>): DashboardCall {
  return {
    id: 'rec-1',
    occurredAt: '2026-09-10T10:00:00.000Z',
    dayLabel: '2026-09-10',
    operatorName: 'Ольга',
    callerPhone: '1',
    score: 6,
    success: true,
    sentiment: 'negative',
    lowStt: false,
    latestAmount: '10.00',
    currency: 'RUB',
    topics: ['Запись'],
    metrics: [{ id: 'greeting', value: 4, rationale: 'нет имени' }],
    ...patch,
  };
}

describe('buildInsightsFacts', () => {
  const labels = { currentLabel: '2026-09-01 - 2026-09-30', previousLabel: '2026-08-01 - 2026-08-31' };

  it('keeps deltas empty when the previous window is below the sample threshold', () => {
    const facts = buildInsightsFacts(aggregate(), aggregate({ conversationCount: 4 }), labels);
    expect(facts.period.comparable).toBe(false);
    expect(facts.period.previousLabel).toBeNull();
    expect(facts.period.comparisonNote).toContain('Сравнить не с чем');
    expect(facts.summary.calls).toEqual({ current: 12, previous: null, delta: null });
    expect(facts.summary.score.delta).toBeNull();
    expect(facts.topics.grew).toEqual([]);
    expect(facts.topics.faded).toEqual([]);
  });

  it('computes current minus previous for calls, score, success, AHT, cost and sentiment', () => {
    const previous = aggregate({
      conversationCount: 10,
      averageScore: 6,
      successRate: 0.25,
      averageDurationMs: 60_000,
      costTotal: '80.00',
      sentiment: { positive: 1, neutral: 2, negative: 7 },
      metrics: [{ id: 'greeting', label: 'Приветствие', avg: 5 }],
      topics: [{ label: 'Запись', count: 1 }, { label: 'Жалоба', count: 4 }],
    });
    const facts = buildInsightsFacts(aggregate(), previous, labels);
    expect(facts.period.comparable).toBe(true);
    expect(facts.summary.calls.delta).toBe(2);
    expect(facts.summary.score).toMatchObject({ current: 8, previous: 6, delta: 2 });
    expect(facts.summary.successPct).toMatchObject({ current: 50, previous: 25, delta: 25 });
    expect(facts.summary.ahtSec).toMatchObject({ current: 90, previous: 60, delta: 30 });
    expect(facts.summary.cost).toMatchObject({ current: 120, previous: 80, delta: 40 });
    expect(facts.summary.sentiment.negative.delta).toBe(-4);
    expect(facts.metrics[0]).toMatchObject({ id: 'greeting', avg: 7, previousAvg: 5, delta: 2 });
    expect(facts.topics.grew.map((topic) => topic.label)).toContain('Запись');
    expect(facts.topics.faded.map((topic) => topic.label)).toContain('Жалоба');
  });

  it('names operators with at least three calls who sit below and above the metric', () => {
    const calls = ['Ольга', 'Ольга', 'Ольга', 'Иван', 'Иван', 'Иван'].map((name, index) => call({
      id: `rec-${index}`,
      operatorName: name,
      metrics: [{ id: 'greeting', value: name === 'Ольга' ? 3 : 9, rationale: '' }],
    }));
    const facts = buildInsightsFacts(aggregate({ calls, metrics: [{ id: 'greeting', label: 'Приветствие', avg: 6 }] }), null, labels);
    expect(facts.metrics[0].worseOperators.map((row) => row.name)).toEqual(['Ольга']);
    expect(facts.metrics[0].betterOperators.map((row) => row.name)).toEqual(['Иван']);
  });

  it('counts success and sentiment mismatches and keeps stored rationales', () => {
    const facts = buildInsightsFacts(aggregate({
      calls: [
        call({ id: 'bad-success', success: true, sentiment: 'negative' }),
        call({ id: 'calm-fail', success: false, sentiment: 'neutral', metrics: [] }),
      ],
    }), null, labels);
    expect(facts.mismatch).toEqual({ successfulNegative: 1, unsuccessfulCalm: 1 });
    expect(facts.quotes[0]).toMatchObject({ recordingId: 'bad-success', text: 'нет имени', metricId: 'greeting' });
  });

  it('changes the cache key when the project focus changes', () => {
    const facts = buildInsightsFacts(aggregate(), null, labels);
    const base = {
      tenantUid: 1,
      projectId: 'p',
      from: 'a',
      to: 'b',
      facts,
    };
    expect(insightsCacheKey({ ...base, insightsFocus: '' })).not.toBe(
      insightsCacheKey({ ...base, insightsFocus: 'возражения' }),
    );
  });
});

describe('sanitizeInsights', () => {
  const insight = (value: number, observation: string): SaInsight => ({
    type: 'gap',
    priority: 'high',
    title: 'Пробел',
    observation,
    recommendation: 'Разобрать 12 звонков',
    evidence: { metric: 'calls', value, operators: [], periodLabel: '' },
  });

  it('drops a card that cites a number outside the pack', () => {
    const facts = { calls: 12 };
    expect(insightMatchesFacts(insight(12, 'В выборке 12 разговоров'), new Set(['12']))).toBe(true);
    expect(sanitizeInsights([insight(99, 'Оценка 99')], facts)).toEqual([]);
    expect(sanitizeInsights([insight(12, 'В выборке 12 разговоров')], facts)).toHaveLength(1);
  });

  it('parses a JSON object and rejects a broken schema', () => {
    const raw = JSON.stringify({
      insights: [{
        type: 'strength',
        priority: 'low',
        title: 'Рост',
        observation: 'Звонков 12',
        recommendation: 'Закрепить',
        evidence: { metric: 'calls', value: 12, operators: [], periodLabel: '' },
      }],
    });
    const parsed = parseInsightsPayload(raw);
    expect(parsed.ok).toBe(true);
    expect(parseInsightsPayload('not json').ok).toBe(false);
  });
});

describe('attachInsightRecordingIds', () => {
  it('attaches exemplar ids for a weak metric and does not trust model ids', () => {
    const calls = [1, 2, 3].map((score, index) => call({
      id: `rec-${index}`,
      metrics: [{ id: 'greeting', value: score, rationale: 'цитата' }],
    }));
    const [card] = attachInsightRecordingIds([{
      type: 'gap',
      priority: 'high',
      title: 'Приветствие',
      observation: 'Оценка 1',
      recommendation: 'Разобрать',
      evidence: { metric: 'greeting', value: 1, operators: [], periodLabel: '', recordingIds: ['invented'] },
    }], calls);
    expect(card.evidence.recordingIds?.[0]).toBe('rec-0');
    expect(card.evidence.recordingIds).not.toContain('invented');
  });
});
