import type { AttentionItem, AttentionKind, AttentionSeverity } from './attentionItems';

export interface AttentionAckEntry {
  id: string;
  /** Value at the moment the supervisor clicked "Acknowledge" (sec for durations, pct for SLA, count for agents). */
  valueAtAck: number;
  /** Epoch ms until which the item is snoozed (`null` = acknowledged until it worsens by a step). */
  snoozeUntil: number | null;
}

export interface AttentionAckStore {
  dayKey: string;
  entries: Record<string, AttentionAckEntry>;
}

/** Step by which a metric must worsen after "Acknowledge" before the item reappears (Q4). */
export const ACK_PAUSE_WORSEN_STEP_SEC = 300; // +5 min
export const ACK_SLA_WORSEN_STEP_PCT = 5; // -5 pp
export const ACK_WAIT_WORSEN_STEP_SEC = 60; // +1 min
/** Maximum snooze duration for critical items (10 minutes, Q4). */
export const MAX_CRITICAL_SNOOZE_MS = 10 * 60 * 1000;
export const GROUP_SIMILAR_THRESHOLD = 4;

export function attentionAckStorageKey(userId: number = 0): string {
  return `cc:attention:ack:${userId}`;
}

export function currentDayKey(nowMs: number): string {
  return new Date(nowMs).toISOString().slice(0, 10);
}

export function readAttentionAckStore(userId: number, nowMs: number): Record<string, AttentionAckEntry> {
  const dayKey = currentDayKey(nowMs);
  try {
    const raw = localStorage.getItem(attentionAckStorageKey(userId));
    if (!raw) return {};
    const parsed = JSON.parse(raw) as AttentionAckStore;
    if (!parsed || parsed.dayKey !== dayKey || typeof parsed.entries !== 'object') {
      return {};
    }
    return parsed.entries;
  } catch {
    return {};
  }
}

export function writeAttentionAckStore(
  userId: number,
  nowMs: number,
  entries: Record<string, AttentionAckEntry>,
): void {
  const payload: AttentionAckStore = {
    dayKey: currentDayKey(nowMs),
    entries,
  };
  try {
    localStorage.setItem(attentionAckStorageKey(userId), JSON.stringify(payload));
  } catch {
    /* ignore quota errors */
  }
}

export function itemMetricValue(item: AttentionItem): number {
  if (item.valueSec !== undefined) return item.valueSec;
  if (item.valuePct !== undefined) return item.valuePct;
  if (item.count !== undefined) return item.count;
  return 0;
}

export function hasWorsenedSinceAck(item: AttentionItem, ack: AttentionAckEntry): boolean {
  const current = itemMetricValue(item);
  switch (item.kind) {
    case 'pause_over':
    case 'wrapup_over':
    case 'long_talk':
      return current - ack.valueAtAck >= ACK_PAUSE_WORSEN_STEP_SEC;
    case 'queue_wait':
      return current - ack.valueAtAck >= ACK_WAIT_WORSEN_STEP_SEC;
    case 'queue_sla':
      return ack.valueAtAck - current >= ACK_SLA_WORSEN_STEP_PCT;
    case 'agents_low':
      return current < ack.valueAtAck;
    default:
      return false;
  }
}

export function isItemSuppressed(
  item: AttentionItem,
  entries: Record<string, AttentionAckEntry>,
  nowMs: number,
): boolean {
  const entry = entries[item.id];
  if (!entry) return false;
  if (entry.snoozeUntil !== null) {
    return nowMs < entry.snoozeUntil;
  }
  return !hasWorsenedSinceAck(item, entry);
}

export function createAckEntry(item: AttentionItem): AttentionAckEntry {
  return {
    id: item.id,
    valueAtAck: itemMetricValue(item),
    snoozeUntil: null,
  };
}

export function createSnoozeEntry(
  item: AttentionItem,
  nowMs: number,
  durationMs: number = MAX_CRITICAL_SNOOZE_MS,
): AttentionAckEntry {
  const clamped =
    item.severity === 'critical'
      ? Math.min(durationMs, MAX_CRITICAL_SNOOZE_MS)
      : durationMs;
  return {
    id: item.id,
    valueAtAck: itemMetricValue(item),
    snoozeUntil: nowMs + Math.max(1000, clamped),
  };
}

export interface GroupedAttentionRow {
  type: 'single' | 'group';
  id: string;
  kind: AttentionKind;
  severity: AttentionSeverity;
  item?: AttentionItem;
  items: AttentionItem[];
}

/**
 * Collapses >= GROUP_SIMILAR_THRESHOLD agent-level items of the same kind into a single expandable group row (U1.6).
 */
export function groupAttentionItems(
  items: readonly AttentionItem[],
  expandedGroups: ReadonlySet<AttentionKind>,
): GroupedAttentionRow[] {
  const groupableKinds = new Set<AttentionKind>(['pause_over', 'wrapup_over', 'queues_detached', 'long_talk']);
  const byKind = new Map<AttentionKind, AttentionItem[]>();
  for (const item of items) {
    if (!groupableKinds.has(item.kind)) continue;
    const list = byKind.get(item.kind) ?? [];
    list.push(item);
    byKind.set(item.kind, list);
  }

  const emittedGroup = new Set<AttentionKind>();
  const rows: GroupedAttentionRow[] = [];

  for (const item of items) {
    const bucket = byKind.get(item.kind);
    if (
      bucket
      && bucket.length >= GROUP_SIMILAR_THRESHOLD
      && !expandedGroups.has(item.kind)
    ) {
      if (emittedGroup.has(item.kind)) continue;
      emittedGroup.add(item.kind);
      const hasCritical = bucket.some((i) => i.severity === 'critical');
      rows.push({
        type: 'group',
        id: `group:${item.kind}`,
        kind: item.kind,
        severity: hasCritical ? 'critical' : 'warning',
        items: bucket,
      });
    } else {
      rows.push({
        type: 'single',
        id: item.id,
        kind: item.kind,
        severity: item.severity,
        item,
        items: [item],
      });
    }
  }

  return rows;
}
