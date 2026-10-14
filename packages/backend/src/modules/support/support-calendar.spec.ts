import { evaluateSchedule } from '../time-groups/time-groups-ai.adapter';
import { formatTimeGroupInterval } from '../../shared/utils/dialplan.util';
import { TimeGroupsService } from '../time-groups/time-groups.service';
describe('Support calendar runtime contract',()=>{
 const interval={time_start:'08:00',time_end:'22:00',days_of_week:'mon,wed,fri',days_of_month:'*',months:'*',timezone:'Asia/Krasnoyarsk'};
 it('uses inclusive Asterisk 21:59, explicit timezone and list separators',()=>{expect(formatTimeGroupInterval(interval)).toBe('08:00-21:59,mon&wed&fri,*,*,Asia/Krasnoyarsk');});
 it('handles midnight and rejects empty intervals and injected timezone',()=>{
  expect(formatTimeGroupInterval({...interval,time_start:'22:00',time_end:'00:00'})).toContain('22:00-23:59');
  expect(()=>formatTimeGroupInterval({...interval,time_end:'08:00'})).toThrow('calendar_empty_interval');
  expect(()=>formatTimeGroupInterval({...interval,timezone:'UTC?System(id)'})).toThrow();
 });
 it('uses TESTTIME-compatible jumps, resets the result and always returns',()=>{
  const service=new TimeGroupsService({} as any);const dialplan=service.generateDialplan({uid:7,name:'Fixture',intervals:[interval]} as any);
  expect(dialplan).toContain('Set(__WORKTIME_7=0)');expect(dialplan).toContain('GotoIfTime(08:00-21:59,mon&wed&fri,*,*,Asia/Krasnoyarsk?wt_7_0_open:wt_7_0_done)');
  expect(dialplan).toContain('n(wt_7_0_open),Set(__WORKTIME_7=1)');expect(dialplan).toContain('Return()');expect(dialplan).not.toContain('ExecIfTime');
 });
});

describe('API and Asterisk cyclic calendars',()=>{
 const hours={time_start:'08:00',time_end:'22:00',days_of_week:'mon-sun',days_of_month:'*',months:'*',timezone:'Asia/Krasnoyarsk'};
 it('handles all seven days and the half-open 08:00/22:00 boundaries in the interval timezone',()=>{
  for(const [at,inside] of [['2026-10-12T00:59:00Z',false],['2026-10-12T01:00:00Z',true],['2026-10-12T14:59:00Z',true],['2026-10-12T15:00:00Z',false],['2026-10-11T01:00:00Z',true]] as const){const result=evaluateSchedule([hours],new Date(at),'Europe/Moscow');expect(result.inside).toBe(inside);expect(result.timezone).toBe('Asia/Krasnoyarsk');}
 });
 it('supports cyclic weekend/month ranges and rejects malformed range tails',()=>{
  const weekend={...hours,days_of_week:'sat-sun',months:'dec-feb'};
  expect(evaluateSchedule([weekend],new Date('2026-01-03T01:00:00Z'),'UTC').inside).toBe(true);
  expect(()=>formatTimeGroupInterval({...hours,days_of_week:'mon-fri-sun'})).toThrow('calendar_range_invalid');
  expect(()=>formatTimeGroupInterval({...hours,days_of_month:'0'})).toThrow('calendar_range_invalid');
 });
});
