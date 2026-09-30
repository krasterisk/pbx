import {
  applyRecordingIdFilter,
  drillDashboardCalls,
  enrichInsightsWithRecordingIds,
  findExemplarRecordingIds,
  findRecordingIdsForDistribution,
  findRecordingIdsForTag,
  parseSentimentFilter,
  parseSuccessFilter,
  readMetricValue,
} from './dashboard-drill';
import type { DashboardCall } from './dashboard.service';

function call(patch: Partial<DashboardCall> & { id: string }): DashboardCall {
  return {
    occurredAt: '2026-09-28T10:00:00.000Z',
    dayLabel: '2026-09-28',
    operatorName: 'Татьяна',
    callerPhone: '100',
    score: 4,
    success: true,
    sentiment: 'positive',
    lowStt: false,
    latestAmount: '1.00',
    currency: 'RUB',
    topics: ['Запись'],
    metrics: [{ id: 'greeting_quality', value: 80, rationale: 'есть приветствие' }],
    ...patch,
  };
}

describe('dashboard drill algorithms', () => {
  const calls = [
    call({ id: 'good', sentiment: 'positive', success: true }),
    call({
      id: 'bad',
      operatorName: 'Виктория',
      sentiment: 'negative',
      success: false,
      topics: ['Жалоба'],
      metrics: [
        { id: 'customer_sentiment', value: 'negative', rationale: '' },
        { id: 'greeting_quality', value: 10, rationale: 'нет приветствия' },
      ],
    }),
    call({ id: 'low', lowStt: true, sentiment: 'negative', success: false }),
  ];

  it('parses sentiment and success the same way as the journal filters', () => {
    expect(parseSentimentFilter(' Positive ')).toBe('positive');
    expect(parseSentimentFilter('')).toBeNull();
    expect(parseSuccessFilter('1')).toBe(true);
    expect(parseSuccessFilter('false')).toBe(false);
    expect(parseSuccessFilter(undefined)).toBeNull();
    expect(() => parseSentimentFilter('angry')).toThrow('filter_invalid');
  });

  it('intersects recording ids and uses a sentinel when a filter matches nothing', () => {
    expect(applyRecordingIdFilter(['a', 'b'], ['b', 'c'], '__empty__')).toEqual(['b']);
    expect(applyRecordingIdFilter(['a'], [], '__empty__')).toEqual([]);
  });

  it('reads a numeric metric and ignores sentiment stored as text', () => {
    expect(readMetricValue(calls[1], 'greeting_quality')).toBe(10);
    expect(readMetricValue(calls[1], 'customer_sentiment')).toBeNull();
  });

  it('prefers the metric row for sentiment and falls back to the analysis field', () => {
    expect(findRecordingIdsForDistribution(calls, { sentiment: 'negative' })).toEqual(['bad']);
    expect(findRecordingIdsForDistribution([
      call({ id: 'fallback', sentiment: 'neutral', metrics: [] }),
    ], { sentiment: 'neutral' })).toEqual(['fallback']);
    expect(findRecordingIdsForDistribution(calls, { success: false })).toContain('bad');
  });

  it('finds topic ids and five worst exemplars for a quality insight', () => {
    expect(findRecordingIdsForTag(calls, 'Жалоба')).toEqual(['bad']);
    const pool = [
      call({ id: 'high', metrics: [{ id: 'greeting_quality', value: 90, rationale: '' }] }),
      call({ id: 'low-score', metrics: [{ id: 'greeting_quality', value: 5, rationale: '' }] }),
      call({ id: 'mid', metrics: [{ id: 'greeting_quality', value: 40, rationale: '' }] }),
    ];
    expect(findExemplarRecordingIds(pool, { metric: 'greeting_quality' }, 'quality')[0]).toBe('low-score');
    const enriched = enrichInsightsWithRecordingIds([
      { type: 'quality', evidence: { metric: 'greeting_quality', operators: [] } },
    ], pool);
    expect(enriched[0].evidence?.recordingIds?.[0]).toBe('low-score');
  });

  it('returns every project conversation for the conversations card', () => {
    expect(drillDashboardCalls(calls, { type: 'all' }).map((row) => row.id)).toEqual(['good', 'bad', 'low']);
    expect(drillDashboardCalls(calls, { type: 'metric', metricId: 'greeting_quality' }).map((row) => row.id))
      .toEqual(['good', 'bad']);
    expect(drillDashboardCalls(calls, { type: 'operator', operatorName: 'Виктория' }).map((row) => row.id))
      .toEqual(['bad']);
    expect(drillDashboardCalls(calls, {
      type: 'metric',
      metricId: 'greeting_quality',
      operatorName: 'Виктория',
    }).map((row) => row.id)).toEqual(['bad']);
  });
});
