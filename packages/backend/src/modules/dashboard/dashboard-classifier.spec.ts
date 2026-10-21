import { classifyDashboardCall, participantTokens, parseDashboardTimestamp, scopeAllows, type DashboardLeg } from './dashboard-classifier';
const leg = (change: Partial<DashboardLeg> = {}): DashboardLeg => ({ id: 1, uniqueid: '1.1', linkedid: 'root', calldate: '2026-10-11 10:00:00', channel: 'PJSIP/t_provider_42-0001', dstchannel: 'PJSIP/e101_42-0002', src: '79000000000', usrc: '79000000000', dst: '101', dialednum: '74950000000', dcontext: 'sip-in42', lastapp: 'Dial', disposition: 'ANSWERED', duration: 30, billsec: 20, ...change });
describe('PBX logical call semantics', () => {
  it('counts ring-all and transfers once and retains a successful human answer after an error', () => {
    const result = classifyDashboardCall(42, 'node', [leg(), leg({ id: 2, uniqueid: '1.2', calldate: '2026-10-11 10:00:20', dst: '102', dstchannel: 'PJSIP/e102_42-0003', duration: 30, disposition: 'BUSY' })], { complete: true });
    expect(result).toMatchObject({ direction: 'in', outcome: 'accepted', duration: 50 });
    expect(result.participants).toEqual(expect.arrayContaining([{ kind: 'extension', value: '101' }, { kind: 'extension', value: '102' }]));
  });
  it.each(['Playback', 'Background', 'VoiceMail'])('does not count %s as a human answer', (lastapp) => {
    expect(classifyDashboardCall(42, 'node', [leg({ lastapp, dstchannel: '', billsec: 20 })], { complete: true }).outcome).toBe('missed');
  });
  it('keeps insufficient historical ANSWERED evidence unknown', () => {
    expect(classifyDashboardCall(42, 'node', [leg({ dstchannel: 'Local/ai-0001;2', lastapp: 'Stasis' })], { aiPresent: true, complete: true }).outcome).toBe('unknown');
    expect(classifyDashboardCall(42, 'node', [leg({ dstchannel: '', lastapp: 'Queue' })], { complete: true }).outcome).toBe('unknown');
  });
  it('keeps legacy AI with an answered greeting and no playback proof unknown', () => {
    expect(classifyDashboardCall(42, 'node', [leg({ dstchannel: '', lastapp: 'Playback' })], { aiPresent: true, complete: true })).toMatchObject({ outcome: 'unknown', origin: 'ai', reason: 'aiPlaybackUnconfirmed' });
  });
  it('counts working AI followed by a failed transfer as accepted', () => {
    expect(classifyDashboardCall(42, 'node', [leg({ dstchannel: '', disposition: 'FAILED' })], { aiWorked: true, aiPresent: true, complete: true })).toMatchObject({ outcome: 'accepted', origin: 'ai' });
  });
  it('distinguishes no answer, busy and error', () => {
    for (const [disposition, reason] of [['NO ANSWER', 'noAnswer'], ['BUSY', 'busy'], ['FAILED', 'error']]) expect(classifyDashboardCall(42, 'node', [leg({ disposition, dstchannel: '' })], { complete: true })).toMatchObject({ outcome: 'missed', reason });
  });
  it('counts internal, outbound and autodial paths', () => {
    expect(classifyDashboardCall(42, 'node', [leg({ channel: 'PJSIP/e100_42-01', dstchannel: 'PJSIP/ew101_42-02', dcontext: '', dialednum: '', usrc: '100', src: '100' })]).direction).toBe('internal');
    expect(classifyDashboardCall(42, 'node', [leg({ channel: 'PJSIP/e100_42-01', dstchannel: 'PJSIP/t_provider_42-02', dcontext: 'sip-out42', dialednum: '', userfield: 'autodial' })])).toMatchObject({ direction: 'out', origin: 'autodial' });
  });
  it('keeps a WebRTC-to-desk call internal when both endpoints share sip-out0', () => {
    const native: DashboardLeg = {uniqueid:'1792554194.10',linkedid:'1792554194.10',calldate:'2026-10-21 06:43:14',
      channel:'PJSIP/ew202_0-00000007',dstchannel:'PJSIP/e201_0-00000008',dcontext:'sip-out0',src:'202',dst:'201',
      disposition:'ANSWERED',lastapp:'Dial',duration:21,billsec:10};
    expect(classifyDashboardCall(0,'node',[native],{complete:true},'Europe/Moscow'))
      .toMatchObject({direction:'internal',outcome:'accepted',startedAt:'2026-10-21T03:43:14.000Z',endedAt:'2026-10-21T03:43:35.000Z'});
  });
  it('uses uniqueid when linkedid is empty and separates tenant and node', () => {
    const first = classifyDashboardCall(42, 'node', [leg({ linkedid: '' })]);
    const ids = [first.id, classifyDashboardCall(42, 'node', [leg({ linkedid: '', uniqueid: '1.2' })]).id, classifyDashboardCall(43, 'node', [leg({ linkedid: '' })]).id, classifyDashboardCall(42, 'other', [leg({ linkedid: '' })]).id];
    expect(new Set(ids).size).toBe(4);
  });
  it('keeps the entire transferred call visible once for overlapping scope', () => {
    const tokens = participantTokens([leg(), leg({ uniqueid: '1.2', channel: 'PJSIP/ew102_42-3', lastapp: 'Queue', lastdata: 'q700_42,t' })], 42);
    expect(scopeAllows(tokens, { operators: ['101', '102'], queues: ['700'], ownExten: '102' })).toBe(true);
    expect(scopeAllows(tokens, { operators: ['999'], queues: ['999'], ownExten: null })).toBe(false);
    expect(tokens.filter((p) => p.kind === 'extension' && p.value === '101')).toHaveLength(1);
  });
  it('does not grant employee scope through a caller ID or dialed number', () => {
    const tokens = participantTokens([leg({ channel: 'PJSIP/t_incoming_42-1', dstchannel: '', usrc: '999', dst: '999', dialednum: '999' })], 42);
    expect(scopeAllows(tokens, { operators: ['999'], queues: [], ownExten: '999' })).toBe(false);
    expect(participantTokens([leg({ channel: 'SIP/201-00001', dstchannel: '' })], 42)).toContainEqual({ kind: 'extension', value: '201' });
  });
  it('rejects malformed dates and interprets legacy CDR using explicit PBX timezone', () => {
    expect(new Date(parseDashboardTimestamp('2026-10-11 10:00:00', 'Asia/Krasnoyarsk')).toISOString()).toBe('2026-10-11T03:00:00.000Z');
    expect(parseDashboardTimestamp('2026-02-30 10:00:00')).toBeNaN();
    expect(() => classifyDashboardCall(42, 'node', [leg({ calldate: '' })])).toThrow('Invalid CDR');
  });
  it('uses the origin leg and does not turn a populated outgoing dialed number into an incoming call', () => {
    const original = leg({ uniqueid: 'root', id: 2, dcontext: 'sip-in42' });
    const transfer = leg({ uniqueid: 'transfer', id: 1, channel: 'PJSIP/e101_42-3', dcontext: 'sip-out42', dstchannel: 'PJSIP/t_trunk_42-4' });
    expect(classifyDashboardCall(42, 'node', [transfer, original]).direction).toBe('in');
    expect(classifyDashboardCall(42, 'node', [leg({ uniqueid: 'root', dcontext: 'sip-out42', channel: 'PJSIP/e101_42-3', dstchannel: 'PJSIP/t_trunk_42-4', dialednum: '74950000000' })]).direction).toBe('out');
  });

  it.each([
    { lastapp: 'Playback', dstchannel: '', disposition: 'ANSWERED' },
    { lastapp: 'Dial', dstchannel: 'PJSIP/e101_42-0002', disposition: 'ANSWERED' },
    { lastapp: 'Stasis', dstchannel: '', disposition: 'ANSWERED' },
  ])('keeps a finalized leg incomplete until the logical call completion is proven: %j', (change) => {
    expect(classifyDashboardCall(42, 'node', [leg(change)], { aiWorked: change.lastapp === 'Stasis' })).toMatchObject({ outcome: 'unknown', reason: 'awaitingCompletion', endedAt: null });
  });
  it.each([{ humanAnswered: true }, { aiWorked: true }, {}])('gives known active state precedence over answer and completion evidence: %j', (proof) => {
    const result = classifyDashboardCall(42, 'node', [leg()], { ...proof, active: true, complete: true });
    expect(result).toMatchObject({ outcome: 'active', reason: null, endedAt: null });
    expect(result.participants.some((p) => p.kind === 'completion')).toBe(false);
  });
  it('persists a positive stable completion boundary for later evidence replay', () => {
    const proof = Date.parse('2026-10-11T10:00:40Z');
    const result = classifyDashboardCall(42, 'node', [leg()], { complete: true, completeThrough: proof });
    expect(result).toMatchObject({ outcome: 'accepted', endedAt: '2026-10-11T10:00:30.000Z' });
    expect(result.participants).toContainEqual({ kind: 'completion', value: String(proof) });
  });

  it.each([['ivr', 'Playback'], ['voicemail', 'VoiceMail']] as const)('carries actual %s CEL application evidence through an ANSWERED terminal Hangup', (reason, app) => {
    const result = classifyDashboardCall(42, 'node', [leg({ lastapp: 'Hangup', dstchannel: 'PJSIP/e101_42-0002' })], { complete: true, technicalApplication: app === 'Playback' ? 'ivr' : 'voicemail' });
    expect(result).toMatchObject({ outcome: 'missed', reason });
    expect(result.participants.some((p) => p.kind === 'answer')).toBe(false);
  });
  it('keeps a staff caller pickup with a busy destination missed despite a terminal ANSWERED row', () => {
    const caller = { channel: 'PJSIP/e101_42-0001', dstchannel: 'PJSIP/t_trunk_42-0002', dcontext: 'sip-out42', dialednum: '' };
    const result = classifyDashboardCall(42, 'node', [leg({ ...caller, lastapp: 'Dial', disposition: 'BUSY' }), leg({ ...caller, id: 2, lastapp: 'Hangup', disposition: 'ANSWERED' })], { complete: true, technicalApplication: 'pickup' });
    expect(result).toMatchObject({ outcome: 'missed', reason: 'busy', direction: 'out' });
  });
  it('accepts a real human answer after IVR and retains versioned positive provenance even before completion', () => {
    const result = classifyDashboardCall(42, 'node', [leg({ lastapp: 'Hangup' })], { technicalApplication: 'ivr', humanAnswered: true, complete: true });
    expect(result.outcome).toBe('accepted'); expect(result.participants).toContainEqual({ kind: 'answer', value: 'v3:human' });
    const activeAi = classifyDashboardCall(42, 'node', [leg({ lastapp: 'Stasis', dstchannel: '' })], { active: true, aiWorked: true });
    expect(activeAi.outcome).toBe('active'); expect(activeAi.participants).toContainEqual({ kind: 'answer', value: 'v3:ai' });
    expect(activeAi.participants.some((p) => p.kind === 'completion')).toBe(false);
  });
  it('never treats an answered terminal row with a retained employee dstchannel as a Dial answer', () => {
    expect(classifyDashboardCall(42, 'node', [leg({ lastapp: 'Hangup' })], { complete: true })).toMatchObject({ outcome: 'unknown', reason: 'insufficientEvidence' });
  });
  it('parses actual CEL wall timestamps with microseconds without a timezone guess', () => {
    expect(parseDashboardTimestamp('2026-10-11 07:59:10.123456', 'UTC')).toBe(Date.parse('2026-10-11T07:59:10.123Z'));
  });

});
