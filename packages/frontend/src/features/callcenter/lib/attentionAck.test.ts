import { beforeEach, describe, expect, it } from 'vitest';
import type { AttentionItem } from './attentionItems';
import {
  MAX_CRITICAL_SNOOZE_MS,
  createAckEntry,
  createSnoozeEntry,
  groupAttentionItems,
  isItemSuppressed,
  readAttentionAckStore,
  writeAttentionAckStore,
} from './attentionAck';

const NOW = new Date('2026-10-15T12:00:00.000Z').getTime();

const pauseItem = (agent: string, valueSec: number, severity: AttentionItem['severity'] = 'warning'): AttentionItem => ({
  id: `pause_over:${agent}`,
  kind: 'pause_over',
  severity,
  agentInterface: agent,
  agentName: agent,
  valueSec,
  limitSec: 600,
  overrun: valueSec / 600,
});

describe('attentionAck (U1.6)', () => {
  beforeEach(() => localStorage.clear());

  it('acknowledged item stays hidden until the value worsens by a 5 minute step', () => {
    const item = pauseItem('PJSIP/1', 700);
    const entries = { [item.id]: createAckEntry(item) };
    expect(isItemSuppressed(item, entries, NOW)).toBe(true);
    expect(isItemSuppressed(pauseItem('PJSIP/1', 900), entries, NOW)).toBe(true);
    expect(isItemSuppressed(pauseItem('PJSIP/1', 1000), entries, NOW)).toBe(false);
  });

  it('snooze hides until expiry and critical snooze is capped at 10 minutes', () => {
    const critical = pauseItem('PJSIP/2', 1500, 'critical');
    const entry = createSnoozeEntry(critical, NOW, 60 * 60 * 1000);
    expect(entry.snoozeUntil).toBe(NOW + MAX_CRITICAL_SNOOZE_MS);
    const entries = { [critical.id]: entry };
    expect(isItemSuppressed(critical, entries, NOW + 5 * 60 * 1000)).toBe(true);
    expect(isItemSuppressed(critical, entries, NOW + 11 * 60 * 1000)).toBe(false);
  });

  it('persists per business day and drops yesterday entries', () => {
    const item = pauseItem('PJSIP/3', 700);
    writeAttentionAckStore(7, NOW, { [item.id]: createAckEntry(item) });
    expect(Object.keys(readAttentionAckStore(7, NOW))).toEqual([item.id]);
    expect(readAttentionAckStore(7, NOW + 36 * 3600 * 1000)).toEqual({});
  });

  it('groups 4+ identical agent alerts into one row until expanded', () => {
    const items = ['1', '2', '3', '4', '5'].map((n) => pauseItem(`PJSIP/${n}`, 700 + Number(n)));
    const grouped = groupAttentionItems(items, new Set());
    expect(grouped).toHaveLength(1);
    expect(grouped[0]).toMatchObject({ type: 'group', kind: 'pause_over' });
    expect(grouped[0].items).toHaveLength(5);
    expect(groupAttentionItems(items, new Set(['pause_over']))).toHaveLength(5);
    expect(groupAttentionItems(items.slice(0, 3), new Set())).toHaveLength(3);
  });
});
