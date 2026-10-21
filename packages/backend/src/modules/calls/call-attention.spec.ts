import { matchCallAttention, type ContactFact } from './call-attention';
const base = Date.parse('2026-10-18T00:00:00Z');
const row = (
  id: string,
  hour: number,
  patch: Partial<ContactFact> = {},
): ContactFact => ({
  call_key: id,
  started_at: base + hour * 3600000,
  ended_at: base + hour * 3600000 + 1000,
  direction: 'in',
  origin: 'telephony',
  outcome: 'missed',
  caller_number: '79135551122',
  recipient_number: '101',
  company_number: '74951234567',
  ...patch,
});
describe('probable return contacts', () => {
  it('groups repeated misses once and separates an unsuccessful attempt from a connection', () => {
    const sources = [row('m1', 0), row('m2', 1)];
    const candidates = [
      ...sources,
      row('attempt', 2, {
        direction: 'out',
        recipient_number: '89135551122',
        outcome: 'missed',
      }),
      row('connected', 3, {
        direction: 'out',
        recipient_number: '79135551122',
        outcome: 'human',
      }),
    ];
    const result = matchCallAttention(
      sources,
      candidates,
      base + 25 * 3600000,
      true,
    );
    expect(result.totals).toMatchObject({
      sourceCalls: 2,
      groups: 1,
      outboundConnected: 1,
      attempted: 1,
      overdue: 0,
    });
    expect(result.rows[0]).toMatchObject({
      sourceCalls: 2,
      attempt: { callId: 'attempt' },
      contact: { callId: 'connected' },
    });
  });
  it('distinguishes the customer returning, and does not reuse the contact for a later miss', () => {
    const sources = [row('m1', 0), row('m2', 4)];
    const result = matchCallAttention(
      sources,
      [...sources, row('returned', 3, { outcome: 'human' })],
      base + 30 * 3600000,
      true,
    );
    expect(result.totals).toMatchObject({
      groups: 2,
      customerReturned: 1,
      overdue: 1,
    });
  });
  it('does not close cases using a different company number, robot, autodial or simultaneous connection', () => {
    const source = row('missed', 1);
    const candidates = [
      row('otherCompany', 2, {
        outcome: 'human',
        company_number: '74957654321',
      }),
      row('robot', 2, { outcome: 'robot' }),
      row('auto', 2, { origin: 'autodial', outcome: 'human' }),
      row('concurrent', 1, { outcome: 'human' }),
    ];
    expect(
      matchCallAttention([source], candidates, base + 30 * 3600000, true)
        .rows[0].state,
    ).toBe('overdue');
  });
  it('shows waiting before24h, overdue at the deadline, and ignores contact exactly outside the half-open window', () => {
    const source = row('m', 0),
      deadline = base + 1000 + 24 * 3600000;
    const contacts = [
      row('late', 24, { started_at: deadline, outcome: 'human' }),
    ];
    expect(
      matchCallAttention([source], contacts, deadline - 1, true).rows[0].state,
    ).toBe('waiting');
    expect(
      matchCallAttention([source], contacts, deadline, true).rows[0].state,
    ).toBe('overdue');
  });
  it('leaves hidden/short numbers, missing company and incomplete history unknown', () => {
    for (const source of [
      row('anonymous', 0, { caller_number: '' }),
      row('short', 0, { caller_number: '101' }),
      row('noCompany', 0, { company_number: '' }),
    ]) {
      expect(
        matchCallAttention([source], [], base + 30 * 3600000, true).rows[0]
          .state,
      ).toBe('unknown');
    }
    expect(
      matchCallAttention([row('m', 0)], [], base + 30 * 3600000, false).rows[0],
    ).toMatchObject({ state: 'unknown', reason: 'incompleteHistory' });
  });
  it('does not use future contacts and does not merge separate24h episodes', () => {
    const sources = [row('old', 0), row('new', 25)];
    const result = matchCallAttention(
      sources,
      [row('future', 30, { outcome: 'human' })],
      base + 26 * 3600000,
      true,
    );
    expect(result.totals).toMatchObject({
      groups: 2,
      waiting: 1,
      overdue: 1,
      customerReturned: 0,
    });
  });
});
