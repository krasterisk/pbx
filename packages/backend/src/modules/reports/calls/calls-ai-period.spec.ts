import { aiCallPeriod } from './calls-ai-period';
describe('AI call weeks use organization calendar',()=>{
  const now=new Date('2026-10-23T05:00:00Z');
  it('resolves full previous and current weeks for Sunday and Monday',()=>{
    expect(aiCallPeriod('this_week','Asia/Krasnoyarsk',now,'sunday')).toEqual({dateFrom:'2026-10-18',dateTo:'2026-10-23'});
    expect(aiCallPeriod('last_week','Asia/Krasnoyarsk',now,'sunday')).toEqual({dateFrom:'2026-10-11',dateTo:'2026-10-17'});
    expect(aiCallPeriod('last_week','Asia/Krasnoyarsk',now,'monday')).toEqual({dateFrom:'2026-10-12',dateTo:'2026-10-18'});
    expect(aiCallPeriod('last_7_days','Asia/Krasnoyarsk',now,'sunday')).toEqual(aiCallPeriod('last_7_days','Asia/Krasnoyarsk',now,'monday'));
  });
});
