import { CallCenterAmiService } from './callcenter-ami.service';
import { CallCenterStateService } from './callcenter-state.service';
import { CallCenterHistoryWriterService } from './callcenter-history-writer.service';
import { CallCenterMetricsService } from './callcenter-metrics.service';

/** Flush pending microtask + macrotask queues — used after fire-and-forget async handler calls. */
function flushMicrotasks(): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, 0));
}

/**
 * Unit tests for CallCenterAmiService — focuses on pure handlers
 * (status mapping, tenant resolution, state propagation). The real
 * AMI socket is not exercised; we feed handlers raw event objects.
 */
describe('CallCenterAmiService', () => {
  let state: CallCenterStateService;
  let service: CallCenterAmiService;
  let historyWriter: { enqueue: jest.Mock };
  let metricsService: {
    recordAnswered: jest.Mock;
    recordAbandoned: jest.Mock;
    recordAgentStatus: jest.Mock;
    recordMade: jest.Mock;
    recordMissed: jest.Mock;
    getQueueMetrics: jest.Mock;
    getAgentKpi: jest.Mock;
    getAgentQueueKpi: jest.Mock;
  };
  let agentSessionModel: { findOne: jest.Mock };

  // The minimum AMI / model surface that handlers touch
  const fakeAmi: any = {
    isConnected: () => false,
    queueStatus: jest.fn(),
  };
  const queueModel: any = {
    findAll: jest.fn().mockResolvedValue([]),
  };
  const agentEventModel: any = {
    create: jest.fn().mockResolvedValue({ getDataValue: () => 1 }),
    update: jest.fn().mockResolvedValue(undefined),
  };
  const missedCallModel: any = {
    create: jest.fn().mockResolvedValue(undefined),
    findOrCreate: jest.fn().mockResolvedValue([{}, true]),
  };

  const emptyKpi = () => ({
    sinceLogin: { answered: 0, made: 0, missed: 0 },
    sinceMidnight: { answered: 0, made: 0, missed: 0 },
  });

  beforeEach(() => {
    state = new CallCenterStateService();
    historyWriter = { enqueue: jest.fn() };
    agentEventModel.create.mockClear();
    agentEventModel.update.mockClear();
    agentSessionModel = { findOne: jest.fn().mockResolvedValue(null) };
    metricsService = {
      recordAnswered: jest.fn(),
      recordAbandoned: jest.fn(),
      recordAgentStatus: jest.fn(),
      recordMade: jest.fn(),
      recordMissed: jest.fn(),
      getQueueMetrics: jest.fn().mockReturnValue({
        sla: 80,
        asr: 90,
        aht: 120,
        asa: 15,
        abandonRate: 10,
        offered: 10,
        answered: 9,
        abandoned: 1,
      }),
      getAgentKpi: jest.fn().mockReturnValue(emptyKpi()),
      getAgentQueueKpi: jest.fn().mockReturnValue(emptyKpi()),
    };
    service = new CallCenterAmiService(
      fakeAmi,
      state,
      historyWriter as unknown as CallCenterHistoryWriterService,
      metricsService as unknown as CallCenterMetricsService,
      agentEventModel,
      missedCallModel,
      queueModel,
      agentSessionModel as any,
    );
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

    it('treats tenant 0 as valid (q700_0) — must not be dropped as falsy', () => {
      expect(resolve('q700_0')).toBe(0);
      expect(CallCenterAmiService.parseQueueTenant('q700_0')).toBe(0);
    });

    it('returns null for unrecognised names', () => {
      expect(resolve('plain')).toBeNull();
      expect(resolve('')).toBeNull();
    });
  });

  describe('handleCallerJoin tenant 0', () => {
    it('registers waiting calls for queues with _0 suffix', () => {
      service.handleCallerJoin({
        queue: 'q700_0',
        uniqueid: 'U-t0',
        calleridnum: '201',
        channel: 'PJSIP/e201_0-00000001',
        position: '1',
      });
      const call = state.getCall('U-t0');
      expect(call).toBeDefined();
      expect(call?.userUid).toBe(0);
      expect(call?.status).toBe('WAITING');
      expect(call?.queue).toBe('q700_0');
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

    it('resolves waiting call by channel when destuniqueid is missing', () => {
      service.handleCallerJoin({
        queue: 'q700_0',
        uniqueid: 'CALLER.1',
        calleridnum: '201',
        channel: 'PJSIP/e201_0-00000023',
      });

      // Broken AMI shape: uniqueid = agent channel, no destuniqueid
      service.handleAgentConnect({
        queue: 'q700_0',
        uniqueid: 'AGENT.2',
        interface: 'PJSIP/ew112_0',
        channel: 'PJSIP/ew112_0-00000024',
        destchannel: 'PJSIP/e201_0-00000023',
      });

      expect(state.getCall('CALLER.1')?.status).toBe('TALKING');
      expect(state.getCall('AGENT.2')).toBeUndefined();
      expect(state.getAgent(0, 'PJSIP/ew112_0')?.currentCall).toBe('CALLER.1');
    });

    it('does not overwrite human agent name with AMI membername', () => {
      state.setAgent(0, 'PJSIP/ew112_0', {
        name: 'Иван',
        status: 'READY',
        userId: 58,
      });
      service.handleAgentStatusEvent({
        queue: 'q700_0',
        interface: 'PJSIP/ew112_0',
        membername: 'PJSIP/ew112_0',
        status: '1',
        paused: '0',
        callstaken: '0',
      });
      expect(state.getAgent(0, 'PJSIP/ew112_0')?.name).toBe('Иван');
    });

    it('keeps pause reason from pausedreason / existing, never Unknown fallback', () => {
      // pauseReason only lives while PAUSED (setAgent strips it otherwise)
      state.setAgent(0, 'PJSIP/ew112_0', {
        name: 'Иван',
        status: 'PAUSED',
        pauseReason: 'Обед',
      });
      service.handleAgentStatusEvent({
        queue: 'q700_0',
        interface: 'PJSIP/ew112_0',
        status: '1',
        paused: '1',
        // AMI often omits reason or uses pausedreason
      });
      expect(state.getAgent(0, 'PJSIP/ew112_0')?.pauseReason).toBe('Обед');
      expect(state.getAgent(0, 'PJSIP/ew112_0')?.status).toBe('PAUSED');

      service.handleAgentStatusEvent({
        queue: 'q700_0',
        interface: 'PJSIP/ew112_0',
        status: '1',
        paused: '1',
        pausedreason: 'Перерыв',
      });
      expect(state.getAgent(0, 'PJSIP/ew112_0')?.pauseReason).toBe('Перерыв');
    });

    it('does not demote logged-in agent to OFFLINE on Asterisk Unavailable', () => {
      state.setAgent(0, 'PJSIP/ew112_0', {
        name: 'Иван',
        status: 'READY',
        userId: 58,
      });
      service.handleAgentStatusEvent({
        queue: 'q700_0',
        interface: 'PJSIP/ew112_0',
        status: '5', // Unavailable — typical after WSS drop
        paused: '0',
      });
      expect(state.getAgent(0, 'PJSIP/ew112_0')?.status).toBe('READY');
      expect(state.getAgent(0, 'PJSIP/ew112_0')?.userId).toBe(58);
    });

    it('does not overwrite session callsTaken with Asterisk cumulative CallsTaken', () => {
      state.setAgent(0, 'PJSIP/ew112_0', {
        name: 'Иван',
        status: 'READY',
        userId: 58,
        loginTime: new Date(),
        callsTaken: 0,
      });
      service.handleAgentStatusEvent({
        queue: 'q700_0',
        interface: 'PJSIP/ew112_0',
        status: '1',
        paused: '0',
        callstaken: '8',
      });
      expect(state.getAgent(0, 'PJSIP/ew112_0')?.callsTaken).toBe(0);
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

    it('removes orphan WAITING row with same caller channel after complete', () => {
      state.setAgent(0, 'PJSIP/ew112_0', {
        name: 'Op',
        status: 'IN_CALL',
        currentCall: 'TALK.1',
        wrapupTimeout: 0,
      });
      state.setCall('WAIT.orphan', {
        userUid: 0,
        queue: 'q700_0',
        status: 'WAITING',
        callerChannel: 'PJSIP/e201_0-00000023',
        callerIdNum: '201',
      });
      state.setCall('TALK.1', {
        userUid: 0,
        queue: 'q700_0',
        status: 'TALKING',
        agent: 'PJSIP/ew112_0',
        callerChannel: 'PJSIP/e201_0-00000023',
      });

      service.handleAgentComplete({
        queue: 'q700_0',
        destuniqueid: 'TALK.1',
        interface: 'PJSIP/ew112_0',
      });

      expect(state.getCall('TALK.1')).toBeUndefined();
      expect(state.getCall('WAIT.orphan')).toBeUndefined();
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
      await Promise.resolve();
      expect(missedCallModel.findOrCreate).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { call_uniqueid: 'U1' },
          defaults: expect.objectContaining({
            call_uniqueid: 'U1',
            queue_name: 'sales_7',
            caller_id_num: '+1',
            caller_id_name: 'Alice',
            hold_time: 42,
            position: 3,
            called_back: false,
            user_uid: 7,
          }),
        }),
      );
    });

    it('does not persist when caller id is empty (e.g. anonymous internal abandon)', async () => {
      missedCallModel.findOrCreate.mockClear();
      service.handleCallerAbandon({ queue: 'sales_7', uniqueid: 'U2', calleridnum: '' });
      await Promise.resolve();
      expect(missedCallModel.findOrCreate).not.toHaveBeenCalled();
    });

    it('skips second Abandon for the same uniqueid (in-memory dedupe)', async () => {
      missedCallModel.findOrCreate.mockClear();
      service.handleCallerAbandon({
        queue: 'sales_7',
        uniqueid: 'U-dup',
        calleridnum: '201',
      });
      service.handleCallerAbandon({
        queue: 'sales_7',
        uniqueid: 'U-dup',
        calleridnum: '201',
      });
      await Promise.resolve();
      expect(missedCallModel.findOrCreate).toHaveBeenCalledTimes(1);
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

  // ─── All-channel agent handlers (D-08) ──────────────────

  describe('handleDialBegin', () => {
    it('sets a READY agent to DIALING when their own channel starts a dial', () => {
      state.setAgent(7, 'PJSIP/e101_42', { name: 'Alice', status: 'READY', userId: 42 });

      service.handleDialBegin({ channel: 'PJSIP/e101_42-00000005' });

      expect(state.getAgent(7, 'PJSIP/e101_42')?.status).toBe('DIALING');
      expect(metricsService.recordAgentStatus).toHaveBeenCalledWith(7, 'PJSIP/e101_42', 'DIALING');
    });

    it('is a no-op for channels not belonging to a logged-in agent (unknown channel)', () => {
      expect(() => service.handleDialBegin({ channel: 'PJSIP/unknown-00000001' })).not.toThrow();
      expect(metricsService.recordAgentStatus).not.toHaveBeenCalled();
    });

    it('ignores a dial on a channel that is not READY (consult/transfer leg guard)', () => {
      state.setAgent(7, 'PJSIP/e101_42', { name: 'Alice', status: 'IN_CALL', userId: 42, currentCall: 'U1' });

      service.handleDialBegin({ channel: 'PJSIP/e101_42-00000009' });

      expect(state.getAgent(7, 'PJSIP/e101_42')?.status).toBe('IN_CALL');
    });

    it('does not throw on an empty channel', () => {
      expect(() => service.handleDialBegin({})).not.toThrow();
    });
  });

  describe('handleDialEnd', () => {
    it('moves a DIALING agent to IN_CALL and records "made" on ANSWER', () => {
      state.setAgent(7, 'PJSIP/e101_42', { name: 'Alice', status: 'DIALING', userId: 42 });

      service.handleDialEnd({ channel: 'PJSIP/e101_42-00000005', dialstatus: 'ANSWER' });

      expect(state.getAgent(7, 'PJSIP/e101_42')?.status).toBe('IN_CALL');
      expect(metricsService.recordMade).toHaveBeenCalledWith(7, 'PJSIP/e101_42');
      expect(metricsService.recordMissed).not.toHaveBeenCalled();
    });

    it('returns a DIALING agent to READY and records "missed" on NOANSWER', () => {
      state.setAgent(7, 'PJSIP/e101_42', { name: 'Alice', status: 'DIALING', userId: 42 });

      service.handleDialEnd({ channel: 'PJSIP/e101_42-00000005', dialstatus: 'NOANSWER' });

      expect(state.getAgent(7, 'PJSIP/e101_42')?.status).toBe('READY');
      expect(metricsService.recordMissed).toHaveBeenCalledWith(7, 'PJSIP/e101_42');
      expect(metricsService.recordMade).not.toHaveBeenCalled();
    });

    it('ignores DialEnd for an agent who is not currently DIALING', () => {
      state.setAgent(7, 'PJSIP/e101_42', { name: 'Alice', status: 'IN_CALL', userId: 42 });

      service.handleDialEnd({ channel: 'PJSIP/e101_42-00000005', dialstatus: 'ANSWER' });

      expect(state.getAgent(7, 'PJSIP/e101_42')?.status).toBe('IN_CALL');
      expect(metricsService.recordMade).not.toHaveBeenCalled();
    });

    it('is a no-op for unknown channels', () => {
      expect(() => service.handleDialEnd({ channel: 'PJSIP/unknown-1', dialstatus: 'ANSWER' })).not.toThrow();
    });
  });

  describe('handleNewchannel / handleAgentHangup — personal direct ring (D-08/D-10)', () => {
    it('marks a READY agent RINGING on a ringing Newchannel and records a personal missed on hangup', () => {
      state.setAgent(7, 'PJSIP/e101_42', { name: 'Alice', status: 'READY', userId: 42 });

      service.handleNewchannel({ channel: 'PJSIP/e101_42-00000005', channelstatedesc: 'Ring' });
      expect(state.getAgent(7, 'PJSIP/e101_42')?.status).toBe('RINGING');

      service.handleAgentHangup({ channel: 'PJSIP/e101_42-00000005' });
      expect(state.getAgent(7, 'PJSIP/e101_42')?.status).toBe('READY');
      expect(metricsService.recordMissed).toHaveBeenCalledWith(7, 'PJSIP/e101_42');
    });

    it('does not mark RINGING when the agent is not READY (avoids mid-call false positives)', () => {
      state.setAgent(7, 'PJSIP/e101_42', { name: 'Alice', status: 'IN_CALL', userId: 42, currentCall: 'U1' });

      service.handleNewchannel({ channel: 'PJSIP/e101_42-00000005', channelstatedesc: 'Ring' });

      expect(state.getAgent(7, 'PJSIP/e101_42')?.status).toBe('IN_CALL');
    });

    it('handleAgentHangup releases a personal (non-queue) IN_CALL agent to READY without a queue-driven double-release', () => {
      state.setAgent(7, 'PJSIP/e101_42', { name: 'Alice', status: 'IN_CALL', userId: 42 }); // no currentCall — personal call

      service.handleAgentHangup({ channel: 'PJSIP/e101_42-00000005' });

      expect(state.getAgent(7, 'PJSIP/e101_42')?.status).toBe('READY');
    });

    it('handleAgentHangup does not touch a queue-tracked IN_CALL agent (has currentCall — AgentComplete owns that transition)', () => {
      state.setAgent(7, 'PJSIP/e101_42', { name: 'Alice', status: 'IN_CALL', userId: 42, currentCall: 'U1' });

      service.handleAgentHangup({ channel: 'PJSIP/e101_42-00000005' });

      expect(state.getAgent(7, 'PJSIP/e101_42')?.status).toBe('IN_CALL');
    });

    it('handleAgentHangup is a no-op for unknown channels', () => {
      expect(() => service.handleAgentHangup({ channel: 'PJSIP/unknown-1' })).not.toThrow();
    });
  });

  describe('DIALING journal (cc_agent_events, D-09/D-13)', () => {
    it('writes a DIALING row on entry and fills duration on exit', async () => {
      agentSessionModel.findOne.mockResolvedValue({ getDataValue: () => 55 });
      state.setAgent(7, 'PJSIP/e101_42', { name: 'Alice', status: 'READY', userId: 42 });

      service.handleDialBegin({ channel: 'PJSIP/e101_42-00000005' });
      await flushMicrotasks();

      expect(agentEventModel.create).toHaveBeenCalledWith(
        expect.objectContaining({ session_id: 55, user_id: 42, event_type: 'DIALING', user_uid: 7 }),
      );

      service.handleDialEnd({ channel: 'PJSIP/e101_42-00000005', dialstatus: 'ANSWER' });
      await flushMicrotasks();

      expect(agentEventModel.update).toHaveBeenCalledWith(
        expect.objectContaining({ duration: expect.any(Number) }),
        expect.objectContaining({ where: { uid: 1 } }),
      );
    });

    it('does not write a journal row when no active session is found', async () => {
      agentSessionModel.findOne.mockResolvedValue(null);
      state.setAgent(7, 'PJSIP/e101_42', { name: 'Alice', status: 'READY', userId: 42 });

      service.handleDialBegin({ channel: 'PJSIP/e101_42-00000005' });
      await flushMicrotasks();

      expect(agentEventModel.create).not.toHaveBeenCalled();
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
