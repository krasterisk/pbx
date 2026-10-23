import { ConfigService } from '@nestjs/config';
import { DashboardProjectionService } from './dashboard-projection.service';
import { dashboardCallKey } from './dashboard-classifier';
function makeProjection(legs: any[] = []) {
  const store = { nodeId: 'node', select: jest.fn(async (sql: string) => sql.includes('FROM cdr') ? legs : []), checkpoint: jest.fn().mockResolvedValue(null), saveCheckpoint: jest.fn().mockResolvedValue(undefined), putCall: jest.fn(), renewLease: jest.fn().mockResolvedValue(true), acquireLease: jest.fn().mockResolvedValue(true), releaseLease: jest.fn(), sequelize: { getQueryInterface: () => ({ showAllTables: async () => ['cdr', 'cel', 'voice_robot_cdr', 'voice_robot_logs'] }) } };
  const worker = new DashboardProjectionService(store as any, new ConfigService({ DASHBOARD_CDR_TIMEZONE: 'UTC' }));
  (worker as any).tables = new Set(['cdr', 'cel', 'voice_robot_cdr', 'voice_robot_logs']);
  return { worker, store };
}
describe('Incremental logical-call projection', () => {
  it('checkpoints fact replay every100 calls and resumes without replaying the completed prefix',async()=>{
    const rows=Array.from({length:251},(_,i)=>({call_key:String(i+1).padStart(64,'0'),tenant:42,linkedid:`l${i}`}));
    const f=makeProjection();let checkpoint:any=null;
    f.store.checkpoint.mockImplementation(async()=>checkpoint);
    f.store.select.mockImplementation(async(_sql:string,args:any)=>rows.filter(row=>row.call_key>args.cursor).slice(0,args.limit) as any);
    f.store.saveCheckpoint.mockImplementation(async(_source:string,cursor:number,from:number,complete:boolean,cursorKey?:string)=>{checkpoint={cursor_value:cursor,initialized_from:from,bootstrap_complete:complete?1:0,cursor_key:cursorKey};});
    const replay=jest.spyOn(f.worker,'reproject').mockResolvedValue(undefined);
    await (f.worker as any).replayCallFacts();
    expect(replay.mock.calls[0][0]).toHaveLength(100);
    expect(checkpoint).toMatchObject({bootstrap_complete:0,cursor_key:rows[99].call_key});
    const restarted=new DashboardProjectionService(f.store as any,new ConfigService());
    const resumed=jest.spyOn(restarted,'reproject').mockResolvedValue(undefined);
    await (restarted as any).replayCallFacts();
    expect(checkpoint.cursor_key).toBe(rows[199].call_key);
    await (restarted as any).replayCallFacts();
    expect(checkpoint).toMatchObject({bootstrap_complete:1,cursor_key:rows[250].call_key});
    expect(resumed.mock.calls.map(([batch])=>batch.length)).toEqual([100,51]);
    await (restarted as any).replayCallFacts();
    expect(resumed).toHaveBeenCalledTimes(2);
    expect(f.store.select.mock.calls.every(([,args]:any)=>args.limit===100)).toBe(true);
  });
  it('does not advance fact replay after shutdown or a failed checkpoint fence',async()=>{
    const f=makeProjection();
    f.store.select.mockResolvedValue([{call_key:'a'.repeat(64),tenant:42,linkedid:'l1'}] as any);
    jest.spyOn(f.worker,'reproject').mockImplementation(async()=>{(f.worker as any).destroyed=true;});
    await expect((f.worker as any).replayCallFacts()).rejects.toThrow('stopped before fact checkpoint');
    expect(f.store.saveCheckpoint).not.toHaveBeenCalled();
    const resumed=new DashboardProjectionService(f.store as any,new ConfigService());
    jest.spyOn(resumed,'reproject').mockResolvedValue(undefined);
    f.store.saveCheckpoint.mockRejectedValueOnce(new Error('Projection ownership lost'));
    await expect((resumed as any).replayCallFacts()).rejects.toThrow('Projection ownership lost');
  });
  it('fetches evidence in batches and not once for every call', async () => {
    const legs = Array.from({ length: 100 }, (_, i) => ({ id: i + 1, vpbx_user_uid: 42, uniqueid: `u${i}`, linkedid: `l${i}`, calldate: '2026-10-01 00:00:00', channel: 'PJSIP/t_trunk_42-1', disposition: 'NO ANSWER' }));
    const { worker, store } = makeProjection(legs);
    await worker.reproject(legs);
    expect(store.putCall).toHaveBeenCalledTimes(100);
    expect(store.select.mock.calls.filter(([sql]) => sql.includes('FROM cel'))).toHaveLength(1);
    expect(store.select.mock.calls.filter(([sql]) => sql.includes('FROM voice_robot_cdr'))).toHaveLength(1);
    expect(new Set(store.putCall.mock.calls.map(([call]) => call.id)).size).toBe(100);
  });
  it('does not collapse blank linkedids and carries the explicit PBX zone', async () => {
    const legs = Array.from({ length: 2 }, (_, i) => ({ id: i + 1, vpbx_user_uid: 42, uniqueid: `u${i}`, linkedid: '', calldate: '2026-10-01 10:00:00', channel: 'PJSIP/e101_42-1', disposition: 'NO ANSWER' }));
    const { worker, store } = makeProjection(legs);
    await worker.reproject(legs);
    expect(store.putCall).toHaveBeenCalledTimes(2);
  });
  it('skips invalid timestamps and records incomplete history rather than inventing dates', async () => {
    const legs = [{ id: 100, vpbx_user_uid: 42, uniqueid: 'bad', linkedid: '', calldate: '2026-02-30 00:00:00' }];
    const { worker, store } = makeProjection(legs);
    await worker.reproject(legs);
    expect(store.putCall).not.toHaveBeenCalled();
    expect(store.saveCheckpoint).toHaveBeenCalledWith('cdrInvalid:node', 100, expect.any(Number), false, undefined, expect.any(String));
  });
  it('does not advance checkpoints if a projection write fails', async () => {
    const legs = [{ id: 100, vpbx_user_uid: 42, uniqueid: 'u1', linkedid: '', calldate: '2026-10-01 00:00:00', disposition: 'BUSY' }];
    const { worker, store } = makeProjection(legs);
    store.select.mockImplementation(async (sql: string) => sql.startsWith('SELECT id FROM cdr') ? [{ id: 100 }] as any : sql.includes('FROM cdr') ? legs : []);
    store.putCall.mockRejectedValue(new Error('SQL disconnected'));
    await worker.tick(); expect(store.saveCheckpoint.mock.calls.some(([source]) => source === 'cdr:node')).toBe(false);
  });
  it('does not infer working AI from a noise-only attempted step count', async () => {
    const legs = [{ id: 1, vpbx_user_uid: 42, uniqueid: 'one', linkedid: 'one', calldate: '2026-10-01 00:00:00', disposition: 'ANSWERED', lastapp: 'Stasis', dstchannel: 'Local/ai;2' }];
    const { worker, store } = makeProjection(legs);
    store.select.mockImplementation(async (sql: string) => sql.includes('FROM cdr') ? legs : sql.includes('FROM voice_robot_cdr') ? [{ call_uniqueid: 'one', total_steps: 1, worked: 1 }] as any : []);
    await worker.reproject(legs);
    expect(store.putCall.mock.calls[0][0]).toMatchObject({ origin: 'ai', outcome: 'unknown' });
  });
  it('does not accept legacy STT/ai_response logs before a successful playback proof', async () => {
    const legs = [{ id: 1, vpbx_user_uid: 42, uniqueid: 'one', linkedid: 'one', calldate: '2026-10-01 00:00:00', channel: 'PJSIP/t_provider_42-01', disposition: 'ANSWERED', lastapp: 'Playback', duration: 5 }];
    const { worker, store } = makeProjection(legs);
    store.select.mockImplementation(async (sql: string) => sql.includes('FROM cdr') ? legs : sql.includes('FROM dashboard_live_state') ? [{ updated_at: Date.now(), payload: JSON.stringify({ source: { state: 'ok' }, calls: {} }) }] as any : sql.includes('FROM voice_robot_logs') ? [{ call_uniqueid: 'one', recognized_text: 'heard speech', ai_response: 'not actually played' }] as any : []);
    await worker.reproject(legs);
    expect(store.putCall.mock.calls[0][0]).toMatchObject({ origin: 'ai', outcome: 'unknown', reason: 'aiPlaybackUnconfirmed', endedAt: expect.any(String) });
  });
  it('throws on shutdown between chunks instead of acknowledging unprocessed rows', async () => {
    const legs = Array.from({ length: 200 }, (_, i) => ({ id: i + 1, vpbx_user_uid: 42, uniqueid: `u${i}`, linkedid: `l${i}`, calldate: '2026-10-01 00:00:00', disposition: 'BUSY' }));
    const { worker, store } = makeProjection(legs);
    store.select.mockImplementation(async (sql: string, args?: any) => sql.includes('FROM cdr') ? legs.filter((leg) => args?.ids?.includes(leg.linkedid)) : []);
    store.putCall.mockImplementation(async () => { (worker as any).destroyed = true; });
    await expect(worker.reproject(legs)).rejects.toThrow('stopped before batch completion');
    expect(store.putCall).toHaveBeenCalledTimes(100); expect(store.saveCheckpoint).not.toHaveBeenCalled();
  });

  it('does not mix null-tenant sip-in10 legs into sip-in1 logical calls', async () => {
    const legs = [{ id: 1, vpbx_user_uid: 1, uniqueid: 'tenant1', linkedid: 'same', calldate: '2026-10-01 00:00:00', channel: 'PJSIP/e101_1-01', dcontext: 'sip-in1', disposition: 'BUSY' }, { id: 2, vpbx_user_uid: null, uniqueid: 'tenant10', linkedid: 'same', calldate: '2026-10-01 00:00:00', channel: 'PJSIP/e202_10-02', dcontext: 'sip-in10', disposition: 'BUSY' }];
    const { worker, store } = makeProjection(legs); await worker.reproject(legs);
    const first = store.putCall.mock.calls.find(([call]) => call.tenant === 1)![0];
    expect(first.participants).not.toEqual(expect.arrayContaining([{ kind: 'uniqueid', value: 'tenant10' }]));
    const query = (store.select.mock.calls as any[]).find(([sql, args]) => sql.includes('FROM cdr') && args?.vpbxUserUid === 1);
    expect(query[1].ctxInLike).toBe('sip-in1-%');
  });

  const actualLeg = (change: any = {}) => ({ id: 1, vpbx_user_uid: 42, uniqueid: 'root', linkedid: 'root', calldate: '2026-10-01 00:00:00', channel: 'PJSIP/t_trunk_42-0001', dstchannel: '', lastapp: 'Hangup', disposition: 'ANSWERED', duration: 10, ...change });
  const actualFixture = (legs: any[], events: any[], previous: any[] = []) => {
    const f = makeProjection(legs);
    f.store.select.mockImplementation(async (sql: string) => sql.includes('FROM cdr') ? legs : sql.includes('FROM cel') ? events : sql.includes('LEFT JOIN dashboard_participants') ? previous : sql.includes('FROM dashboard_live_state') ? [{ updated_at: Date.now(), payload: JSON.stringify({ source: { state: 'ok' }, calls: {} }) }] : []);
    return f;
  };
  it.each([['Playback', 'ivr'], ['VoiceMail', 'voicemail']])('classifies actual terminal Hangup CDR through owned CEL ANSWER %s application', async (appname, reason) => {
    const legs = [actualLeg()]; const f = actualFixture(legs, [{ uniqueid: 'root', linkedid: 'root', channame: legs[0].channel, eventtype: 'ANSWER', appname }]);
    await f.worker.reproject(legs); expect(f.store.putCall.mock.calls[0][0]).toMatchObject({ outcome: 'missed', reason });
  });
  it('does not accept actual staff origin ANSWER before Playback or a busy trunk', async () => {
    const channel = 'PJSIP/e101_42-0001';
    const ivr = [actualLeg({ channel, src: '101', usrc: '101', dst: '703' })]; const first = actualFixture(ivr, [{ uniqueid: 'root', linkedid: 'root', channame: channel, eventtype: 'ANSWER', appname: 'Playback' }]);
    await first.worker.reproject(ivr); expect(first.store.putCall.mock.calls[0][0]).toMatchObject({ outcome: 'missed', reason: 'ivr', direction: 'internal' });
    const busy = [actualLeg({ channel, dcontext: 'sip-out42', dstchannel: 'PJSIP/t_trunk_42-02', lastapp: 'Dial', disposition: 'BUSY' }), actualLeg({ id: 2, channel, dcontext: 'sip-out42', dstchannel: 'PJSIP/t_trunk_42-02' })];
    const second = actualFixture(busy, [{ uniqueid: 'root', linkedid: 'root', channame: channel, eventtype: 'ANSWER', appname: 'Answer' }]);
    await second.worker.reproject(busy); expect(second.store.putCall.mock.calls[0][0]).toMatchObject({ outcome: 'missed', reason: 'busy', direction: 'out' });
  });
  it('recognizes APP_START technical application after a generic pickup with no later ANSWER event', async () => {
    const legs = [actualLeg()]; const f = actualFixture(legs, [{ uniqueid: 'root', linkedid: 'root', channame: legs[0].channel, eventtype: 'ANSWER', appname: 'Answer' }, { uniqueid: 'root', linkedid: 'root', channame: legs[0].channel, eventtype: 'APP_START', appname: 'VoiceMail' }]);
    await f.worker.reproject(legs); expect(f.store.putCall.mock.calls[0][0]).toMatchObject({ outcome: 'missed', reason: 'voicemail' });
  });
  it('accepts a real owned destination ANSWER after IVR and persists positive v3 provenance', async () => {
    const destination = 'PJSIP/e101_42-0002'; const legs = [actualLeg({ dstchannel: destination })];
    const f = actualFixture(legs, [{ uniqueid: 'root', linkedid: 'root', channame: legs[0].channel, eventtype: 'ANSWER', appname: 'Playback' }, { uniqueid: 'callee', linkedid: 'root', channame: destination, eventtype: 'ANSWER', appname: 'AppDial' }]);
    await f.worker.reproject(legs); const call = f.store.putCall.mock.calls[0][0]; expect(call.outcome).toBe('accepted'); expect(call.participants).toContainEqual({ kind: 'answer', value: 'v3:human' });
  });
  it.each(['peer', 'extra'])('uses actual outgoing BRIDGE_ENTER %s peer evidence instead of caller pickup', async (field) => {
    const legs = [actualLeg({ channel: 'PJSIP/e101_42-0001', dstchannel: 'PJSIP/t_trunk_42-0002', dcontext: 'sip-out42' })];
    const event = { uniqueid: 'root', linkedid: 'root', channame: legs[0].channel, eventtype: 'BRIDGE_ENTER', extra: JSON.stringify({ bridge_id: 'bridge' }), ...(field === 'peer' ? { peer: `Snoop/foreign,${legs[0].dstchannel}` } : { extra: JSON.stringify({ bridge_id: 'bridge', peers: [legs[0].dstchannel] }) }) };
    const f = actualFixture(legs, [event]); await f.worker.reproject(legs); expect(f.store.putCall.mock.calls[0][0]).toMatchObject({ outcome: 'accepted', direction: 'out' });
  });
  it.each(['bridgeOnly', 'foreignPeer', 'localMedia'])('does not accept a caller bridge with %s', async (kind) => {
    const legs = [actualLeg({ channel: 'PJSIP/e101_42-0001', dstchannel: kind === 'localMedia' ? 'Local/ivr_42-0001;2' : 'PJSIP/t_trunk_42-0002' })];
    const event = { uniqueid: 'root', linkedid: 'root', channame: legs[0].channel, eventtype: 'BRIDGE_ENTER', peer: kind === 'bridgeOnly' ? '' : kind === 'foreignPeer' ? 'PJSIP/t_trunk_99-0002' : legs[0].dstchannel, extra: '{"bridge_id":"bridge"}' };
    const f = actualFixture(legs, [event]); await f.worker.reproject(legs); expect(f.store.putCall.mock.calls[0][0].outcome).toBe('unknown');
  });
  it.each(['foreignChannel', 'foreignUniqueid', 'wrongLinkedid', 'conflictingIdentity'])('rejects %s evidence even with a colliding linkedid', async (kind) => {
    const destination = 'PJSIP/e101_42-0002'; const legs = [actualLeg({ dstchannel: destination }), actualLeg({ id: 2, uniqueid: 'other', linkedid: 'other', channel: 'PJSIP/e102_42-0003', dstchannel: '' })];
    const event = { eventtype: 'ANSWER', uniqueid: kind === 'foreignUniqueid' ? 'foreign' : kind === 'conflictingIdentity' ? 'other' : 'root', linkedid: kind === 'wrongLinkedid' ? 'foreign' : 'root', channame: kind === 'foreignChannel' ? 'PJSIP/e101_99-0002' : kind === 'foreignUniqueid' ? 'PJSIP/e101_42-foreign' : destination, appname: 'AppDial' };
    const f = actualFixture(legs, [event]); await f.worker.reproject(legs); expect(f.store.putCall.mock.calls.find(([call]) => call.linkedid === 'root')![0].outcome).toBe('unknown');
  });
  it('corrects an old accepted result rather than inferring human answer from it', async () => {
    const legs = [actualLeg()]; const key = dashboardCallKey(42, 'node', 'root'); const f = actualFixture(legs, [{ uniqueid: 'root', linkedid: 'root', channame: legs[0].channel, eventtype: 'ANSWER', appname: 'VoiceMail' }], [{ call_key: key, kind: 'completion', value: String(Date.now()), origin: 'telephony', outcome: 'accepted' }]);
    await f.worker.reproject(legs); expect(f.store.putCall.mock.calls[0][0]).toMatchObject({ outcome: 'missed', reason: 'voicemail' });
  });
  it('reads v3 durable answer and completion in one batch and survives a missing transient source', async () => {
    const legs = [actualLeg()]; const key = dashboardCallKey(42, 'node', 'root'); const f = actualFixture(legs, [], [{ call_key: key, kind: 'completion', value: String(Date.now()), origin: 'telephony' }, { call_key: key, kind: 'answer', value: 'v3:human', origin: 'telephony' }]);
    await f.worker.reproject(legs); expect(f.store.putCall.mock.calls[0][0].outcome).toBe('accepted');
    expect(f.store.select.mock.calls.filter(([sql]) => sql.includes('LEFT JOIN dashboard_participants'))).toHaveLength(1);
  });
  it('does not advance CDR checkpoint when CEL evidence is temporarily unavailable', async () => {
    const legs = [actualLeg()]; const f = makeProjection(legs); f.store.select.mockImplementation(async (sql: string) => { if (sql.includes('FROM cel')) throw new Error('CEL unavailable'); return sql.includes('FROM cdr') ? legs : []; });
    await f.worker.tick(); expect(f.store.putCall).not.toHaveBeenCalled(); expect(f.store.saveCheckpoint.mock.calls.some(([source]) => source === 'cdr:node')).toBe(false);
  });
  it('uses explicit UTC wall bounds for AI journal queries without native Date escaping', async () => {
    const f = makeProjection(); (f.worker as any).tables = new Set(['cdr', 'ai_voice_events']);
    f.store.checkpoint.mockResolvedValue({ cursor_value: Date.parse('2026-10-11T07:59:10.123Z'), initialized_from: Date.parse('2026-10-01T00:00:00Z') } as any);
    await (f.worker as any).ingestVoiceEvents();
    const args = (f.store.select.mock.calls as any[]).find(([sql]) => sql.includes('e.created_at> :from'))[1];
    expect(args.from).toBe('2026-10-11 07:59:10.123'); expect(args.from).not.toBeInstanceOf(Date);
  });

  it('does not promote known technical pickup on a retained destination channel to human answer', async () => {
    const destination = 'PJSIP/e101_42-0002'; const legs = [actualLeg({ dstchannel: destination })]; const f = actualFixture(legs, [{ uniqueid: 'callee', linkedid: 'root', channame: destination, eventtype: 'ANSWER', appname: 'VoiceMail' }]);
    await f.worker.reproject(legs); expect(f.store.putCall.mock.calls[0][0]).toMatchObject({ outcome: 'missed', reason: 'voicemail' });
  });

});
