import { AutodialMonitorService } from './autodial-monitor.service';
import { AutodialStateService } from './autodial-state.service';

describe('Autodial live monitor', () => {
  function fixture() {
    const campaigns = { findAll: jest.fn(async (tenant) => tenant === 71 ? [{ uid: 4, name: 'UAT', status: 'running', apply_error: 'failed', dial_mode: 'predictive',
      pacing: { providers: [{ type: 'queue_agents', queue_names: ['sales'] }], predictive: { target_abandon_pct: 3 } } }] : []) };
    const diagnosis = { diagnose: jest.fn().mockResolvedValue({ active_channels: 0, ready_agents: 1, reasons: [{ code: 'waiting_retry' }], runtime: { abandonPct: 5 } }) };
    const cc = { getAllAgents: jest.fn().mockReturnValue([{ userId: 1, name: 'Operator', status: 'READY', queues: ['sales'] },
      { userId: 2, name: 'Unrelated', status: 'READY', queues: ['support'] }]) };
    const db = { getDialect: () => 'mysql', options: { timezone: '+00:00' }, query: jest.fn().mockResolvedValue([]) };
    const state = new AutodialStateService(); let observer: (event: Record<string, unknown>) => void = () => undefined;
    const ami = { isConnected: () => true, subscribeInternalEvents: (fn: typeof observer) => { observer = fn; return jest.fn(); } };
    const service = new AutodialMonitorService(campaigns as never, diagnosis as never, cc as never,
      { isConnected: () => true } as never, ami as never, db as never, state);
    return { service, db, state, cc, send: (event: Record<string, unknown>) => observer(event) };
  }
  it('bounds refresh, zero-fills the trend and scopes operators and alerts', async () => {
    const { service, db, cc } = fixture(); const [first, second] = await Promise.all([service.health(71), service.health(71)]);
    expect(first).toEqual(second); expect(db.query).toHaveBeenCalledTimes(1); expect(cc.getAllAgents).toHaveBeenCalledWith(71);
    expect(first.campaigns[0].agents).toHaveLength(1); expect(first.campaigns[0].trend).toHaveLength(15);
    expect(first.campaigns[0].alerts.map((item) => item.code)).toEqual(['apply_error', 'idle', 'abandon']);
    expect((await service.health(72)).campaigns).toEqual([]);
  });
  it('accepts step events only for an existing attempt in the same tenant', () => {
    const { service, state, send } = fixture(); service.onModuleInit();
    state.addChannel({ channelId: 'ac-4-1-1', campaignUid: 4, taskUid: 1, attemptUid: 8, attemptNo: 1, userUid: 71,
      number: '123', trunkId: 'loop', startedAt: 0, answeredAt: null });
    send({ event: 'UserEvent', userevent: 'AutodialStep', Tenant: 72, Attempt: 8, Step: 'wrong', Type: 'text2speech' });
    expect(state.getChannel('ac-4-1-1')?.stepId).toBeUndefined();
    send({ event: 'UserEvent', userevent: 'AutodialStep', Tenant: 71, Attempt: 8, Step: 'say', Type: 'text2speech' });
    expect(state.getChannel('ac-4-1-1')?.stepId).toBe('say'); service.onModuleDestroy();
  });
});
