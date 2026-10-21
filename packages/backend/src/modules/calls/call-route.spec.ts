import { buildCallRoute } from './call-route';
import type { CallJourneyStep, CallParty } from '@krasterisk/shared';
const employee = (id: string): CallParty => ({
  id,
  number: id,
  kind: 'employee',
  name: null,
  department: null,
});
const step = (
  id: string,
  kind: CallJourneyStep['kind'],
  second: number,
  patch: Partial<CallJourneyStep> = {},
): CallJourneyStep => ({
  id,
  kind,
  at: new Date(Date.UTC(2026, 9, 18, 0, 0, second)).toISOString(),
  until: null,
  actor: null,
  target: null,
  result: null,
  evidence: 'cdr',
  ...patch,
});
describe('human call route', () => {
  it('groups overlapping attempts without claiming proven parallel ringing or dropping recipients', () => {
    const route = buildCallRoute([
      step('start', 'received', 0),
      step('a', 'attempt', 1, {
        until: step('', 'ended', 10).at,
        target: employee('101'),
        result: 'noAnswer',
      }),
      step('b', 'attempt', 2, { target: employee('102'), result: 'answered' }),
      step('end', 'ended', 20),
    ]);
    expect(route.nodes.map((n) => n.kind)).toEqual([
      'received',
      'attempts',
      'ended',
    ]);
    expect(route.nodes[1]).toMatchObject({
      possibleParallel: true,
      steps: [{ target: { id: '101' } }, { target: { id: '102' } }],
    });
    expect(route.coverage).toBe('partial');
  });
  it('requires a matching CEL conversation before the next transfer to confirm a handoff', () => {
    const transfer = step('t', 'transfer', 5, {
      evidence: 'cel',
      actor: employee('101'),
      target: employee('102'),
    });
    const conversation = step('c', 'conversation', 7, {
      evidence: 'cel',
      target: employee('102'),
    });
    expect(
      buildCallRoute([transfer, conversation]).nodes[0].steps[0].result,
    ).toBe('answered');
    expect(
      buildCallRoute([transfer, { ...conversation, evidence: 'cdr' }]).nodes[0]
        .steps[0].result,
    ).toBeNull();
    expect(
      buildCallRoute([
        transfer,
        step('other', 'transfer', 6, { target: employee('103') }),
        conversation,
      ]).nodes[0].steps[0].result,
    ).toBeNull();
    expect(transfer.result).toBeNull();
  });
  it('does not confirm an earlier transfer using a conversation after another transfer at the same timestamp', () => {
    const route = buildCallRoute([
      step('a', 'transfer', 5, { evidence: 'cel', target: employee('102') }),
      step('b', 'transfer', 5, { evidence: 'cel', target: employee('103') }),
      step('c', 'conversation', 6, {
        evidence: 'cel',
        target: employee('102'),
      }),
    ]);
    expect(route.nodes[0].steps[0].result).toBeNull();
    expect(route.nodes[1].steps[0].result).toBeNull();
  });
});
