import { callIntervalSeconds, normalizeCallNumber, summarizeCalls } from '@krasterisk/shared';
import { classifyCall } from './call-record';
import type { DashboardLeg } from './call-classifier';
const leg = (patch: Partial<DashboardLeg> = {}): DashboardLeg => ({
  id: 1,
  uniqueid: 'root',
  linkedid: 'root',
  calldate: '2026-10-18 10:00:00',
  channel: 'PJSIP/t_main_42-a',
  dstchannel: 'PJSIP/e201_42-b',
  src: '79135551122',
  usrc: '79135551122',
  dst: '201',
  dialednum: '73912223344',
  dcontext: 'sip-in42',
  lastapp: 'Dial',
  disposition: 'ANSWERED',
  duration: 40,
  billsec: 30,
  ...patch,
});
describe('one logical call and trustworthy metrics', () => {
  it('counts outgoing separately from incoming, internal and unclassified external directions', () => {
    const call = classifyCall(42, 'node', [leg()], { complete: true });
    const summary = summarizeCalls([
      call,
      { ...call, direction: 'out' },
      { ...call, direction: 'out', outcome: 'missed' },
      { ...call, direction: 'internal' },
      { ...call, direction: 'external' },
    ]);
    expect(summary).toMatchObject({ total: 5, incoming: 1, outgoing: 2, incomingHuman: 1 });
  });
  it('unions overlapping conversations, preserves the whole elapsed duration and counts once', () => {
    const call = classifyCall(
      42,
      'node',
      [
        leg(),
        leg({ id: 2, uniqueid: 'second', calldate: '2026-10-18 10:00:20', dstchannel: 'PJSIP/e202_42-c' }),
      ],
      { complete: true },
    );
    expect(call).toMatchObject({ outcome: 'human', durationSec: 60, connectedSec: 50, waitSec: 10 });
    expect(call.journey[0].kind).toBe('received');
    expect(call.journey[call.journey.length - 1].kind).toBe('ended');
    expect(summarizeCalls([call])).toMatchObject({
      total: 1,
      incoming: 1,
      human: 1,
      incomingHuman: 1,
      avgConnectedSec: 50,
      estimatedConnectedSample: 1,
    });
  });
  it('never substitutes total duration for a zero or unavailable conversation', () => {
    const call = classifyCall(42, 'node', [leg({ disposition: 'NO ANSWER', billsec: 0 })], {
      complete: true,
    });
    expect(call).toMatchObject({ outcome: 'missed', connectedSec: null, waitSec: null });
    expect(summarizeCalls([call]).avgConnectedSec).toBeNull();
  });
  it('keeps a known unanswered internal destination without inventing a conversation', () => {
    const call = classifyCall(42, 'node', [leg({
      channel: 'PJSIP/ew202_42-a', src: '202', usrc: '202',
      disposition: 'NO ANSWER', billsec: 0, duration: 23,
    })], { complete: true });
    expect(call).toMatchObject({
      direction: 'internal', outcome: 'missed', durationSec: 23,
      recipient: { kind: 'employee', number: '201' }, connectedSec: null, waitSec: null,
    });
    expect(call.journey.some(step => step.kind === 'conversation')).toBe(false);
  });
  it('does not choose an arbitrary recipient from unanswered forks or retained terminal channels', () => {
    const missed = leg({ disposition: 'NO ANSWER', billsec: 0 });
    expect(classifyCall(42, 'node', [missed, {
      ...missed, id: 2, uniqueid: 'fork', dstchannel: 'PJSIP/e202_42-c',
    }], { complete: true }).recipient.kind).toBe('unknown');
    expect(classifyCall(42, 'node', [leg({ lastapp: 'Hangup' })], {
      complete: true,
    }).recipient.kind).toBe('unknown');
  });
  it('preserves the external destination for an unanswered outgoing call', () => {
    const call = classifyCall(42, 'node', [leg({
      channel: 'PJSIP/e201_42-a', dstchannel: 'PJSIP/t_main_42-b',
      src: '201', usrc: '201', dst: '79135551122', dcontext: 'out42',
      disposition: 'NO ANSWER', billsec: 0,
    })], { complete: true });
    expect(call).toMatchObject({ direction: 'out', recipient: { kind: 'external', number: '79135551122' } });
  });
  it('distinguishes saved voicemail from merely entering the voicemail application', () => {
    const legs = [leg({ lastapp: 'VoiceMail', dstchannel: '' })];
    expect(classifyCall(42, 'node', legs, { complete: true }).outcome).toBe('missed');
    expect(classifyCall(42, 'node', legs, { complete: true }, 'UTC', [], { voicemail: true })).toMatchObject({
      outcome: 'voicemail',
      hasVoicemail: true,
      businessOutcome: 'unknown',
    });
  });
  it('does not infer a human answer from IVR or a terminal retained channel', () => {
    expect(classifyCall(42, 'node', [leg({ lastapp: 'Playback' })], { complete: true }).outcome).toBe('menu');
    expect(classifyCall(42, 'node', [leg({ lastapp: 'Hangup' })], { complete: true }).outcome).toBe(
      'unknown',
    );
  });
  it('retains multiple robot kinds and autodial through a human handoff', () => {
    expect(
      classifyCall(42, 'node', [leg()], { complete: true, aiWorked: true, autodial: true }, 'UTC', [], {
        voiceRobot: true,
        aiRobot: true,
      }),
    ).toMatchObject({
      outcome: 'human',
      origin: 'autodial',
      handling: expect.arrayContaining(['employee', 'voiceRobot', 'aiRobot']),
      businessOutcome: 'unknown',
    });
  });
  it('keeps answered-without-robot-playback unknown', () => {
    expect(
      classifyCall(42, 'node', [leg({ lastapp: 'Stasis', dstchannel: '' })], {
        complete: true,
        aiPresent: true,
      }).outcome,
    ).toBe('unknown');
  });
  it('uses all incoming completed calls in the acceptance denominator and exposes unknown coverage', () => {
    const human = classifyCall(42, 'node', [leg()], { complete: true });
    const unknown = classifyCall(42, 'node', [leg({ lastapp: 'Hangup' })], { complete: true });
    const missed = classifyCall(42, 'node', [leg({ disposition: 'NO ANSWER' })], { complete: true });
    const active = classifyCall(42, 'node', [leg()], { active: true });
    expect(summarizeCalls([human, unknown, missed, active])).toMatchObject({
      total: 4,
      acceptedPercent: 33,
      classifiedPercent: 67,
      incomingMissed: 1,
    });
  });
  it('accepts a child channel CEL uniqueid only on an owned channel and keeps the original caller', () => {
    const events = [
      {
        id: 1,
        uniqueid: 'employee-child-not-a-cdr-row',
        linkedid: 'root',
        channame: 'PJSIP/e201_42-b',
        eventtype: 'BLINDTRANSFER',
        eventtime: '2026-10-18 10:00:20',
        extra: '{"extension":"202"}',
      },
      {
        id: 2,
        uniqueid: 'foreign',
        linkedid: 'root',
        channame: 'PJSIP/e999_43-c',
        eventtype: 'BLINDTRANSFER',
        eventtime: '2026-10-18 10:00:21',
        extra: '{"extension":"999"}',
      },
    ];
    const call = classifyCall(42, 'node', [leg()], { complete: true }, 'UTC', events);
    expect(call.journey.filter((step) => step.kind === 'transfer')).toHaveLength(1);
    expect(call.journey.find((step) => step.kind === 'transfer')).toMatchObject({
      actor: { number: '201' },
      target: { number: '202' },
    });
    expect(call.caller.number).toBe('79135551122');
    expect(call.historyComplete).toBe(false);
  });
  it('separates tenant/node identities and uses explicit source timezone', () => {
    expect(classifyCall(42, 'node', [leg()], {}, 'Asia/Krasnoyarsk').startedAt).toBe(
      '2026-10-18T03:00:00.000Z',
    );
    expect(classifyCall(42, 'node', [leg()]).id).not.toBe(classifyCall(43, 'node', [leg()]).id);
  });
  it('normalizes numbers without reclassifying internal or international numbers', () => {
    expect(normalizeCallNumber('8 (913) 555-11-22')).toBe('79135551122');
    expect(normalizeCallNumber('+44 20 1234 5678')).toBe('442012345678');
    expect(normalizeCallNumber('201')).toBe('201');
    expect(
      callIntervalSeconds([
        [0, 30000],
        [10000, 40000],
        [50000, 60000],
      ]),
    ).toBe(50);
  });
  it('does not report IVR or robot billsec as a human conversation', () => {
    expect(
      classifyCall(42, 'node', [leg()], { complete: true, technicalApplication: 'ivr' }).connectedSec,
    ).toBeNull();
    expect(classifyCall(42, 'node', [leg()], { complete: true, aiPresent: true }).connectedSec).toBeNull();
  });
  it('measures only closed customer/employee bridge overlaps and excludes consultations', () => {
    const events = [
      {
        id: 1,
        uniqueid: 'root',
        linkedid: 'root',
        channame: 'PJSIP/e201_42-b',
        peer: 'PJSIP/t_main_42-a',
        eventtype: 'BRIDGE_ENTER',
        eventtime: '2026-10-18 10:00:10',
        extra: '{"bridge_id":"customer"}',
      },
      {
        id: 2,
        uniqueid: 'root',
        linkedid: 'root',
        channame: 'PJSIP/e201_42-b',
        eventtype: 'BRIDGE_EXIT',
        eventtime: '2026-10-18 10:00:30',
        extra: '{"bridge_id":"customer"}',
      },
    ];
    expect(
      classifyCall(42, 'node', [leg()], { complete: true, technicalApplication: 'ivr' }, 'UTC', events),
    ).toMatchObject({ connectedSec: 20, waitSec: 10, timingSource: 'cel' });
    expect(
      classifyCall(42, 'node', [leg()], { complete: true }, 'UTC', events.slice(0, 1)).connectedSec,
    ).toBeNull();
  });
});
