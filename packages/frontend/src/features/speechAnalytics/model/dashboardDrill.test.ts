import { describe, expect, it } from 'vitest';
import { filterDashboardCalls, type DashboardCall } from './dashboardDrill';

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
    metrics: [{ id: 'greeting_quality', value: 75, rationale: 'есть приветствие' }],
    ...patch,
  };
}

describe('filterDashboardCalls', () => {
  const calls = [
    call({ id: 'a' }),
    call({
      id: 'b',
      operatorName: null,
      sentiment: 'negative',
      success: false,
      dayLabel: '2026-09-29',
      topics: ['Подготовка'],
      lowStt: true,
      latestAmount: null,
      metrics: [],
    }),
  ];

  it('keeps the conversations that formed a metric, a day, and an operator', () => {
    expect(filterDashboardCalls(calls, { type: 'metric', metricId: 'greeting_quality' }).map((row) => row.id)).toEqual(['a']);
    expect(filterDashboardCalls(calls, { type: 'day', day: '2026-09-29' }).map((row) => row.id)).toEqual(['b']);
    expect(filterDashboardCalls(calls, { type: 'operator', operatorName: null }).map((row) => row.id)).toEqual(['b']);
    expect(filterDashboardCalls(calls, { type: 'topic', topic: 'Запись' }).map((row) => row.id)).toEqual(['a']);
    expect(filterDashboardCalls(calls, { type: 'lowStt' }).map((row) => row.id)).toEqual(['b']);
    expect(filterDashboardCalls(calls, { type: 'cost' }).map((row) => row.id)).toEqual(['a']);
  });
});
