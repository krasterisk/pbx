import {describe,it,expect} from 'vitest';
import {boundedCallPeriod,invalidCallPeriod} from './callPeriod';
describe('report periods before transport',()=>{
 it('keeps overview and attention on the same implicit seven-day cohort',()=>{
  for(const days of [31,366]) {
   const result=boundedCallPeriod({},'Asia/Krasnoyarsk',days,new Date('2026-10-22T19:00:00Z'));
   expect(result.query.from).toBe('2026-10-16T17:00:00.000Z');
   expect(result.query.to).toBe('2026-10-23T17:00:00.000Z');
   expect(result.limited).toBe(false);
  }
 });
 it('rejects reversed dates, invalid calendars and incomplete instants',()=>{
  for(const query of [{dateFrom:'2026-10-24',dateTo:'2026-10-22'},{dateFrom:'2026-02-30'},{from:'2026-10-22T12:00:00Z'},{from:'2026-10-22',to:'2026-10-23'}])expect(invalidCallPeriod(query)).toBe(true);
  expect(invalidCallPeriod({dateFrom:'2026-10-22',dateTo:'2026-10-22'})).toBe(false);
 });
 it('bounds all history and oversized cohorts for both workspaces, preserving filters',()=>{
  for(const days of [31,366]){
   const result=boundedCallPeriod({dateFrom:'',dateTo:'',trunks:['t_a'],directions:['in']},'Asia/Krasnoyarsk',days,new Date('2026-10-22T10:00:00Z'));
   expect(result.limited).toBe(true);expect(Date.parse(result.query.to!)-Date.parse(result.query.from!)).toBe(days*86400000);
   expect(result.query).toMatchObject({trunks:['t_a'],directions:['in'],dateFrom:undefined,dateTo:undefined});
  }
 });
 it('preserves a valid precise cohort and includes the last local day',()=>{
  const result=boundedCallPeriod({dateFrom:'2026-10-16',dateTo:'2026-10-22'},'Asia/Krasnoyarsk',31);
  expect(result.limited).toBe(false);expect(result.query.from).toBe('2026-10-15T17:00:00.000Z');expect(result.query.to).toBe('2026-10-22T17:00:00.000Z');
 });
 it('rejects a future start with an open end and nonexistent organization calendar boundaries',()=>{
  expect(invalidCallPeriod({dateFrom:'2026-10-24',dateTo:''},'UTC',new Date('2026-10-22T12:00:00Z'))).toBe(true);
  expect(boundedCallPeriod({dateFrom:'2011-12-30',dateTo:'2011-12-30'},'Pacific/Apia',31).invalid).toBe(true);
 });
});
