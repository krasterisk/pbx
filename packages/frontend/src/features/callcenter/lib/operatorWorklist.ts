import type { ICall } from '../model/types/callCenterSchema';
import type {
  IMissedCall,
  IMissedCallGroup,
} from '@/shared/api/endpoints/callCenterApi';
import type { ICallbackRequest } from '@/shared/api/endpoints/callbackRequestsApi';

const time = (value: string | null | undefined) => {
  const parsed = Date.parse(value || '');
  return Number.isFinite(parsed) ? parsed : 0;
};
const positivePosition = (call: ICall) =>
  Number.isFinite(call.position) && (call.position ?? 0) > 0;
const chronological = (a: ICall, b: ICall) =>
  time(a.enterTime) - time(b.enterTime) || a.uniqueid.localeCompare(b.uniqueid);
export interface CurrentCallRow {
  call: ICall;
  position: number | null;
}

/** Sort each FIFO first, then merge queue heads. A pairwise queue-specific comparator is not transitive. */
export function currentCallRows(
  calls: ICall[],
  queues: readonly string[],
): CurrentCallRow[] {
  const scoped = calls.filter(
    (call) =>
      queues.includes(call.queue) &&
      ['WAITING', 'RINGING', 'TALKING', 'HOLD'].includes(call.status),
  );
  const talking = scoped
    .filter((call) => call.status === 'TALKING' || call.status === 'HOLD')
    .sort(
      (a, b) =>
        time(a.answerTime || a.enterTime) - time(b.answerTime || b.enterTime) ||
        a.uniqueid.localeCompare(b.uniqueid),
    )
    .map((call) => ({ call, position: null }));
  const grouped = new Map<string, ICall[]>();
  scoped
    .filter((call) => call.status === 'WAITING' || call.status === 'RINGING')
    .forEach((call) => {
      const group = grouped.get(call.queue) || [];
      group.push(call);
      grouped.set(call.queue, group);
    });
  const fifos = [...grouped.values()].map((group) =>
    group
      .slice()
      .sort(chronological)
      .map((call, index) => ({
        call,
        position: positivePosition(call) ? call.position! : index + 1,
      }))
      .sort((a, b) => a.position - b.position || chronological(a.call, b.call)),
  );
  const waiting: CurrentCallRow[] = [];
  while (fifos.some((group) => group.length)) {
    const heads = fifos
      .filter((group) => group.length)
      .sort((a, b) => chronological(a[0].call, b[0].call));
    waiting.push(heads[0].shift()!);
  }
  return [...talking, ...waiting];
}

export type WorkItemStatus =
  | 'missed'
  | 'claimed'
  | 'clientReturned'
  | 'callbackDone'
  | 'pending'
  | 'failed'
  | 'canceled';
export interface OperatorWorkItem {
  id: string;
  source: 'missed' | 'callback';
  phone: string;
  name: string;
  queue: string;
  at: string;
  status: WorkItemStatus;
  resolved: boolean;
  attempts: number;
  personal?: boolean;
  claimedBy?: number | null;
  callback?: ICallbackRequest;
  history: IMissedCall[];
}
const missedKey = (phone: string, personal: boolean) =>
  `${phone.replace(/\D/g, '') || phone}|${personal ? 1 : 0}`;

/** The newest open attempt wins over an older resolution; never infer handled from a claim alone. */
export function operatorWorkItems(
  raw: IMissedCall[],
  active: IMissedCallGroup[],
  callbacks: ICallbackRequest[],
  completed: ICallbackRequest[],
): OperatorWorkItem[] {
  const groups = new Map<string, IMissedCall[]>();
  for (const row of raw) {
    const key = missedKey(row.caller_id_num, Boolean(row.personal));
    const group = groups.get(key) || [];
    group.push(row);
    groups.set(key, group);
  }
  const items = new Map<string, OperatorWorkItem>();
  groups.forEach((rows, key) => {
    const history = rows
      .slice()
      .sort((a, b) => time(b.created_at) - time(a.created_at) || b.uid - a.uid);
    const latest = history[0];
    const resolved = Boolean(latest.called_back || latest.client_called_back);
    items.set(key, {
      id: `missed:${key}`,
      source: 'missed',
      phone: latest.caller_id_num,
      name: latest.caller_id_name,
      queue: latest.queue_name,
      at: latest.created_at,
      personal: Boolean(latest.personal),
      claimedBy: latest.called_back_by,
      status: latest.client_called_back
        ? 'clientReturned'
        : latest.called_back
          ? 'callbackDone'
          : latest.called_back_by
            ? 'claimed'
            : 'missed',
      resolved,
      attempts: history.length,
      history,
    });
  });
  for (const row of active) {
    const key = missedKey(row.callerIdNum, row.personal);
    const existing = items.get(key);
    // A stale active query must not resurrect a newer answered/self-returned attempt.
    if (existing?.resolved && time(existing.at) >= time(row.lastAttemptAt))
      continue;
    items.set(key, {
      id: `missed:${key}`,
      source: 'missed',
      phone: row.callerIdNum,
      name: row.callerIdName,
      queue: row.queueName || existing?.queue || '',
      at: row.lastAttemptAt,
      personal: row.personal,
      claimedBy: row.claimedBy,
      status: row.claimedBy ? 'claimed' : 'missed',
      resolved: false,
      attempts: Math.max(row.attemptCount, existing?.history.length || 0),
      history: existing?.history || [],
    });
  }
  const requests = new Map<number, ICallbackRequest>();
  callbacks.forEach((row) => requests.set(row.id, row));
  completed.forEach((row) => requests.set(row.id, row));
  for (const row of requests.values()) {
    const resolved = ['completed', 'cancelled', 'expired'].includes(row.status);
    const status: WorkItemStatus =
      row.status === 'completed'
        ? 'callbackDone'
        : row.status === 'cancelled'
          ? 'canceled'
          : ['failed', 'expired'].includes(row.status)
            ? 'failed'
            : row.status === 'dialing' || row.claimed_agent
              ? 'claimed'
              : 'pending';
    items.set(`callback:${row.id}`, {
      id: `callback:${row.id}`,
      source: 'callback',
      phone: row.caller,
      name: '',
      queue: row.queue_label || '',
      at: row.next_attempt_at || row.created_at,
      status,
      resolved,
      attempts: row.attempt_count,
      callback: row,
      history: [],
    });
  }
  return [...items.values()].sort(
    (a, b) =>
      Number(a.resolved) - Number(b.resolved) ||
      time(b.at) - time(a.at) ||
      a.id.localeCompare(b.id),
  );
}
