import type { AutodialSummaryRow } from '@/shared/api/endpoints/autodialApi';
import { buildDispositionBreakdown, isoDate, isoDaysAgo, isoToday } from './reportRange';

function row(over: Partial<AutodialSummaryRow> = {}): AutodialSummaryRow {
  return {
    campaign_uid: 1,
    campaign_name: 'A',
    dials: 0,
    answered: 0,
    success: 0,
    short: 0,
    no_answer: 0,
    busy: 0,
    amd: 0,
    failed: 0,
    talk_sec_sum: 0,
    billsec_sum: 0,
    kpi: {
      contact_rate: 0,
      rpc: 0,
      asr: 0,
      aht: 0,
      acd: 0,
      abandon_rate: 0,
      list_penetration: 0,
      dials_per_contact: 0,
      calls_per_hour: 0,
    },
    ...over,
  };
}

describe('isoDate', () => {
  it('pads month and day and stays on the local calendar date', () => {
    expect(isoDate(new Date(2026, 0, 5, 23, 30))).toBe('2026-01-05');
  });

  it('produces a range where the start is not after today', () => {
    expect(isoDaysAgo(6) <= isoToday()).toBe(true);
  });
});

describe('buildDispositionBreakdown', () => {
  it('sums each bucket across campaigns', () => {
    const slices = buildDispositionBreakdown([
      row({ success: 3, busy: 1 }),
      row({ campaign_uid: 2, success: 2, no_answer: 5 }),
    ]);
    expect(slices).toEqual([
      { disposition: 'success', value: 5 },
      { disposition: 'no_answer', value: 5 },
      { disposition: 'busy', value: 1 },
    ]);
  });

  it('drops empty buckets so the legend stays readable', () => {
    expect(buildDispositionBreakdown([row({ success: 1 })])).toEqual([
      { disposition: 'success', value: 1 },
    ]);
  });

  it('returns nothing for an empty report', () => {
    expect(buildDispositionBreakdown([])).toEqual([]);
  });

  it('coerces string counters coming back from SQL SUM()', () => {
    const slices = buildDispositionBreakdown([
      row({ success: '4' as unknown as number, busy: null as unknown as number }),
    ]);
    expect(slices).toEqual([{ disposition: 'success', value: 4 }]);
  });
});
