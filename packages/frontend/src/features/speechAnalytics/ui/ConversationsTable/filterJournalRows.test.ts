import { describe, expect, it } from 'vitest';
import { filterJournalRows, journalScoreScale } from './filterJournalRows';
import type { SaJournalRow } from '../../api/speechAnalyticsApi';

describe('journalScoreScale', () => {
  it('stays on 1-5 when every project uses the default scale', () => {
    expect(journalScoreScale([
      { draft_config: null },
      { draft_config: { insights: { success: { enabled: true, instruction: '' }, csat: { enabled: true, min: 1, max: 5, lowLabel: '', highLabel: '', instruction: '' }, summary: { enabled: true, instruction: '' }, sentiment: { enabled: true, instruction: '', values: [] } } } },
    ])).toEqual({ min: 1, max: 5 });
  });

  it('uses the widest project scale without listing every point', () => {
    expect(journalScoreScale([
      { draft_config: null },
      {
        draft_config: {
          insights: {
            success: { enabled: true, instruction: '' },
            csat: { enabled: true, min: 1, max: 10, lowLabel: '', highLabel: '', instruction: '' },
            summary: { enabled: true, instruction: '' },
            sentiment: { enabled: true, instruction: '', values: [] },
          },
        },
      },
    ])).toEqual({ min: 1, max: 10 });
  });

  it('falls back to 1-5 when CSAT is turned off everywhere', () => {
    expect(journalScoreScale([
      {
        draft_config: {
          insights: {
            success: { enabled: true, instruction: '' },
            csat: { enabled: false, min: 0, max: 10, lowLabel: '', highLabel: '', instruction: '' },
            summary: { enabled: true, instruction: '' },
            sentiment: { enabled: true, instruction: '', values: [] },
          },
        },
      },
    ])).toEqual({ min: 1, max: 5 });
  });
});

describe('filterJournalRows score range', () => {
  const row = (id: string, score: number | null): SaJournalRow => ({
    id,
    occurredAt: '2026-09-21T10:00:00.000Z',
    sourceKind: 'upload',
    latestAmount: null,
    currency: null,
    summary: null,
    score,
  });

  it('keeps scores inside the typed bounds', () => {
    const items = [row('low', 2), row('mid', 40), row('high', 90), row('none', null)];
    const matched = filterJournalRows(items, {
      search: '',
      source: '',
      dateFrom: '',
      dateTo: '',
      sentiment: '',
      scoreFrom: '30',
      scoreTo: '80',
    });
    expect(matched.map((item) => item.id)).toEqual(['mid']);
  });
});
