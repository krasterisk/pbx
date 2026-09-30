import {
  aggregateDashboard,
  filterDashboardByAccess,
  orderDashboardMetrics,
  readDashboardMetricScores,
  type DashboardConversation,
} from './dashboard.service';
import { UserLevel } from '../../users/user.model';

function row(partial: Partial<DashboardConversation> & { id: string }): DashboardConversation {
  return {
    operatorExten: null,
    operatorName: null,
    uploadedByUserId: null,
    sourceKind: 'upload',
    latestAmount: '1.00',
    currency: 'RUB',
    lowStt: false,
    success: true,
    sentiment: 'positive',
    metricScores: { greeting: 80, needs: 60 },
    dayLabel: 'Mon',
    overallScore: 80,
    ...partial,
  };
}

describe('aggregateDashboard (D-34)', () => {
  it('excludes low-STT conversations from averages and exposes their count', () => {
    const result = aggregateDashboard({
      conversations: [
        row({ id: 'a', overallScore: 100, lowStt: false, latestAmount: '2.00', durationMs: 60000 }),
        row({ id: 'b', overallScore: 40, lowStt: true, latestAmount: '3.00' }),
        row({ id: 'c', overallScore: 80, lowStt: false, latestAmount: '1.00' }),
      ],
      scope: null,
      viewer: { userId: 1, level: UserLevel.ADMIN },
    });

    expect(result.lowSttCount).toBe(1);
    expect(result.averageScore).toBe(90);
    expect(result.conversationCount).toBe(3);
    expect(result.costTotal).toBe('6.00');
    expect(result.averageCost).toBe('2.00');
    expect(result.averageDurationMs).toBe(60000);
  });

  it('sums latest-run amounts only for cost cards and ignores insights amounts', () => {
    const result = aggregateDashboard({
      conversations: [
        row({ id: 'a', latestAmount: '1.50', currency: 'RUB' }),
        row({ id: 'b', latestAmount: '2.50', currency: 'RUB' }),
      ],
      scope: null,
      viewer: { userId: 1, level: UserLevel.ADMIN },
    });
    expect(result.costTotal).toBe('4.00');
    expect(result.currency).toBe('RUB');
  });

  it('respects CDR access list the same way as the journal', () => {
    const visible = filterDashboardByAccess(
      [
        row({ id: 'mine', operatorExten: '101', uploadedByUserId: 9 }),
        row({ id: 'other', operatorExten: '202', uploadedByUserId: 8 }),
      ],
      {
        operators: ['101'],
        ownExten: '101',
        queues: [],
      },
      { userId: 9, level: UserLevel.OPERATOR },
    );
    expect(visible.map((r) => r.id)).toEqual(['mine']);
  });

  it('marks the ranking ready once 20 conversations are in the sample', () => {
    const conversations = Array.from({ length: 21 }, (_, index) => row({
      id: `c-${index}`,
      overallScore: 4,
      dayLabel: index < 10 ? '2026-09-28' : '2026-09-29',
    }));
    const result = aggregateDashboard({
      conversations,
      scope: null,
      viewer: { userId: 1, level: UserLevel.ADMIN },
    });
    expect(result.conversationCount).toBe(21);
    expect(result.ranking).toBe('ok');
    expect(result.dynamics.map((point) => point.label)).toEqual(['2026-09-28', '2026-09-29']);
  });

  it('keeps CSAT and topics out of the metric averages', () => {
    expect(readDashboardMetricScores([
      { id: 'csat', value: 5 },
      { id: 'greeting_quality', value: 75 },
      { id: 'topics', value: ['sales'] },
      { id: 'custom_polite', value: 50 },
      { id: 'appointment_booked', value: true },
    ])).toEqual({
      scores: { greeting_quality: 75, custom_polite: 50 },
      rationales: {},
    });
    const result = aggregateDashboard({
      conversations: [
        row({ id: 'a', metricScores: { greeting_quality: 75, custom_polite: 50 } }),
      ],
      scope: null,
      viewer: { userId: 1, level: UserLevel.ADMIN },
    });
    expect(orderDashboardMetrics(
      result.metrics,
      ['custom_polite', 'greeting_quality'],
      new Map([['greeting_quality', 'Приветствие'], ['custom_polite', 'Вежливость']]),
    )).toEqual([
      { id: 'custom_polite', label: 'Вежливость', avg: 50 },
      { id: 'greeting_quality', label: 'Приветствие', avg: 75 },
    ]);
  });

  it('ranks operators by average score and counts topics', () => {
    const result = aggregateDashboard({
      conversations: [
        row({ id: 'a', operatorName: 'Татьяна', overallScore: 5, topics: ['Запись'], sentiment: 'positive', success: true }),
        row({ id: 'b', operatorName: '  ', overallScore: 2, topics: ['Запись'], sentiment: 'negative', success: false }),
        row({ id: 'c', operatorName: 'Татьяна', overallScore: 3, topics: ['Подготовка'], sentiment: 'neutral', success: true }),
      ],
      scope: null,
      viewer: { userId: 1, level: UserLevel.ADMIN },
    });
    expect(result.operators).toEqual([
      {
        operatorName: 'Татьяна',
        callsCount: 2,
        averageScore: 4,
        successRate: 1,
        negativeRate: 0,
      },
      {
        operatorName: null,
        callsCount: 1,
        averageScore: 2,
        successRate: 0,
        negativeRate: 1,
      },
    ]);
    expect(result.topics).toEqual([
      { label: 'Запись', count: 2 },
      { label: 'Подготовка', count: 1 },
    ]);
    expect(result.calls).toHaveLength(3);
  });
});
