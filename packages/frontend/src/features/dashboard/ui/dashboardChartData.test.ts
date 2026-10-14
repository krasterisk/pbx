import { describe, it, expect } from 'vitest';
import type { DashboardBucket } from '@krasterisk/shared';
import { groupDashboardBuckets } from './dashboardChartData';
const keys = ['total','incoming','outgoing','internal','external','accepted','missed','unknown'] as const;
const period = { from:'2026-10-11T00:00:00Z',to:'2026-10-12T00:00:00Z',timezone:'UTC' };
const buckets: DashboardBucket[] = Array.from({ length:300 },(_,index) => ({
  at:new Date(Date.parse(period.from) + index * 288000).toISOString(),total:index+10,incoming:index+5,outgoing:3,internal:2,external:0,accepted:index+3,missed:1,unknown:1,
}));
describe('responsive dashboard chart groups', () => {
  it.each([24,96,300])('preserves all business totals while displaying at most%d groups', (limit) => {
    const groups = groupDashboardBuckets(buckets,period,limit);
    expect(groups.length).toBe(limit);
    for(const key of keys) expect(groups.reduce((sum,group)=>sum+group[key],0)).toBe(buckets.reduce((sum,bucket)=>sum+bucket[key],0));
    expect(Date.parse(groups[0].at)).toBe(Date.parse(period.from));
    expect(groups.at(-1)?.until).toBe(period.to);
    for(let index=0;index<groups.length-1;index+=1) expect(groups[index].until).toBe(groups[index+1].at);
  });
  it('balances group durations and drills the full first and last displayed intervals', () => {
    const groups = groupDashboardBuckets(buckets,period,24);
    expect(groups[0].at).toBe(buckets[0].at);
    expect(groups[0].until).toBe(buckets[12].at);
    expect(groups.at(-1)?.at).toBe(buckets[287].at);
    expect(groups.at(-1)?.until).toBe(period.to);
    const durations=groups.map(group=>Date.parse(group.until)-Date.parse(group.at));
    expect(Math.max(...durations)-Math.min(...durations)).toBe(288000);
  });
  it('keeps quiet source intervals in their temporal positions and preserves exact drill coverage', () => {
    const quietPeriod = { from:'2026-10-11T08:00:00Z',to:'2026-10-11T14:00:00Z',timezone:'UTC' };
    const zero = Object.fromEntries(keys.map(key => [key,0])) as Omit<DashboardBucket,'at' | 'until'>;
    const sparse = Array.from({ length:6 },(_,index) => ({
      ...zero,
      at:new Date(Date.parse(quietPeriod.from) + index * 3600000).toISOString(),
      until:new Date(Date.parse(quietPeriod.from) + (index + 1) * 3600000).toISOString(),
      total:index === 0 ? 10 : index === 5 ? 6 : 0,
      incoming:index === 0 ? 10 : index === 5 ? 6 : 0,
      accepted:index === 0 ? 10 : index === 5 ? 6 : 0,
    }));
    const full = groupDashboardBuckets(sparse,quietPeriod,6);
    expect(full.map(group => group.total)).toEqual([10,0,0,0,0,6]);
    const groups = groupDashboardBuckets(sparse,quietPeriod,3);
    expect(groups.map(group => group.total)).toEqual([10,0,6]);
    expect(groups[1]).toMatchObject({ at:sparse[2].at,until:sparse[3].until,total:0 });
    expect(groups[0].until).toBe(groups[1].at);
    expect(groups[1].until).toBe(groups[2].at);
    expect(Date.parse(groups[0].at)).toBe(Date.parse(quietPeriod.from));
    expect(Date.parse(groups[2].until)).toBe(Date.parse(quietPeriod.to));
    for(const key of keys) expect(groups.reduce((sum,group)=>sum+group[key],0)).toBe(sparse.reduce((sum,bucket)=>sum+bucket[key],0));
  });
  it('honors explicit source ends including clamped first and last intervals', () => {
    const clippedPeriod = { from:'2026-10-11T08:03:00Z',to:'2026-10-11T10:17:00Z',timezone:'UTC' };
    const samples = [
      { ...buckets[0],at:clippedPeriod.from,until:'2026-10-11T09:00:00Z' },
      { ...buckets[1],at:'2026-10-11T09:00:00Z',until:'2026-10-11T10:00:00Z' },
      { ...buckets[2],at:'2026-10-11T10:00:00Z',until:clippedPeriod.to },
    ];
    const groups = groupDashboardBuckets(samples,clippedPeriod,3);
    expect(groups.map(group => [group.at,group.until])).toEqual(samples.map(sample => [sample.at,sample.until]));
    expect(groupDashboardBuckets([samples[0]],clippedPeriod,1)[0].until).toBe(samples[0].until);
    expect(groupDashboardBuckets(samples,clippedPeriod,1)[0]).toMatchObject({ at:clippedPeriod.from,until:clippedPeriod.to,total:samples.reduce((sum,sample)=>sum+sample.total,0) });
  });
  it('does not manufacture samples or counts for empty sources and clamps a leading bucket', () => {
    expect(groupDashboardBuckets([],period,24)).toEqual([]);
    const first={...buckets[0],at:'2026-10-10T23:55:00Z'};
    const group=groupDashboardBuckets([first],period,24)[0];
    expect(group.at).toBe(period.from);
    expect(group.until).toBe(period.to);
    expect(group.total).toBe(first.total);
  });
});
