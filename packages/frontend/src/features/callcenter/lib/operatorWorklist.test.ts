import { describe, expect, it } from 'vitest';
import { currentCallRows, operatorWorkItems } from './operatorWorklist';
import type { ICall } from '../model/types/callCenterSchema';
import type { IMissedCall } from '@/shared/api/endpoints/callCenterApi';

const call = (id: string, queue: string, status: ICall['status'], sec: number, position?: number): ICall => ({ uniqueid: id, queue, status, position, callerIdNum: '201', callerIdName: '', enterTime: new Date(sec * 1000).toISOString(), talkTime: 0, holdTime: 0, userUid: 7 });
describe('current call ordering', () => {
  it('puts conversations first and preserves each queue FIFO regardless of snapshot order', () => {
    const rows = currentCallRows([call('last', 'q1', 'WAITING', 30, 3), call('foreign', 'q9', 'WAITING', 1), call('second', 'q1', 'WAITING', 20, 2), call('talk', 'q1', 'TALKING', 50), call('first', 'q1', 'WAITING', 10, 1), call('other', 'q2', 'WAITING', 15, 1)], ['q1', 'q2']);
    expect(rows.map(row => row.call.uniqueid)).toEqual(['talk', 'first', 'other', 'second', 'last']);
    expect(rows.map(row => row.position)).toEqual([null, 1, 1, 2, 3]);
  });
  it('derives missing positions before search, while retaining authoritative positions and holding calls', () => {
    const rows = currentCallRows([call('late', 'q1', 'WAITING', 20), call('hold', 'q1', 'HOLD', 30), call('early', 'q1', 'RINGING', 10)], ['q1']);
    expect(rows.map(row => [row.call.uniqueid, row.position])).toEqual([['hold', null], ['early', 1], ['late', 2]]);
    expect(rows.filter(row => row.call.uniqueid === 'late')[0].position).toBe(2);
  });
  it('does not mutate the live snapshot', () => {
    const calls = [call('last', 'q1', 'WAITING', 2), call('first', 'q1', 'WAITING', 1)];
    currentCallRows(calls, ['q1']); expect(calls.map(item => item.uniqueid)).toEqual(['last', 'first']);
  });
});

const missed = (over: Partial<IMissedCall> = {}): IMissedCall => ({ uid: 1, call_uniqueid: 'call1', queue_name: 'q1', caller_id_num: '79990001122', caller_id_name: 'Client', personal: false, hold_time: 10, position: 1, called_back: false, called_back_by: null, called_back_at: null, client_called_back: false, note: '', created_at: '2026-10-27T10:00:00Z', ...over });
describe('unified operator worklist', () => {
  it('keeps answered self-returns visible with their distinct resolved status', () => {
    const rows = operatorWorkItems([missed({ client_called_back: true })], [], [], []);
    expect(rows[0]).toMatchObject({ status: 'clientReturned', resolved: true });
  });
  it('does not mistake a claim for a successful callback', () => {
    expect(operatorWorkItems([missed({ called_back_by: 42 })], [], [], [])[0]).toMatchObject({ status: 'claimed', resolved: false });
    expect(operatorWorkItems([missed({ called_back: true, called_back_by: 42 })], [], [], [])[0]).toMatchObject({ status: 'callbackDone', resolved: true });
  });
  it('keeps a new missed attempt actionable after an older callback', () => {
    const rows = operatorWorkItems([missed({ called_back: true }), missed({ uid: 2, call_uniqueid: 'call2', created_at: '2026-10-27T11:00:00Z' })], [], [], []);
    expect(rows[0]).toMatchObject({ status: 'missed', resolved: false, attempts: 2 });
  });
  it('ignores stale active data after a self-resolved attempt and lets a later miss reopen it', () => {
    const group = { callerIdNum: '79990001122', callerIdName: 'Client', personal: false, attemptCount: 1, lastAttemptAt: '2026-10-27T10:00:00Z', claimedBy: null, queueName: 'q1' };
    expect(operatorWorkItems([missed({ client_called_back: true })], [group], [], [])[0].resolved).toBe(true);
    expect(operatorWorkItems([missed({ client_called_back: true })], [{ ...group, lastAttemptAt: '2026-10-27T11:00:00Z' }], [], [])[0].resolved).toBe(false);
  });
  it('keeps personal and queue misses separate', () => {
    expect(operatorWorkItems([missed(), missed({ uid: 2, personal: true, queue_name: 'direct:PJSIP/e201_7' })], [], [], [])).toHaveLength(2);
  });
});
