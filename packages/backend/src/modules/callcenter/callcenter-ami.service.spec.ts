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
    getActiveChannels: jest.fn().mockResolvedValue({ events: [] }),
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
  const autoPauseService: any = {
    evaluateRonaOnAbandon: jest.fn().mockResolvedValue(undefined),
    evaluateRonaForAgent: jest.fn().mockResolvedValue(undefined),
    evaluateOnMissed: jest.fn().mockResolvedValue(undefined),
    evaluateOnStatusEvent: jest.fn().mockResolvedValue(undefined),
  };
  const fakeCcService: any = {
    autoResolveOnAnswer: jest.fn().mockResolvedValue(undefined),
  };
  const moduleRef: any = {
    get: jest.fn(() => fakeCcService),
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
    autoPauseService.evaluateRonaOnAbandon.mockClear();
    autoPauseService.evaluateRonaForAgent.mockClear();
    autoPauseService.evaluateOnMissed.mockClear();
    autoPauseService.evaluateOnStatusEvent.mockClear();
    fakeCcService.autoResolveOnAnswer.mockClear();
    moduleRef.get.mockClear();
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
      autoPauseService,
      agentEventModel,
      missedCallModel,
      queueModel,
      agentSessionModel as any,
      moduleRef,
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
      expect(map('0')).toBe('OFFLINE');
      expect(map('4')).toBe('OFFLINE');
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
      expect(call?.callerIdNum).toBe('+1');

      const agent = state.getAgent(7, 'PJSIP/101');
      expect(agent?.status).toBe('IN_CALL');
      expect(agent?.currentCall).toBe('U1');
      expect(agent?.peerNumber).toBe('+1');
    });

    it('keeps callerIdNum when QueueCallerLeave races after answer', () => {
      state.setAgent(7, 'PJSIP/101', { name: 'Alice', status: 'READY', queues: ['sales_7'] });
      service.handleCallerJoin({
        queue: 'sales_7',
        uniqueid: 'U-leave',
        calleridnum: '111',
        channel: 'PJSIP/trunk-00000021',
      });
      service.handleAgentCalled({
        queue: 'sales_7',
        uniqueid: 'U-leave',
        interface: 'PJSIP/101',
      });
      service.handleAgentConnect({
        queue: 'sales_7',
        destuniqueid: 'U-leave',
        interface: 'PJSIP/101',
        channel: 'PJSIP/101-00000022',
        destchannel: 'PJSIP/trunk-00000021',
      });
      service.handleCallerLeave({
        queue: 'sales_7',
        uniqueid: 'U-leave',
      });

      const call = state.getCall('U-leave');
      expect(call?.status).toBe('TALKING');
      expect(call?.callerIdNum).toBe('111');
    });

    it('does not drop RINGING row on Leave before Connect (answer race)', () => {
      state.setAgent(7, 'PJSIP/101', { name: 'Alice', status: 'READY', queues: ['sales_7'] });
      service.handleCallerJoin({
        queue: 'sales_7',
        uniqueid: 'U-ring',
        calleridnum: '111',
        channel: 'PJSIP/trunk-00000031',
      });
      service.handleAgentCalled({
        queue: 'sales_7',
        uniqueid: 'U-ring',
        interface: 'PJSIP/101',
      });
      service.handleCallerLeave({
        queue: 'sales_7',
        uniqueid: 'U-ring',
      });

      expect(state.getCall('U-ring')?.callerIdNum).toBe('111');
      expect(state.getCall('U-ring')?.status).toBe('RINGING');
    });

    it('auto-resolves open missed-call rows for the caller number via CallCenterService (D-17)', () => {
      service.handleCallerJoin({
        queue: 'sales_7',
        uniqueid: 'U-answer',
        calleridnum: '+79990001122',
        channel: 'PJSIP/trunk-00000009',
      });

      service.handleAgentConnect({
        queue: 'sales_7',
        destuniqueid: 'U-answer',
        interface: 'PJSIP/101',
        channel: 'PJSIP/101-00000010',
        destchannel: 'PJSIP/trunk-00000009',
      });

      expect(moduleRef.get).toHaveBeenCalledWith('CallCenterService', { strict: false });
      expect(fakeCcService.autoResolveOnAnswer).toHaveBeenCalledWith(7, '+79990001122');
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

    it('does not overwrite human agent name with Originate CallerID extension', () => {
      state.setAgent(0, 'PJSIP/e201_0', {
        name: 'Оператор',
        status: 'DIALING',
        userId: 58,
      });
      service.handleAgentStatusEvent({
        queue: 'q700_0',
        interface: 'PJSIP/e201_0',
        membername: '201',
        status: '6',
        paused: '0',
        callstaken: '0',
      });
      expect(state.getAgent(0, 'PJSIP/e201_0')?.name).toBe('Оператор');
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

    it('keeps DIALING when device goes In use before remote answer', () => {
      state.setAgent(0, 'PJSIP/ew112_0', {
        name: 'Иван',
        status: 'DIALING',
        dialTarget: '201',
        userId: 58,
      });
      service.handleAgentStatusEvent({
        queue: 'q700_0',
        interface: 'PJSIP/ew112_0',
        status: '2', // In use
        paused: '0',
      });
      expect(state.getAgent(0, 'PJSIP/ew112_0')?.status).toBe('DIALING');
      expect(state.getAgent(0, 'PJSIP/ew112_0')?.dialTarget).toBe('201');
    });

    it('keeps DIALING on In use after DialBegin seeded unanswered outbound', () => {
      state.setAgent(0, 'PJSIP/ew112_0', {
        name: 'Иван',
        status: 'READY',
        userId: 58,
      });
      service.handleDialBegin({
        channel: 'PJSIP/ew112_0-00000001',
        destcalleridnum: '201',
        uniqueid: 'DB-KEEP',
      });
      expect(state.getAgent(0, 'PJSIP/ew112_0')?.status).toBe('DIALING');

      service.handleAgentStatusEvent({
        queue: 'q700_0',
        interface: 'PJSIP/ew112_0',
        status: '2',
        paused: '0',
      });
      expect(state.getAgent(0, 'PJSIP/ew112_0')?.status).toBe('DIALING');
    });

    it('does not resurrect DIALING from stale unanswered outbound when AMI says READY (after unpause)', () => {
      state.setAgent(0, 'PJSIP/ew112_0', {
        name: 'Администратор',
        status: 'READY',
        dialTarget: '201',
        userId: 58,
      });
      // Seed a leftover outbound attempt (e.g. auto-pause mid-dial without DialEnd).
      service.handleDialBegin({
        channel: 'PJSIP/ew112_0-00000099',
        destcalleridnum: '201',
        uniqueid: 'STALE-OUT',
      });
      expect(state.getAgent(0, 'PJSIP/ew112_0')?.status).toBe('DIALING');

      // Simulate pause + unpause clearing agent to READY but leaving nonQueue seed
      // if clearNonQueueDialAttempt was skipped — remap must still not resurrect.
      state.setAgent(0, 'PJSIP/ew112_0', {
        status: 'READY',
        dialTarget: '201',
        pauseReason: '',
      });
      service.handleAgentStatusEvent({
        queue: 'q700_0',
        interface: 'PJSIP/ew112_0',
        status: '1', // Not in use
        paused: '0',
      });
      expect(state.getAgent(0, 'PJSIP/ew112_0')?.status).toBe('READY');
    });

    it('clearNonQueueDialAttempt drops stale outbound so READY stays READY', () => {
      state.setAgent(0, 'PJSIP/ew112_0', {
        name: 'Администратор',
        status: 'READY',
        userId: 58,
      });
      service.handleDialBegin({
        channel: 'PJSIP/ew112_0-00000088',
        destcalleridnum: '201',
        uniqueid: 'CLR-OUT',
      });
      service.clearNonQueueDialAttempt(0, 'PJSIP/ew112_0');
      state.setAgent(0, 'PJSIP/ew112_0', {
        status: 'READY',
        dialTarget: undefined,
        peerNumber: '',
      });
      service.handleAgentStatusEvent({
        queue: 'q700_0',
        interface: 'PJSIP/ew112_0',
        status: '1',
        paused: '0',
      });
      expect(state.getAgent(0, 'PJSIP/ew112_0')?.status).toBe('READY');
    });

    it('releases DIALING to READY when AMI reports Not in use after failed dial', () => {
      state.setAgent(0, 'PJSIP/ew112_0', {
        name: 'Администратор',
        status: 'READY',
        userId: 58,
      });
      service.handleDialBegin({
        channel: 'PJSIP/ew112_0-00000077',
        destcalleridnum: '800',
        uniqueid: 'FAIL-OUT',
      });
      expect(state.getAgent(0, 'PJSIP/ew112_0')?.status).toBe('DIALING');
      expect(state.getAgent(0, 'PJSIP/ew112_0')?.dialTarget).toBe('800');

      // Dialplan Hangup / Congestion: channel free, DialEnd may never arrive.
      service.handleAgentStatusEvent({
        queue: 'q700_0',
        interface: 'PJSIP/ew112_0',
        status: '1', // Not in use
        paused: '0',
      });
      expect(state.getAgent(0, 'PJSIP/ew112_0')?.status).toBe('READY');
      expect(state.getAgent(0, 'PJSIP/ew112_0')?.dialTarget).toBeUndefined();
    });

    it('routes QueueMemberStatus on primary twin to the logged-in WebRTC agent', () => {
      state.setAgent(0, 'PJSIP/ew112_0', {
        name: 'Администратор',
        status: 'DIALING',
        dialTarget: '201',
        userId: 58,
      });
      service.handleAgentStatusEvent({
        queue: 'q700_0',
        interface: 'PJSIP/e112_0',
        status: '2',
        paused: '0',
      });
      expect(state.getAgent(0, 'PJSIP/ew112_0')?.status).toBe('DIALING');
      expect(state.getAgent(0, 'PJSIP/e112_0')).toBeUndefined();
    });

    it('preserves OUTBOUND_WORK when AMI reports paused', () => {
      state.setAgent(0, 'PJSIP/ew112_0', {
        name: 'Иван',
        status: 'OUTBOUND_WORK',
        statusOrigin: 'manual',
        pauseReason: 'outbound_work',
        userId: 58,
      });
      service.handleAgentStatusEvent({
        queue: 'q700_0',
        interface: 'PJSIP/ew112_0',
        status: '1',
        paused: '1',
        pausedreason: 'outbound_work',
      });
      expect(state.getAgent(0, 'PJSIP/ew112_0')?.status).toBe('OUTBOUND_WORK');
    });

    it('keeps panel READY when AMI reports pause — Asterisk is healed to match', async () => {
      fakeAmi.isConnected = () => true;
      fakeAmi.queuePause = jest.fn().mockResolvedValue(undefined);
      state.setAgent(0, 'PJSIP/ew112_0', {
        name: 'Иван',
        status: 'READY',
        statusOrigin: 'manual',
        userId: 58,
        queues: ['q700_0'],
      });
      service.handleAgentStatusEvent({
        queue: 'q700_0',
        interface: 'PJSIP/ew112_0',
        status: '1',
        paused: '1',
        pausedreason: 'outbound_work',
      });
      expect(state.getAgent(0, 'PJSIP/ew112_0')?.status).toBe('READY');
      await flushMicrotasks();
      expect(fakeAmi.queuePause).toHaveBeenCalledWith('q700_0', 'PJSIP/ew112_0', false, undefined);
      fakeAmi.isConnected = () => false;
    });

    it('keeps panel PAUSED when AMI reports unpaused — Asterisk is healed to match', async () => {
      fakeAmi.isConnected = () => true;
      fakeAmi.queuePause = jest.fn().mockResolvedValue(undefined);
      state.setAgent(0, 'PJSIP/ew112_0', {
        name: 'Иван',
        status: 'PAUSED',
        statusOrigin: 'manual',
        pauseReason: 'Обед',
        userId: 58,
        queues: ['q700_0'],
      });
      service.handleAgentStatusEvent({
        queue: 'q700_0',
        interface: 'PJSIP/ew112_0',
        status: '1',
        paused: '0',
      });
      expect(state.getAgent(0, 'PJSIP/ew112_0')?.status).toBe('PAUSED');
      await flushMicrotasks();
      expect(fakeAmi.queuePause).toHaveBeenCalledWith('q700_0', 'PJSIP/ew112_0', true, 'Обед');
      fakeAmi.isConnected = () => false;
    });

    it('adopts AMI pause when panel READY has no trusted origin', async () => {
      fakeAmi.isConnected = () => true;
      fakeAmi.queuePause = jest.fn().mockResolvedValue(undefined);
      state.setAgent(0, 'PJSIP/ew112_0', {
        name: 'Иван',
        status: 'READY',
        statusOrigin: 'unknown',
        userId: 58,
        queues: ['q700_0'],
      });
      service.handleAgentStatusEvent({
        queue: 'q700_0',
        interface: 'PJSIP/ew112_0',
        status: '1',
        paused: '1',
        pausedreason: 'Обед',
      });
      expect(state.getAgent(0, 'PJSIP/ew112_0')?.status).toBe('PAUSED');
      expect(state.getAgent(0, 'PJSIP/ew112_0')?.statusOrigin).toBe('ami');
      await flushMicrotasks();
      expect(fakeAmi.queuePause).not.toHaveBeenCalled();
      fakeAmi.isConnected = () => false;
    });

    it('evaluates auto-pause idle_time/status_duration rules on every status update (D-15)', () => {
      service.handleAgentStatusEvent({
        queue: 'sales_7',
        interface: 'PJSIP/101',
        membername: 'PJSIP/101',
        status: '1',
        paused: '0',
      });

      expect(autoPauseService.evaluateOnStatusEvent).toHaveBeenCalledWith(
        7,
        'PJSIP/101',
        'READY',
        expect.any(Array),
        undefined,
      );
    });
  });

  describe('handleAgentComplete', () => {
    it('clears the call, increments callsTaken, transitions to READY when wrapupTimeout=0', () => {
      state.setAgent(7, 'PJSIP/101', { name: 'Alice', status: 'IN_CALL', currentCall: 'U1', callsTaken: 3, wrapupTimeout: 0 });
      state.setCall('U1', {
        userUid: 7,
        queue: 'sales_7',
        status: 'TALKING',
        agent: 'PJSIP/101',
        answerTime: new Date(),
      });

      service.handleAgentComplete({ queue: 'sales_7', destuniqueid: 'U1', interface: 'PJSIP/101' });

      expect(state.getCall('U1')).toBeUndefined();
      const agent = state.getAgent(7, 'PJSIP/101');
      expect(agent?.status).toBe('READY');
      expect(agent?.callsTaken).toBe(4);
      expect(agent?.currentCall).toBeUndefined();
    });

    it('does not increment callsTaken when the call was never answered', () => {
      state.setAgent(7, 'PJSIP/101', { name: 'Alice', status: 'IN_CALL', currentCall: 'U1', callsTaken: 3, wrapupTimeout: 0 });
      state.setCall('U1', { userUid: 7, queue: 'sales_7', status: 'RINGING', agent: 'PJSIP/101' });

      service.handleAgentComplete({ queue: 'sales_7', destuniqueid: 'U1', interface: 'PJSIP/101' });

      expect(state.getAgent(7, 'PJSIP/101')?.callsTaken).toBe(3);
      expect(metricsService.recordAnswered).not.toHaveBeenCalled();
    });

    it('resolves WebRTC twin interface and emits agentKpiUpdate after answered complete', () => {
      const emitSpy = jest.spyOn(state, 'emitEvent');
      state.setAgent(7, 'PJSIP/ew101_7', {
        name: 'Alice',
        status: 'IN_CALL',
        currentCall: 'U1',
        callsTaken: 2,
        wrapupTimeout: 0,
        userId: 42,
      });
      state.setCall('U1', {
        userUid: 7,
        queue: 'sales_7',
        status: 'TALKING',
        agent: 'PJSIP/ew101_7',
        answerTime: new Date(),
      });

      // AMI may report the primary twin while the agent is logged in on WebRTC.
      service.handleAgentComplete({ queue: 'sales_7', destuniqueid: 'U1', interface: 'PJSIP/e101_7' });

      expect(state.getAgent(7, 'PJSIP/ew101_7')?.callsTaken).toBe(3);
      expect(metricsService.recordAnswered).toHaveBeenCalledWith(
        7, 'sales_7', 'PJSIP/ew101_7', expect.any(Number), expect.any(Number), expect.any(Number),
      );
      expect(emitSpy).toHaveBeenCalledWith(
        'agentKpiUpdate',
        7,
        expect.objectContaining({ agent: 'PJSIP/ew101_7' }),
      );
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
        answerTime: new Date(),
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
      state.setCall('U1', { userUid: 7, queue: 'sales_7', status: 'TALKING', answerTime: new Date() });

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
            personal: false,
            user_uid: 7,
          }),
        }),
      );
    });

    it('evaluates the RONA auto-pause rule for the abandoned queue (D-15)', async () => {
      service.handleCallerAbandon({
        queue: 'sales_7',
        uniqueid: 'U-rona',
        calleridnum: '+1',
      });

      expect(autoPauseService.evaluateRonaOnAbandon).toHaveBeenCalledWith(7, 'sales_7');
      await flushMicrotasks();
    });

    it('increments missed_count for agents RINGING on the abandoned queue', async () => {
      state.setAgent(7, 'PJSIP/e101_42', {
        name: 'Alice',
        status: 'RINGING',
        queues: ['sales_7'],
        userId: 42,
      });

      service.handleCallerAbandon({
        queue: 'sales_7',
        uniqueid: 'U-miss',
        calleridnum: '+7999',
      });

      expect(autoPauseService.evaluateOnMissed).toHaveBeenCalledWith(7, 'PJSIP/e101_42', ['sales_7']);
      expect(metricsService.recordMissed).toHaveBeenCalledWith(7, 'PJSIP/e101_42', 'sales_7');
      expect(state.getAgent(7, 'PJSIP/e101_42')?.callsMissed).toBe(1);
      await flushMicrotasks();
      expect(state.getAgent(7, 'PJSIP/e101_42')?.status).toBe('READY');
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

  describe('handleAgentCalled / handleAgentRingNoAnswer', () => {
    it('updates the existing WAITING call to RINGING (no duplicate destuniqueid row)', () => {
      state.setAgent(7, 'PJSIP/e101_42', {
        name: 'Alice',
        status: 'READY',
        queues: ['sales_7'],
        userId: 42,
      });
      state.setCall('U-caller', {
        userUid: 7,
        queue: 'sales_7',
        status: 'WAITING',
        callerIdNum: '201',
      });

      service.handleAgentCalled({
        queue: 'sales_7',
        interface: 'PJSIP/e101_42',
        uniqueid: 'U-caller',
        destuniqueid: 'U-agent-leg',
      });

      expect(state.getAgent(7, 'PJSIP/e101_42')?.status).toBe('RINGING');
      expect(state.getCall('U-caller')?.status).toBe('RINGING');
      expect(state.getCall('U-caller')?.agent).toBe('PJSIP/e101_42');
      expect(state.getAgent(7, 'PJSIP/e101_42')?.currentCall).toBe('U-caller');
      expect(state.getCall('U-agent-leg')).toBeUndefined();
      expect(state.getAllCalls(7)).toHaveLength(1);
    });

    it('ignores AgentCalled for interfaces not in CC state', () => {
      expect(() =>
        service.handleAgentCalled({ queue: 'sales_7', interface: 'PJSIP/unknown' }),
      ).not.toThrow();
      expect(metricsService.recordAgentStatus).not.toHaveBeenCalled();
    });

    it('evaluates RONA for the agent on AgentRingNoAnswer (even if status already READY)', async () => {
      state.setAgent(7, 'PJSIP/e101_42', {
        name: 'Alice',
        status: 'READY', // QMS often clears RINGING before RNA arrives
        queues: ['sales_7'],
        userId: 42,
      });

      service.handleAgentRingNoAnswer({
        queue: 'sales_7',
        interface: 'PJSIP/e101_42',
      });

      expect(metricsService.recordMissed).toHaveBeenCalledWith(7, 'PJSIP/e101_42', 'sales_7');
      expect(state.getAgent(7, 'PJSIP/e101_42')?.callsMissed).toBe(1);
      await flushMicrotasks();
      expect(autoPauseService.evaluateOnMissed).toHaveBeenCalledWith(7, 'PJSIP/e101_42', ['sales_7']);
      expect(autoPauseService.evaluateRonaForAgent).toHaveBeenCalledWith(7, 'PJSIP/e101_42', ['sales_7']);
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

    it('allows dial from PAUSED and remembers resume status', () => {
      state.setAgent(7, 'PJSIP/e101_42', {
        name: 'Alice', status: 'PAUSED', pauseReason: 'Lunch', userId: 42,
      });

      service.handleDialBegin({
        channel: 'PJSIP/e101_42-00000005',
        destcalleridnum: '201',
        uniqueid: 'DB-PAUSED',
      });

      expect(state.getAgent(7, 'PJSIP/e101_42')?.status).toBe('DIALING');
      expect(state.getAgent(7, 'PJSIP/e101_42')?.dialTarget).toBe('201');
      expect(state.getAgent(7, 'PJSIP/e101_42')?.pauseReason).toBe('Lunch');

      service.handleDialEnd({
        channel: 'PJSIP/e101_42-00000005',
        dialstatus: 'NOANSWER',
      });
      expect(state.getAgent(7, 'PJSIP/e101_42')?.status).toBe('PAUSED');
    });

    it('allows dial from OUTBOUND_WORK', () => {
      state.setAgent(7, 'PJSIP/e101_42', {
        name: 'Alice', status: 'OUTBOUND_WORK', pauseReason: 'outbound_work', userId: 42,
      });

      service.handleDialBegin({
        channel: 'PJSIP/e101_42-00000005',
        destcalleridnum: '201',
      });

      expect(state.getAgent(7, 'PJSIP/e101_42')?.status).toBe('DIALING');
    });

    it('reclaims false early IN_CALL (device In use before DialBegin) back to DIALING', () => {
      state.setAgent(7, 'PJSIP/e101_42', {
        name: 'Alice', status: 'IN_CALL', userId: 42,
      });

      service.handleDialBegin({
        channel: 'PJSIP/e101_42-00000005',
        destcalleridnum: '201',
        uniqueid: 'DB-RECLAIM',
      });

      expect(state.getAgent(7, 'PJSIP/e101_42')?.status).toBe('DIALING');
      expect(state.getAgent(7, 'PJSIP/e101_42')?.dialTarget).toBe('201');
    });

    it('matches DialBegin on primary twin of a WebRTC-logged agent', () => {
      state.setAgent(0, 'PJSIP/ew112_0', {
        name: 'Администратор', status: 'READY', userId: 58,
      });

      service.handleDialBegin({
        channel: 'PJSIP/e112_0-00000005',
        destcalleridnum: '201',
      });

      expect(state.getAgent(0, 'PJSIP/ew112_0')?.status).toBe('DIALING');
      expect(state.getAgent(0, 'PJSIP/ew112_0')?.dialTarget).toBe('201');
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
      expect(state.getAgent(7, 'PJSIP/e101_42')?.callsMade).toBe(1);
      expect(metricsService.recordMade).toHaveBeenCalledWith(7, 'PJSIP/e101_42');
      expect(metricsService.recordMissed).not.toHaveBeenCalled();
    });

    it('returns a DIALING agent to READY and records "missed" on NOANSWER', () => {
      state.setAgent(7, 'PJSIP/e101_42', { name: 'Alice', status: 'DIALING', userId: 42 });

      service.handleDialEnd({ channel: 'PJSIP/e101_42-00000005', dialstatus: 'NOANSWER' });

      expect(state.getAgent(7, 'PJSIP/e101_42')?.status).toBe('READY');
      expect(state.getAgent(7, 'PJSIP/e101_42')?.callsMissed).toBe(1);
      expect(metricsService.recordMissed).toHaveBeenCalledWith(7, 'PJSIP/e101_42');
      expect(metricsService.recordMade).not.toHaveBeenCalled();
      expect(autoPauseService.evaluateOnMissed).toHaveBeenCalledWith(7, 'PJSIP/e101_42', expect.any(Array));
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
    it('marks a READY agent RINGING on a ringing Newchannel and records a personal missed on hangup', async () => {
      state.setAgent(7, 'PJSIP/e101_42', { name: 'Alice', status: 'READY', userId: 42 });

      service.handleNewchannel({
        channel: 'PJSIP/e101_42-00000005',
        channelstatedesc: 'Ring',
        calleridnum: '+79990001122',
        calleridname: 'Ivan',
      });
      expect(state.getAgent(7, 'PJSIP/e101_42')?.status).toBe('RINGING');

      service.handleAgentHangup({ channel: 'PJSIP/e101_42-00000005', uniqueid: 'H-1' });
      expect(state.getAgent(7, 'PJSIP/e101_42')?.status).toBe('READY');
      expect(metricsService.recordMissed).toHaveBeenCalledWith(7, 'PJSIP/e101_42');

      await Promise.resolve();
      expect(missedCallModel.findOrCreate).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { call_uniqueid: 'H-1' },
          defaults: expect.objectContaining({
            queue_name: 'direct:PJSIP/e101_42',
            caller_id_num: '+79990001122',
            caller_id_name: 'Ivan',
            personal: true,
            user_uid: 7,
          }),
        }),
      );
      expect(autoPauseService.evaluateOnMissed).toHaveBeenCalledWith(7, 'PJSIP/e101_42', expect.any(Array));
    });

    it('does not persist a personal missed call when caller id is unknown (in-queue RNA never enters the tool, D-10/D-20)', async () => {
      missedCallModel.findOrCreate.mockClear();
      state.setAgent(7, 'PJSIP/e101_42', { name: 'Alice', status: 'READY', userId: 42 });

      service.handleNewchannel({ channel: 'PJSIP/e101_42-00000006', channelstatedesc: 'Ring' });
      service.handleAgentHangup({ channel: 'PJSIP/e101_42-00000006' });

      await Promise.resolve();
      expect(missedCallModel.findOrCreate).not.toHaveBeenCalled();
    });

    it('does not mark RINGING when CallerID is the agent own extension (softphone outbound Newchannel)', () => {
      state.setAgent(0, 'PJSIP/ew112_0', { name: 'Admin', status: 'READY', userId: 58 });

      service.handleNewchannel({
        channel: 'PJSIP/ew112_0-00000005',
        channelstatedesc: 'Ring',
        calleridnum: '112',
      });

      expect(state.getAgent(0, 'PJSIP/ew112_0')?.status).toBe('READY');
      expect(metricsService.recordAgentStatus).not.toHaveBeenCalled();
    });

    it('does not convert personal RINGING into outbound DIALING', () => {
      state.setAgent(0, 'PJSIP/ew112_0', { name: 'Admin', status: 'READY', userId: 58 });

      // Simulate legacy race if Newchannel slipped through with a remote-looking id
      service.handleNewchannel({
        channel: 'PJSIP/ew112_0-00000005',
        channelstatedesc: 'Ring',
        calleridnum: '999',
      });
      expect(state.getAgent(0, 'PJSIP/ew112_0')?.status).toBe('RINGING');

      service.handleDialBegin({
        channel: 'PJSIP/ew112_0-00000005',
        dialstring: 'PJSIP/e201_0/sip:201@127.0.0.1',
        uniqueid: 'DB-SOFT',
      });
      // Personal RINGING must NOT be converted to outbound DIALING
      expect(state.getAgent(0, 'PJSIP/ew112_0')?.status).toBe('RINGING');
      expect(historyWriter.enqueue).not.toHaveBeenCalled();
    });

    it('seeds personal RINGING on DestChannel (inbound Dial to WebRTC softphone)', () => {
      state.setAgent(0, 'PJSIP/ew112_0', { name: 'Admin', status: 'READY', userId: 58 });

      service.handleDialBegin({
        channel: 'PJSIP/e201_0-000000ab',
        destchannel: 'PJSIP/ew112_0-000000ac',
        calleridnum: '201',
        dialstring: 'ew112_0',
        uniqueid: 'DB-IN',
        destuniqueid: 'DB-IN-DEST',
      });

      expect(state.getAgent(0, 'PJSIP/ew112_0')?.status).toBe('RINGING');
      expect(state.getAgent(0, 'PJSIP/ew112_0')?.dialTarget).toBeUndefined();
      expect(state.getAgent(0, 'PJSIP/ew112_0')?.peerNumber).toBe('201');

      service.handleAgentHangup({ channel: 'PJSIP/ew112_0-000000ac', uniqueid: 'DB-IN-DEST' });
      expect(historyWriter.enqueue).toHaveBeenCalledWith(
        expect.objectContaining({
          caller_id_num: '201',
          direction: 'personal',
          disposition: 'abandoned',
        }),
      );
      expect(state.getAgent(0, 'PJSIP/ew112_0')?.peerNumber).toBeUndefined();
    });

    it('keeps personal RINGING on In use (does not remap unanswered personal to DIALING)', () => {
      state.setAgent(0, 'PJSIP/ew112_0', { name: 'Admin', status: 'READY', userId: 58 });

      service.handleDialBegin({
        channel: 'PJSIP/e201_0-000000ab',
        destchannel: 'PJSIP/ew112_0-000000ac',
        calleridnum: '201',
        uniqueid: 'DB-IN2',
        destuniqueid: 'DB-IN2-DEST',
      });
      expect(state.getAgent(0, 'PJSIP/ew112_0')?.status).toBe('RINGING');

      service.handleAgentStatusEvent({
        queue: 'q700_0',
        interface: 'PJSIP/ew112_0',
        status: '2', // In use
        paused: '0',
        membername: 'Admin',
      });

      const agent = state.getAgent(0, 'PJSIP/ew112_0');
      expect(agent?.status).toBe('IN_CALL');
      expect(agent?.peerNumber).toBe('201');
      expect(agent?.dialTarget).toBeUndefined();
    });

    it('does not reclaim answered personal IN_CALL back to outbound DIALING', () => {
      state.setAgent(0, 'PJSIP/ew112_0', {
        name: 'Admin', status: 'IN_CALL', userId: 58, peerNumber: '201',
      });
      // Seed personal non-queue state as handleDialBegin DestChannel would
      service.handleDialBegin({
        channel: 'PJSIP/e201_0-000000ab',
        destchannel: 'PJSIP/ew112_0-000000ac',
        calleridnum: '201',
        uniqueid: 'DB-IN3',
        destuniqueid: 'DB-IN3-DEST',
      });
      // Late DialBegin on our twin must not flip to outbound
      service.handleDialBegin({
        channel: 'PJSIP/ew112_0-000000ac',
        destcalleridnum: '201',
        uniqueid: 'DB-FALSE-OUT',
      });

      expect(state.getAgent(0, 'PJSIP/ew112_0')?.status).toBe('IN_CALL');
      expect(state.getAgent(0, 'PJSIP/ew112_0')?.dialTarget).toBeUndefined();
      expect(state.getAgent(0, 'PJSIP/ew112_0')?.peerNumber).toBe('201');
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

  // ─── Non-queue call history (D-34/D-35) ────────────────

  describe('non-queue call history rows (D-34/D-35)', () => {
    it('persists an "answered" outbound history row once the call ends (DialEnd ANSWER → Hangup)', () => {
      state.setAgent(7, 'PJSIP/e101_42', { name: 'Alice', status: 'READY', userId: 42 });

      service.handleDialBegin({ channel: 'PJSIP/e101_42-00000005', destcalleridnum: '+79990001122', uniqueid: 'DB-1' });
      service.handleDialEnd({ channel: 'PJSIP/e101_42-00000005', dialstatus: 'ANSWER' });
      expect(historyWriter.enqueue).not.toHaveBeenCalled(); // not yet — call still active

      service.handleAgentHangup({ channel: 'PJSIP/e101_42-00000005' });

      expect(historyWriter.enqueue).toHaveBeenCalledWith(
        expect.objectContaining({
          call_uniqueid: 'DB-1',
          agent_interface: 'PJSIP/e101_42',
          agent_user_uid: 42,
          caller_id_num: '+79990001122',
          disposition: 'answered',
          direction: 'outbound',
          call_type: 'dial',
          user_uid: 7,
        }),
      );
    });

    it('persists a "timeout" outbound history row on DialEnd NOANSWER', () => {
      state.setAgent(7, 'PJSIP/e101_42', { name: 'Alice', status: 'READY', userId: 42 });

      service.handleDialBegin({ channel: 'PJSIP/e101_42-00000005', destcalleridnum: '+79990001122', uniqueid: 'DB-2' });
      service.handleDialEnd({ channel: 'PJSIP/e101_42-00000005', dialstatus: 'NOANSWER' });

      expect(historyWriter.enqueue).toHaveBeenCalledWith(
        expect.objectContaining({
          call_uniqueid: 'DB-2',
          disposition: 'timeout',
          direction: 'outbound',
          call_type: 'noanswer',
          user_uid: 7,
        }),
      );
    });

    it('classifies a short numeric destination as direction "internal"', () => {
      state.setAgent(7, 'PJSIP/e101_42', { name: 'Alice', status: 'READY', userId: 42 });

      service.handleDialBegin({ channel: 'PJSIP/e101_42-00000005', destcalleridnum: '105', uniqueid: 'DB-3' });
      service.handleDialEnd({ channel: 'PJSIP/e101_42-00000005', dialstatus: 'BUSY' });

      expect(historyWriter.enqueue).toHaveBeenCalledWith(
        expect.objectContaining({ direction: 'internal', call_type: 'busy' }),
      );
    });

    it('persists an "abandoned" history row when the agent hangs up while still DIALING (no DialEnd)', () => {
      state.setAgent(7, 'PJSIP/e101_42', { name: 'Alice', status: 'READY', userId: 42 });

      service.handleDialBegin({ channel: 'PJSIP/e101_42-00000005', destcalleridnum: '+79990001122', uniqueid: 'DB-4' });
      service.handleAgentHangup({ channel: 'PJSIP/e101_42-00000005' });

      expect(historyWriter.enqueue).toHaveBeenCalledWith(
        expect.objectContaining({
          call_uniqueid: 'DB-4',
          disposition: 'abandoned',
          direction: 'outbound',
          call_type: 'cancel',
        }),
      );
    });

    it('persists a "personal" abandoned history row for a missed direct ring (alongside cc_missed_calls)', async () => {
      state.setAgent(7, 'PJSIP/e101_42', { name: 'Alice', status: 'READY', userId: 42 });

      service.handleNewchannel({
        channel: 'PJSIP/e101_42-00000005',
        channelstatedesc: 'Ring',
        calleridnum: '+79990001122',
        calleridname: 'Ivan',
        uniqueid: 'H-2',
      });
      service.handleAgentHangup({ channel: 'PJSIP/e101_42-00000005', uniqueid: 'H-2' });
      await Promise.resolve();

      expect(historyWriter.enqueue).toHaveBeenCalledWith(
        expect.objectContaining({
          call_uniqueid: 'H-2',
          disposition: 'abandoned',
          direction: 'personal',
          call_type: 'ring',
          caller_id_num: '+79990001122',
        }),
      );
    });

    it('persists an "answered" personal history row once a direct-ring call (no currentCall) ends', () => {
      state.setAgent(7, 'PJSIP/e101_42', { name: 'Alice', status: 'READY', userId: 42 });

      service.handleNewchannel({
        channel: 'PJSIP/e101_42-00000005',
        channelstatedesc: 'Ring',
        calleridnum: '+79990001122',
        calleridname: 'Ivan',
        uniqueid: 'H-3',
      });
      // Simulates QueueMemberStatus reporting the device now in-use (call answered)
      state.setAgent(7, 'PJSIP/e101_42', { status: 'IN_CALL' });

      service.handleAgentHangup({ channel: 'PJSIP/e101_42-00000005' });

      expect(historyWriter.enqueue).toHaveBeenCalledWith(
        expect.objectContaining({
          call_uniqueid: 'H-3',
          disposition: 'answered',
          direction: 'personal',
          call_type: 'ring',
          caller_id_num: '+79990001122',
        }),
      );
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
      state.setCall('U1', { userUid: 7, queue: 'sales_7', answerTime: new Date() });
      service.handleAgentComplete({ queue: 'sales_7', destuniqueid: 'U1', interface: 'PJSIP/101' });

      service.cancelWrapupTimer(7, 'PJSIP/101');
      jest.advanceTimersByTime(30_000);
      // No auto-transition fired — the agent stays in WRAPUP until the manual handler runs
      expect(state.getAgent(7, 'PJSIP/101')?.status).toBe('WRAPUP');
      jest.useRealTimers();
    });
  });

  describe('reconcileActiveAgentCalls', () => {
    it('restores currentCall + CID from CoreShowChannels for IN_CALL without binding', async () => {
      fakeAmi.isConnected = () => true;
      fakeAmi.getActiveChannels.mockResolvedValue({
        events: [
          {
            channel: 'PJSIP/101-0000000a',
            uniqueid: 'AGENT.1',
            linkedid: 'CALLER.1',
            bridgeid: 'BR1',
            connectedlinenum: '79991234567',
          },
          {
            channel: 'PJSIP/trunk-0000000b',
            uniqueid: 'CALLER.1',
            linkedid: 'CALLER.1',
            bridgeid: 'BR1',
            calleridnum: '79991234567',
            calleridname: 'Client',
          },
        ],
      });
      state.setAgent(7, 'PJSIP/101', {
        name: 'Alice',
        status: 'IN_CALL',
        userId: 42,
        queues: ['sales_7'],
      });

      await service.reconcileActiveAgentCalls();

      expect(state.getAgent(7, 'PJSIP/101')?.currentCall).toBe('CALLER.1');
      expect(state.getAgent(7, 'PJSIP/101')?.peerNumber).toBe('79991234567');
      expect(state.getCall('CALLER.1')?.status).toBe('TALKING');
      expect(state.getCall('CALLER.1')?.callerIdNum).toBe('79991234567');
      expect(state.getCall('CALLER.1')?.agent).toBe('PJSIP/101');
      fakeAmi.isConnected = () => false;
    });

    it('no-ops when every busy agent already has a live call binding', async () => {
      fakeAmi.isConnected = () => true;
      fakeAmi.getActiveChannels.mockClear();
      state.setAgent(7, 'PJSIP/101', {
        name: 'Alice',
        status: 'IN_CALL',
        userId: 42,
        currentCall: 'U1',
      });
      state.setCall('U1', { userUid: 7, queue: 'sales_7', status: 'TALKING', agent: 'PJSIP/101' });

      await service.reconcileActiveAgentCalls();

      expect(fakeAmi.getActiveChannels).not.toHaveBeenCalled();
      fakeAmi.isConnected = () => false;
    });
  });
});
