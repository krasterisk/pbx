import { describe, expect, it } from 'vitest';
import { supervisorNamedQueues, supervisorQueueAllowed, supervisorQueueSummary, supervisorStatusActions } from './supervisorPulse';
import type { IQueueStats } from '../model/types/callCenterSchema';

describe('supervisor Pulse contracts', () => {
  it('enriches live queue names without replacing figures or inventing live queues', () => {
    const live = [{ name: 'q700_8', waiting: 2, calls: { answered: 7 } }, { name: 'q701_8', waiting: 0 }] as IQueueStats[];
    const result = supervisorNamedQueues(live, [
      { name: 'q700_8', display_name: 'Customer support' }, { name: 'q702_8', display_name: 'Not live' },
    ]);
    expect(result).toHaveLength(2);
    expect(result[0]).toEqual({ ...live[0], displayName: 'Customer support' });
    expect(result[0].calls).toBe(live[0].calls);
    expect(result[1]).toBe(live[1]);
    expect(live[0].displayName).toBeUndefined();
  });
  it('retains full short names, truncates Unicode characters including ellipsis, and leaves the source intact', () => {
    expect(supervisorQueueSummary('Sales, Support')).toBe('Sales, Support');
    const full = 'Support, Sales, Corporate accounts, Partners';
    expect(Array.from(supervisorQueueSummary(full))).toHaveLength(32);
    expect(supervisorQueueSummary(full)).toMatch(/…$/);
    expect(full).toBe('Support, Sales, Corporate accounts, Partners');
    expect(supervisorQueueSummary('😀'.repeat(40))).toBe('😀'.repeat(31) + '…');
  });

  it('distinguishes unrestricted access from an empty list and resolves queue-number aliases', () => {
    expect(supervisorQueueAllowed('q700_8', '700', null)).toBe(true);
    expect(supervisorQueueAllowed('q700_8', '700', [])).toBe(false);
    expect(supervisorQueueAllowed('q700_8', undefined, ['700'])).toBe(true);
    expect(supervisorQueueAllowed('q700_8', '700', ['Q700_8'])).toBe(true);
    expect(supervisorQueueAllowed('q700_8', '700', ['701'])).toBe(false);
  });

  it('exposes manual shift and pause actions without manufacturing call-derived statuses', () => {
    const base = { interface: 'PJSIP/e201_8', userId: 4 };
    expect(supervisorStatusActions({ ...base, status: 'READY' })).toMatchObject({ start: false, end: true, pause: true, resume: false });
    expect(supervisorStatusActions({ ...base, status: 'PAUSED' })).toMatchObject({ pause: false, resume: true });
    expect(supervisorStatusActions({ ...base, status: 'IN_CALL' })).toMatchObject({ pause: false, resume: false, confirmEnd: true });
    expect(supervisorStatusActions({ ...base, status: 'WRAPUP' })).toMatchObject({ pause: false, resume: false });
    expect(supervisorStatusActions({ ...base, interface: 'user:4', status: 'OFFLINE' })).toMatchObject({ start: true, end: false, queues: false });
  });
});
