import { CallCenterAmiService } from './callcenter-ami.service';
import { CallCenterStateService } from './callcenter-state.service';

/**
 * Unit tests for CallCenterAmiService — focuses on pure handlers
 * (status mapping, tenant resolution, state propagation). The real
 * AMI socket is not exercised; we feed handlers raw event objects.
 */
describe('CallCenterAmiService', () => {
  let state: CallCenterStateService;
  let service: CallCenterAmiService;

  // The minimum AMI / model surface that handlers touch
  const fakeAmi: any = {
    isConnected: () => false,
    queueStatus: jest.fn(),
  };
  const queueModel: any = {
    findAll: jest.fn().mockResolvedValue([]),
  };
  const agentEventModel: any = {
    create: jest.fn().mockResolvedValue(undefined),
  };
  const missedCallModel: any = {
    create: jest.fn().mockResolvedValue(undefined),
  };

  beforeEach(() => {
    state = new CallCenterStateService();
    service = new CallCenterAmiService(fakeAmi, state, agentEventModel, missedCallModel, queueModel);
  });

  // ─── Status mapping ─────────────────────────────────────

  describe('mapAsteriskStatus (private)', () => {
    const map = (status: string, paused?: string) =>
      (service as any).mapAsteriskStatus(status, paused);

    it('returns PAUSED when paused=1 regardless of status', () => {
      expect(map('1', '1')).toBe('PAUSED');
      expect(map('2', '1')).toBe('PAUSED');
      expect(map('6', '1')).toBe('PAUSED');
    });

    it('maps Asterisk status codes to our enum', () => {
      expect(map('1')).toBe('READY');
      expect(map('2')).toBe('IN_CALL');
      expect(map('3')).toBe('IN_CALL');
      expect(map('5')).toBe('OFFLINE');
      expect(map('6')).toBe('RINGING');
      expect(map('7')).toBe('IN_CALL');
      expect(map('8')).toBe('IN_CALL');
    });

    it('defaults to READY for unknown codes', () => {
      expect(map('999')).toBe('READY');
      expect(map('')).toBe('READY');
    });
  });

  // ─── Tenant resolution ──────────────────────────────────

  describe('resolveQueueTenant (private)', () => {
    const resolve = (q: string) => (service as any).resolveQueueTenant(q);

    it('extracts tenant uid from suffix like q1001_42', () => {
      expect(resolve('q1001_42')).toBe(42);
      expect(resolve('sales_7')).toBe(7);
    });

    it('returns null for unrecognised names', () => {
      expect(resolve('plain')).toBeNull();
      expect(resolve('')).toBeNull();
    });
  });

  // ─── Event handlers ─────────────────────────────────────

  describe('handleCallerJoin', () => {
    it('registers a new waiting call with the caller channel for Pick Call', () => {
      service.handleCallerJoin({
        queue: 'sales_7',
        uniqueid: 'U1',
        calleridnum: '+1',
        calleridname: 'Alice',
        channel: 'PJSIP/trunk-00000001',
        position: '2',
      });

      const call = state.getCall('U1');
      expect(call).toBeDefined();
      expect(call?.userUid).toBe(7);
      expect(call?.status).toBe('WAITING');
      expect(call?.callerChannel).toBe('PJSIP/trunk-00000001');
      expect(call?.position).toBe(2);
    });

    it('ignores events for unknown tenants (no leak)', () => {
      service.handleCallerJoin({ queue: 'unknown', uniqueid: 'X', calleridnum: '+1' });
      expect(state.getCall('X')).toBeUndefined();
    });
  });

  describe('handleAgentConnect', () => {
    it('moves the call to TALKING and the agent to IN_CALL', () => {
      // Seed a waiting call
      service.handleCallerJoin({
        queue: 'sales_7',
        uniqueid: 'U1',
        calleridnum: '+1',
        channel: 'PJSIP/trunk-00000001',
      });

      service.handleAgentConnect({
        queue: 'sales_7',
        destuniqueid: 'U1',
        interface: 'PJSIP/101',
        channel: 'PJSIP/101-00000002',
        destchannel: 'PJSIP/trunk-00000001',
        holdtime: '12',
      });

      const call = state.getCall('U1');
      expect(call?.status).toBe('TALKING');
      expect(call?.agent).toBe('PJSIP/101');
      expect(call?.agentChannel).toBe('PJSIP/101-00000002');

      const agent = state.getAgent(7, 'PJSIP/101');
      expect(agent?.status).toBe('IN_CALL');
      expect(agent?.currentCall).toBe('U1');
    });
  });

  describe('handleAgentComplete', () => {
    it('clears the call, increments callsTaken, transitions to READY when wrapupTimeout=0', () => {
      state.setAgent(7, 'PJSIP/101', { name: 'Alice', status: 'IN_CALL', currentCall: 'U1', callsTaken: 3, wrapupTimeout: 0 });
      state.setCall('U1', { userUid: 7, queue: 'sales_7', status: 'TALKING', agent: 'PJSIP/101' });

      service.handleAgentComplete({ queue: 'sales_7', destuniqueid: 'U1', interface: 'PJSIP/101' });

      expect(state.getCall('U1')).toBeUndefined();
      const agent = state.getAgent(7, 'PJSIP/101');
      expect(agent?.status).toBe('READY');
      expect(agent?.callsTaken).toBe(4);
      expect(agent?.currentCall).toBeUndefined();
    });

    it('transitions to WRAPUP when wrapupTimeout>0 and auto-expires after timeout', () => {
      jest.useFakeTimers();
      state.setAgent(7, 'PJSIP/101', { name: 'Alice', status: 'IN_CALL', currentCall: 'U1', callsTaken: 1, wrapupTimeout: 30 });
      state.setCall('U1', { userUid: 7, queue: 'sales_7', status: 'TALKING' });

      service.handleAgentComplete({ queue: 'sales_7', destuniqueid: 'U1', interface: 'PJSIP/101' });

      expect(state.getAgent(7, 'PJSIP/101')?.status).toBe('WRAPUP');
      jest.advanceTimersByTime(30_000);
      expect(state.getAgent(7, 'PJSIP/101')?.status).toBe('READY');
      jest.useRealTimers();
    });
  });

  describe('handleCallerAbandon', () => {
    it('removes the call and persists a missed-call record', async () => {
      state.setCall('U1', {
        userUid: 7,
        queue: 'sales_7',
        callerIdNum: '+1',
        callerIdName: 'Alice',
        position: 3,
      });

      service.handleCallerAbandon({
        queue: 'sales_7',
        uniqueid: 'U1',
        calleridnum: '+1',
        holdtime: '42',
      });

      expect(state.getCall('U1')).toBeUndefined();
      // give the .then() chain a tick to flush
      await Promise.resolve();
      expect(missedCallModel.create).toHaveBeenCalledWith(
        expect.objectContaining({
          call_uniqueid: 'U1',
          queue_name: 'sales_7',
          caller_id_num: '+1',
          caller_id_name: 'Alice',
          hold_time: 42,
          position: 3,
          called_back: false,
          user_uid: 7,
        }),
      );
    });

    it('does not persist when caller id is empty (e.g. anonymous internal abandon)', async () => {
      missedCallModel.create.mockClear();
      service.handleCallerAbandon({ queue: 'sales_7', uniqueid: 'U2', calleridnum: '' });
      await Promise.resolve();
      expect(missedCallModel.create).not.toHaveBeenCalled();
    });
  });

  describe('handleHold / handleUnhold', () => {
    it('toggles call status between HOLD and TALKING when channel matches', () => {
      state.setCall('U1', {
        userUid: 7,
        queue: 'sales_7',
        status: 'TALKING',
        agentChannel: 'PJSIP/101-0001',
      });

      service.handleHold({ channel: 'PJSIP/101-0001' });
      expect(state.getCall('U1')?.status).toBe('HOLD');

      service.handleUnhold({ channel: 'PJSIP/101-0001' });
      expect(state.getCall('U1')?.status).toBe('TALKING');
    });

    it('ignores hold for channels that aren\'t tracked', () => {
      service.handleHold({ channel: 'PJSIP/999-0001' });
      // no call exists — nothing should be created
      expect(state.getAllCallsGlobal()).toHaveLength(0);
    });
  });

  // ─── cancelWrapupTimer ──────────────────────────────────

  describe('cancelWrapupTimer', () => {
    it('cancels a pending auto-READY transition (allows manual wrap-up done)', () => {
      jest.useFakeTimers();
      state.setAgent(7, 'PJSIP/101', { name: 'Alice', status: 'IN_CALL', currentCall: 'U1', callsTaken: 0, wrapupTimeout: 30 });
      state.setCall('U1', { userUid: 7, queue: 'sales_7' });
      service.handleAgentComplete({ queue: 'sales_7', destuniqueid: 'U1', interface: 'PJSIP/101' });

      service.cancelWrapupTimer(7, 'PJSIP/101');
      jest.advanceTimersByTime(30_000);
      // No auto-transition fired — the agent stays in WRAPUP until the manual handler runs
      expect(state.getAgent(7, 'PJSIP/101')?.status).toBe('WRAPUP');
      jest.useRealTimers();
    });
  });
});
