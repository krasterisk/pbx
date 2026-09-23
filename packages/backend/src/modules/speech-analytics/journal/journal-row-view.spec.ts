import { readJournalColumns } from './journal-row-view';

describe('readJournalColumns', () => {
  it('maps operator, caller, duration, csat, sentiment, topics and success', () => {
    const columns = readJournalColumns({
      metadata: {
        operator: { name: 'Анна' },
        clientPhone: '89001112233',
        durationSec: 65,
      },
      audioMs: null,
      quality: 'low',
      projectName: 'Поддержка',
      metricResults: [
        { id: 'csat', value: 4 },
        { id: 'customer_sentiment', value: 'Negative' },
        { id: 'topic', value: 'support' },
        { id: 'success', value: false },
      ],
    });

    expect(columns).toEqual({
      operatorName: 'Анна',
      callerPhone: '89001112233',
      durationMs: 65000,
      score: 4,
      sentiment: 'negative',
      topics: ['support'],
      success: false,
      lowStt: true,
      projectName: 'Поддержка',
    });
  });

  it('prefers run audio_ms over metadata duration and ignores scores outside 1..5', () => {
    const columns = readJournalColumns({
      metadata: JSON.stringify({ operatorExten: '101', durationSec: 9 }),
      audioMs: '45000',
      quality: 'ok',
      projectName: null,
      metricResults: [{ id: 'csat', value: 80 }],
    });

    expect(columns.operatorName).toBe('101');
    expect(columns.durationMs).toBe(45000);
    expect(columns.score).toBeNull();
  });
});
