import { describe, expect, it } from 'vitest';
import { supervisorQueueAllowed, supervisorQueueSummary, supervisorStatusActions } from './supervisorPulse';

describe('supervisor Pulse contracts', () => {
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
