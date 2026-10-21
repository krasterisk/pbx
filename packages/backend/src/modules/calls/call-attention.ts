import {
  normalizeCallNumber,
  type CallAttentionCase,
  type CallsAttention,
} from '@krasterisk/shared';

/** Input rows have already passed the viewer's tenant and participant ACL. */
export interface ContactFact {
  call_key: string;
  started_at: number | string;
  ended_at: number | string | null;
  direction: string;
  origin: string;
  outcome: string;
  caller_number: string;
  recipient_number: string;
  company_number: string;
}
const number = (value: string) => {
  const normalized = normalizeCallNumber(value || '');
  return /^\d{11,15}$/.test(normalized) ? normalized : null;
};
const iso = (at: number) => new Date(at).toISOString();
const ended = (row: ContactFact) =>
  Math.max(Number(row.started_at), Number(row.ended_at || row.started_at));
const key = (row: ContactFact) => {
  const phone = number(
    row.direction === 'out' ? row.recipient_number : row.caller_number,
  );
  const company = number(row.company_number);
  return phone && company ? `${phone}:${company}` : null;
};

/** Probable telephone links, never a claim that a customer issue was resolved. */
export function matchCallAttention(
  sources: readonly ContactFact[],
  candidates: readonly ContactFact[],
  snapshotAt: number,
  complete: boolean,
  windowHours = 24,
): Pick<CallsAttention, 'rows' | 'totals'> {
  const byNumber = new Map<string, ContactFact[]>();
  for (const row of candidates) {
    if (
      row.origin === 'autodial' ||
      !['in', 'out'].includes(row.direction) ||
      Number(row.started_at) > snapshotAt
    )
      continue;
    const identity = key(row);
    if (identity) {
      const rows = byNumber.get(identity) || [];
      rows.push(row);
      byNumber.set(identity, rows);
    }
  }
  for (const rows of byNumber.values())
    rows.sort(
      (a, b) =>
        Number(a.started_at) - Number(b.started_at) ||
        a.call_key.localeCompare(b.call_key),
    );
  const rows: CallAttentionCase[] = [];
  const current = new Map<string, CallAttentionCase>();
  for (const row of [...sources].sort(
    (a, b) =>
      Number(a.started_at) - Number(b.started_at) ||
      a.call_key.localeCompare(b.call_key),
  )) {
    const identity = key(row);
    const previous = identity ? current.get(identity) : null;
    const start = Number(row.started_at);
    const end = ended(row);
    if (
      previous &&
      start < Date.parse(previous.deadline) &&
      (!previous.contact || end <= Date.parse(previous.contact.at))
    ) {
      previous.sourceCalls++;
      previous.lastCallId = row.call_key;
      previous.lastAt = iso(Math.max(Date.parse(previous.lastAt), end));
      continue;
    }
    const deadline = end + windowHours * 3600000;
    const possible = identity
      ? (byNumber.get(identity) || []).filter(
          (c) =>
            c.call_key !== row.call_key &&
            Number(c.started_at) >= end &&
            Number(c.started_at) < deadline,
        )
      : [];
    const contact = possible.find((c) => c.outcome === 'human');
    const attempt = possible.find((c) => c.direction === 'out');
    const reason = !number(row.caller_number)
      ? 'missingNumber'
      : !number(row.company_number)
        ? 'missingCompany'
        : !complete
          ? 'incompleteHistory'
          : 'sameNumberAndCompany';
    const item: CallAttentionCase = {
      id: row.call_key,
      firstCallId: row.call_key,
      lastCallId: row.call_key,
      sourceCalls: 1,
      number: number(row.caller_number),
      companyNumber: number(row.company_number),
      firstAt: iso(start),
      lastAt: iso(end),
      deadline: iso(deadline),
      state: contact
        ? contact.direction === 'in'
          ? 'customerReturned'
          : 'outboundConnected'
        : !identity || !complete
          ? 'unknown'
          : snapshotAt >= deadline
            ? 'overdue'
            : 'waiting',
      reason,
      attempt: attempt
        ? { callId: attempt.call_key, at: iso(Number(attempt.started_at)) }
        : null,
      contact: contact
        ? { callId: contact.call_key, at: iso(Number(contact.started_at)) }
        : null,
    };
    rows.push(item);
    if (identity) current.set(identity, item);
  }
  const totals: CallsAttention['totals'] = {
    sourceCalls: sources.length,
    groups: rows.length,
    waiting: 0,
    overdue: 0,
    outboundConnected: 0,
    customerReturned: 0,
    unknown: 0,
    attempted: 0,
  };
  for (const row of rows) {
    totals[row.state]++;
    if (row.attempt) totals.attempted++;
  }
  return {
    rows: rows.sort((a, b) => Date.parse(b.firstAt) - Date.parse(a.firstAt)),
    totals,
  };
}
