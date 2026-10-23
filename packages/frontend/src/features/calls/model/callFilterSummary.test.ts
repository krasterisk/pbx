import { describe, expect, it } from 'vitest';
import type { CallsFacets } from '@krasterisk/shared';
import { callFilterSummary } from './callFilterSummary';
import { callPeriodParams, selectedCallPeriod, visibleCallPeriods } from './savedCallFilters';
const now = new Date('2026-10-22T19:00:00Z');
const summary = (query: Parameters<typeof callFilterSummary>[0], facets?: CallsFacets) =>
  callFilterSummary(query, 'Asia/Krasnoyarsk', 'ru', key => key, facets, now);
describe('collapsed selection summary', () => {
  it('shows seven calendar days and preserves explicit, open and timed periods', () => {
    expect(summary({})).toEqual([{ key: 'period', text: 'calls.period: calls.periods.week' }]);
    expect(summary({ dateFrom: '2026-10-16', dateTo: '2026-10-22' })[0].text).toBe('calls.period: 16.10.2026 - 22.10.2026');
    expect(summary({ dateFrom: '', dateTo: '' })[0].text).toBe('calls.period: calls.periods.all');
    expect(summary({ dateFrom: '', dateTo: '2026-10-22' })[0].text).toBe('calls.period: … - 22.10.2026');
    expect(summary({ from: '2026-10-22T07:00:00Z', to: '2026-10-22T08:00:00Z' })[0].text).toBe('calls.period: 22.10.2026, 14:00 - 22.10.2026, 14:59');
  });
  it('uses the same preset as the editor and retains explicitly custom dates even when matching a preset', () => {
    for (const period of visibleCallPeriods) {
      const query = callPeriodParams(period, 'Asia/Krasnoyarsk', now);
      expect(selectedCallPeriod(query,'Asia/Krasnoyarsk',period,now)).toBe(period);
      expect(callFilterSummary(query,'Asia/Krasnoyarsk','ru',key=>key,undefined,now,period)[0].text).toBe(`calls.period: calls.periods.${period}`);
    }
    const dates=callPeriodParams('week','Asia/Krasnoyarsk',now);
    expect(callFilterSummary(dates,'Asia/Krasnoyarsk','ru',key=>key,undefined,now,'custom')[0].text)
      .toBe('calls.period: 17.10.2026 - 23.10.2026');
  });
  it('describes selected values and directory names without navigation parameters', () => {
    const facets: CallsFacets = { options: { employee: [], department: [], companyNumber: [], queue: [], robot: [], group: [{value:'9010',label:'Поддержка',count:0}] }, truncated: {}, analyticsAllowed:false, dataAsOf:null };
    const values = summary({ directions:['in','out'], groups:['9010'], results:['busy'], numbers:['79135551122'], numberRole:'caller', recording:'no', analytics:'failed', cursor:'next', limit:50 }, facets);
    expect(values).toEqual(expect.arrayContaining([
      {key:'groups',text:'calls.group: Поддержка'},
      {key:'directions',text:'calls.directionLabel: calls.directionFilter.in, calls.directionFilter.out'},
      {key:'outcomes',text:'calls.result: calls.connectionResult.busy'},
      {key:'numbers',text:'calls.numbers: 79135551122 (calls.numberRoles.caller)'},
      {key:'recording',text:'calls.withoutRecording'},
      {key:'analytics',text:'calls.analytics: calls.analysis.failed'},
    ]));
    expect(values.some(row => /next|50/.test(row.text))).toBe(false);
    expect(summary({groups:['unlisted']})[1].text).toContain('unlisted');
  });
});
