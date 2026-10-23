import { describe,it,expect } from 'vitest';
import {callDateTimeInstant,callLocalDateTime} from './callDateTime';
describe('organization-local report time',()=>{
 it('uses the organization zone rather than the browser and round trips across dates',()=>{expect(callDateTimeInstant('2026-10-22T14:20','Asia/Krasnoyarsk')).toBe('2026-10-22T07:20:00.000Z');expect(callLocalDateTime('2026-10-21T19:00:00Z','Asia/Krasnoyarsk')).toBe('2026-10-22T02:00');});
 it('rejects nonexistent clock times and invalid calendar dates',()=>{expect(callDateTimeInstant('2026-03-08T02:30','America/New_York')).toBeNull();expect(callDateTimeInstant('2026-02-30T14:20','UTC')).toBeNull();});
 it('includes both occurrences at an autumn clock transition',()=>{expect(callDateTimeInstant('2026-11-01T01:30','America/New_York')).toBe('2026-11-01T05:30:00.000Z');expect(callDateTimeInstant('2026-11-01T01:30','America/New_York',true)).toBe('2026-11-01T06:30:00.000Z');});
});
