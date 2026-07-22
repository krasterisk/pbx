import { BadRequestException, ForbiddenException, NotFoundException } from '@nestjs/common';
import { CallCenterService } from './callcenter.service';
import { CallCenterStateService } from './callcenter-state.service';

/**
 * Unit tests for the CC business-logic layer.
 *
 * The strategy is to drive a real `CallCenterStateService` (it's a pure
 * in-memory store) and stub the AMI service, the CC AMI helper, and the
 * Sequelize models. This keeps assertions focused on behaviour while
 * still exercising the per-tenant state transitions.
 */
describe('CallCenterService', () => {
  let state: CallCenterStateService;
  let service: CallCenterService;

  // Stubs
  const ami: any = {
    isConnected: jest.fn(() => true),
    queueAdd: jest.fn().mockResolvedValue(undefined),
    queueRemove: jest.fn().mockResolvedValue(undefined),
    queuePause: jest.fn().mockResolvedValue(undefined),
    hangup: jest.fn().mockResolvedValue(undefined),
    action: jest.fn().mockResolvedValue({ response: 'Success' }),
    originate: jest.fn().mockResolvedValue(undefined),
    park: jest.fn().mockResolvedValue({ response: 'Success' }),
    parkedCalls: jest.fn().mockResolvedValue({ events: [] }),
  };
  const ccAmi: any = {
    logAgentEvent: jest.fn().mockResolvedValue(undefined),
    cancelWrapupTimer: jest.fn(),
    extendWrapupTimer: jest.fn(),
  };
  const metricsService: any = {
    resetKpiSinceLogin: jest.fn(),
    getAgentKpi: jest.fn().mockReturnValue({
      sinceLogin: { answered: 0, made: 0, missed: 0 },
      sinceMidnight: { answered: 0, made: 0, missed: 0 },
    }),
    getAgentQueuesKpi: jest.fn().mockReturnValue({}),
  };
  const settingsService: any = {
    getOperatorSettings: jest.fn().mockResolvedValue({
      pickup_enabled: true,
      wrapup_timeout: 30,
      wrapup_extend_step: 30,
      wrapup_autosave_draft: true,
    }),
  };
  const permissionsService: any = {
    getEffective: jest.fn(),
    assert: jest.fn(async (userUid: number, operatorUserId: number, right: string) => {
      const perms = await permissionsService.getEffective(userUid, operatorUserId);
      if (!perms?.[right]) {
        throw new ForbiddenException(`${right} not granted`);
      }
      return perms;
    }),
  };
  const loggerService: any = {
    logAction: jest.fn().mockResolvedValue(undefined),
  };
  const sessionModel: any = {
    create: jest.fn().mockResolvedValue({ uid: 99 }),
    update: jest.fn().mockResolvedValue(undefined),
    findAll: jest.fn().mockResolvedValue([]),
    findOne: jest.fn().mockResolvedValue(null),
  };
  const pauseReasonModel: any = {
    findAll: jest.fn().mockResolvedValue([]),
    findOne: jest.fn(),
    create: jest.fn(),
  };
  const userModel: any = {
    findOne: jest.fn().mockResolvedValue({
      getDataValue: (k: string) =>
        ({ name: 'Alice', login: 'alice', extension: '101' } as any)[k],
    }),
  };
  const missedCallModel: any = {
    create: jest.fn().mockResolvedValue(undefined),
    findOne: jest.fn(),
    findAll: jest.fn().mockResolvedValue([]),
    update: jest.fn().mockResolvedValue([0]),
  };
  const phonebookEntryModel: any = {
    findAll: jest.fn().mockResolvedValue([]),
  };
  const phonebookModel: any = {
    findAll: jest.fn().mockResolvedValue([]),
  };
  const serviceRequestModel: any = {
    findAll: jest.fn().mockResolvedValue([]),
  };
  const agentEventModel: any = {
    findAll: jest.fn().mockResolvedValue([]),
  };
  const queueCallModel: any = {
    findAll: jest.fn().mockResolvedValue([]),
  };

  beforeEach(() => {
    jest.clearAllMocks();
    state = new CallCenterStateService();
    service = new CallCenterService(
      ami,
      state,
      ccAmi,
      metricsService,
      pauseReasonModel,
      sessionModel,
      agentEventModel,
      queueCallModel,
      missedCallModel,
      userModel,
      phonebookEntryModel,
      phonebookModel,
      serviceRequestModel,
      settingsService,
      permissionsService,
      loggerService,
    );
  });

  // ─── Login / logout / pause ─────────────────────────────

  describe('agentLogin', () => {
    it('creates a session, joins queues, and seeds READY state with displayName', async () => {
      const res = await service.agentLogin('PJSIP/101', ['sales', 'support'], 7, 42);

      expect(res).toEqual({ success: true, sessionId: 99 });
      expect(ami.queueAdd).toHaveBeenCalledTimes(2);
      expect(ami.queueAdd).toHaveBeenCalledWith('sales', 'PJSIP/101');

      const agent = state.getAgent(7, 'PJSIP/101');
      expect(agent).toBeDefined();
      expect(agent?.status).toBe('READY');
      expect(agent?.name).toBe('Alice');
      expect(agent?.queues).toEqual(['sales', 'support']);
      expect(ccAmi.logAgentEvent).toHaveBeenCalledWith(
        expect.objectContaining({ eventType: 'LOGIN', userUid: 7, userId: 42 }),
      );
    });

    it('resets sinceLogin KPI counters for a fresh shift (D-11)', async () => {
      await service.agentLogin('PJSIP/101', ['sales'], 7, 42);
      expect(metricsService.resetKpiSinceLogin).toHaveBeenCalledWith(7, 'PJSIP/101');
    });

    it('drops primary SIP twin when logging in with WebRTC companion', async () => {
      await service.agentLogin('PJSIP/ew112_0', ['q700_0'], 0, 58);

      expect(ami.queueRemove).toHaveBeenCalledWith('q700_0', 'PJSIP/e112_0');
      expect(ami.queueAdd).toHaveBeenCalledWith('q700_0', 'PJSIP/ew112_0');
    });
  });

  describe('agentLogout', () => {
    it('removes both WebRTC and primary SIP interfaces from queues', async () => {
      await service.agentLogin('PJSIP/ew112_0', ['q700_0'], 0, 58);
      ami.queueRemove.mockClear();

      await service.agentLogout(0, 58);

      expect(ami.queueRemove).toHaveBeenCalledWith('q700_0', 'PJSIP/ew112_0');
      expect(ami.queueRemove).toHaveBeenCalledWith('q700_0', 'PJSIP/e112_0');
      expect(state.getAgent(0, 'PJSIP/ew112_0')).toBeUndefined();
    });
  });

  describe('getAgentKpi', () => {
    it('resolves the logged-in agent interface from userId and delegates to metricsService', async () => {
      await service.agentLogin('PJSIP/101', ['sales'], 7, 42);

      const result = service.getAgentKpi(7, 42);

      expect(metricsService.getAgentKpi).toHaveBeenCalledWith(7, 'PJSIP/101');
      expect(result).toEqual({
        sinceLogin: { answered: 0, made: 0, missed: 0 },
        sinceMidnight: { answered: 0, made: 0, missed: 0 },
      });
    });

    it('never accepts a client-supplied interface — falls back to an empty lookup when the user is not online (self-scoped, T-09-04-01)', () => {
      service.getAgentKpi(7, 999);

      expect(metricsService.getAgentKpi).toHaveBeenCalledWith(7, '');
    });
  });

  describe('getAgentQueuesKpi', () => {
    it('resolves the logged-in agent interface and queues, delegating to metricsService.getAgentQueuesKpi', async () => {
      await service.agentLogin('PJSIP/101', ['sales', 'support'], 7, 42);

      service.getAgentQueuesKpi(7, 42);

      expect(metricsService.getAgentQueuesKpi).toHaveBeenCalledWith(7, 'PJSIP/101', ['sales', 'support']);
    });

    it('never accepts a client-supplied interface — falls back to an empty lookup when the user is not online (self-scoped)', () => {
      service.getAgentQueuesKpi(7, 999);

      expect(metricsService.getAgentQueuesKpi).toHaveBeenCalledWith(7, '', []);
    });
  });

  describe('relatedQueueInterfaces', () => {
    it('pairs ew* with e*', () => {
      expect(CallCenterService.relatedQueueInterfaces('PJSIP/ew112_0')).toEqual(
        expect.arrayContaining(['PJSIP/ew112_0', 'PJSIP/e112_0']),
      );
      expect(CallCenterService.relatedQueueInterfaces('PJSIP/e112_0')).toEqual(
        expect.arrayContaining(['PJSIP/e112_0', 'PJSIP/ew112_0']),
      );
    });
  });

  describe('agentPause', () => {
    it('throws when agent is not logged in', async () => {
      await expect(service.agentPause(7, 42, 'Lunch')).rejects.toBeInstanceOf(NotFoundException);
    });

    it('marks PAUSED with reason and calls AMI per queue', async () => {
      await service.agentLogin('PJSIP/101', ['sales'], 7, 42);
      await service.agentPause(7, 42, 'Lunch');

      const agent = state.getAgent(7, 'PJSIP/101');
      expect(agent?.status).toBe('PAUSED');
      expect(agent?.pauseReason).toBe('Lunch');
      expect(ami.queuePause).toHaveBeenCalledWith('sales', 'PJSIP/101', true, 'Lunch');
    });
  });

  // ─── Pick Call ──────────────────────────────────────────

  describe('agentPickCall', () => {
    it('rejects when agent is not READY', async () => {
      await service.agentLogin('PJSIP/101', ['sales'], 7, 42);
      // simulate IN_CALL
      state.setAgent(7, 'PJSIP/101', { status: 'IN_CALL' });
      state.setCall('U1', { userUid: 7, queue: 'sales', status: 'WAITING', callerChannel: 'PJSIP/trunk-1' });

      await expect(service.agentPickCall('U1', 7, 42)).rejects.toBeInstanceOf(BadRequestException);
    });

    it('rejects cross-tenant pickup', async () => {
      await service.agentLogin('PJSIP/101', ['sales'], 7, 42);
      state.setCall('UX', { userUid: 99, queue: 'other', status: 'WAITING', callerChannel: 'PJSIP/trunk-1' });

      await expect(service.agentPickCall('UX', 7, 42)).rejects.toBeInstanceOf(BadRequestException);
    });

    it('rejects when the caller channel is not known yet', async () => {
      await service.agentLogin('PJSIP/101', ['sales'], 7, 42);
      state.setCall('U1', { userUid: 7, queue: 'sales', status: 'WAITING' });

      await expect(service.agentPickCall('U1', 7, 42)).rejects.toBeInstanceOf(BadRequestException);
    });

    it('issues an AMI Redirect with the agent extension and returns success', async () => {
      await service.agentLogin('PJSIP/101', ['sales'], 7, 42);
      state.setCall('U1', { userUid: 7, queue: 'sales', status: 'WAITING', callerChannel: 'PJSIP/trunk-1' });

      const res = await service.agentPickCall('U1', 7, 42);
      expect(res).toEqual({ success: true, uniqueid: 'U1', target: '101' });
      expect(ami.action).toHaveBeenCalledWith(
        expect.objectContaining({
          action: 'Redirect',
          channel: 'PJSIP/trunk-1',
          context: 'from-internal',
          exten: '101',
        }),
      );
    });

    it('throws ForbiddenException when pickup_enabled is false', async () => {
      settingsService.getOperatorSettings.mockResolvedValue({
        pickup_enabled: false,
        wrapup_timeout: 30,
        wrapup_extend_step: 30,
        wrapup_autosave_draft: true,
      });
      await service.agentLogin('PJSIP/101', ['sales'], 7, 42);
      state.setCall('U1', { userUid: 7, queue: 'sales', status: 'WAITING', callerChannel: 'PJSIP/trunk-1' });

      await expect(service.agentPickCall('U1', 7, 42)).rejects.toBeInstanceOf(ForbiddenException);
      expect(ami.action).not.toHaveBeenCalled();
      // restore default for subsequent tests
      settingsService.getOperatorSettings.mockResolvedValue({
        pickup_enabled: true,
        wrapup_timeout: 30,
        wrapup_extend_step: 30,
        wrapup_autosave_draft: true,
      });
    });

    it('allows pickup when pickup_enabled is true', async () => {
      settingsService.getOperatorSettings.mockResolvedValueOnce({
        pickup_enabled: true,
        wrapup_timeout: 30,
        wrapup_extend_step: 30,
        wrapup_autosave_draft: true,
      });
      await service.agentLogin('PJSIP/101', ['sales'], 7, 42);
      state.setCall('U1', { userUid: 7, queue: 'sales', status: 'WAITING', callerChannel: 'PJSIP/trunk-1' });

      await service.agentPickCall('U1', 7, 42);
      expect(ami.action).toHaveBeenCalled();
    });
  });

  // ─── Blind transfer uses callerChannel (not CallerID) ───

  describe('agentTransfer', () => {
    it('Redirect uses Asterisk channel name, not CallerID number', async () => {
      await service.agentLogin('PJSIP/201', ['sales'], 7, 42);
      state.setCall('U-xfer-1', {
        callerIdNum: '79990001122',
        callerIdName: 'Caller',
        callerChannel: 'PJSIP/trunk-000001',
        queue: 'sales',
        status: 'TALKING',
        enterTime: new Date(),
        answerTime: new Date(),
        holdTime: 0,
        talkTime: 0,
        userUid: 7,
      });

      await service.agentTransfer(
        { type: 'blind', uniqueid: 'U-xfer-1', target: '201' } as any,
        7,
        42,
      );

      expect(ami.action).toHaveBeenCalledWith(
        expect.objectContaining({
          action: 'Redirect',
          channel: 'PJSIP/trunk-000001',
          exten: '201',
        }),
      );
      expect(ami.action).not.toHaveBeenCalledWith(
        expect.objectContaining({ channel: '79990001122' }),
      );
    });

    it('throws ForbiddenException for target not in tenant', async () => {
      await service.agentLogin('PJSIP/101', ['sales'], 7, 42);
      state.setCall('U-xfer-3', {
        callerIdNum: '79990001122',
        callerChannel: 'PJSIP/trunk-000001',
        queue: 'sales',
        status: 'TALKING',
        userUid: 7,
      });

      await expect(
        service.agentTransfer(
          { type: 'blind', uniqueid: 'U-xfer-3', target: '999' } as any,
          7,
          42,
        ),
      ).rejects.toBeInstanceOf(ForbiddenException);
      expect(ami.action).not.toHaveBeenCalled();
    });

    it('allows transfer to a known queue in tenant', async () => {
      await service.agentLogin('PJSIP/101', ['sales'], 7, 42);
      state.setQueue(7, 'support', { name: 'support', displayName: 'Support', userUid: 7 });
      state.setCall('U-xfer-4', {
        callerIdNum: '79990001122',
        callerChannel: 'PJSIP/trunk-000001',
        queue: 'sales',
        status: 'TALKING',
        userUid: 7,
      });

      await service.agentTransfer(
        { type: 'blind', uniqueid: 'U-xfer-4', target: 'support' } as any,
        7,
        42,
      );

      expect(ami.action).toHaveBeenCalled();
    });

    it('throws when callerChannel is missing', async () => {
      await service.agentLogin('PJSIP/101', ['sales'], 7, 42);
      state.setCall('U-xfer-2', {
        callerIdNum: '79990001122',
        callerIdName: 'Caller',
        queue: 'sales',
        status: 'TALKING',
        enterTime: new Date(),
        holdTime: 0,
        talkTime: 0,
        userUid: 7,
      });

      await expect(
        service.agentTransfer(
          { type: 'blind', uniqueid: 'U-xfer-2', target: '101' } as any,
          7,
          42,
        ),
      ).rejects.toBeInstanceOf(BadRequestException);
    });
  });

  // ─── Missed calls ───────────────────────────────────────

  describe('markMissedCalled', () => {
    it('marks the row and emits a missedCallUpdate SSE event', async () => {
      const update = jest.fn().mockResolvedValue(undefined);
      missedCallModel.findOne.mockResolvedValueOnce({ uid: 5, update });
      const events: any[] = [];
      state.getEventStream(7).subscribe(e => events.push(e));

      const res = await service.markMissedCalled(5, 'Called back at 12:30', 7, 42);

      expect(res).toEqual({ success: true });
      expect(update).toHaveBeenCalledWith(expect.objectContaining({
        called_back: true,
        called_back_by: 42,
        note: 'Called back at 12:30',
      }));
      expect(events.some(e => e.type === 'missedCallUpdate')).toBe(true);
    });

    it('throws NotFoundException when the row does not belong to the tenant', async () => {
      missedCallModel.findOne.mockResolvedValueOnce(null);
      await expect(service.markMissedCalled(5, undefined, 7, 42)).rejects.toBeInstanceOf(NotFoundException);
    });
  });

  describe('getMissedCallsGrouped', () => {
    it('groups by caller_id_num + personal, excluding resolved rows (D-16/D-19)', async () => {
      missedCallModel.findAll.mockResolvedValueOnce([
        {
          caller_id_num: '79990001122',
          personal: 0,
          attemptCount: '3',
          lastAttemptAt: '2026-07-20T10:00:00.000Z',
          claimedBy: 42,
          callerIdName: 'Ivan',
          queueName: 'sales',
        },
        {
          caller_id_num: '79990003344',
          personal: 1,
          attemptCount: '1',
          lastAttemptAt: '2026-07-21T09:00:00.000Z',
          claimedBy: null,
          callerIdName: '',
          queueName: 'direct:PJSIP/101',
        },
      ]);

      const result = await service.getMissedCallsGrouped(7);

      expect(missedCallModel.findAll).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            user_uid: 7,
            called_back: false,
            client_called_back: false,
          }),
          group: expect.arrayContaining(['caller_id_num', 'personal']),
        }),
      );
      expect(result).toEqual([
        {
          callerIdNum: '79990001122',
          callerIdName: 'Ivan',
          personal: false,
          attemptCount: 3,
          lastAttemptAt: '2026-07-20T10:00:00.000Z',
          claimedBy: 42,
          queueName: 'sales',
        },
        {
          callerIdNum: '79990003344',
          callerIdName: '',
          personal: true,
          attemptCount: 1,
          lastAttemptAt: '2026-07-21T09:00:00.000Z',
          claimedBy: null,
          queueName: 'direct:PJSIP/101',
        },
      ]);
    });
  });

  describe('claimMissedCall', () => {
    it('assigns the queue-missed pool group to the claiming operator', async () => {
      missedCallModel.update.mockResolvedValueOnce([2]);
      const events: any[] = [];
      state.getEventStream(7).subscribe(e => events.push(e));

      const res = await service.claimMissedCall(7, 42, '79990001122');

      expect(missedCallModel.update).toHaveBeenCalledWith(
        { called_back_by: 42 },
        expect.objectContaining({
          where: expect.objectContaining({
            user_uid: 7,
            caller_id_num: '79990001122',
            personal: false,
            called_back: false,
          }),
        }),
      );
      expect(res).toEqual({ success: true, claimed: 2 });
      expect(events.some(e => e.type === 'missedCallUpdate' && e.data.claimedBy === 42)).toBe(true);
    });

    it('is idempotent — re-claim by a different operator overwrites (server is source of truth)', async () => {
      missedCallModel.update.mockResolvedValueOnce([1]);
      await service.claimMissedCall(7, 42, '79990001122');
      missedCallModel.update.mockResolvedValueOnce([1]);
      const res = await service.claimMissedCall(7, 99, '79990001122');

      expect(missedCallModel.update).toHaveBeenLastCalledWith(
        { called_back_by: 99 },
        expect.objectContaining({ where: expect.objectContaining({ caller_id_num: '79990001122' }) }),
      );
      expect(res).toEqual({ success: true, claimed: 1 });
    });

    it('throws BadRequestException when callerIdNum is missing', async () => {
      await expect(service.claimMissedCall(7, 42, '')).rejects.toBeInstanceOf(BadRequestException);
    });
  });

  describe('autoResolveOnAnswer', () => {
    it('tags open missed rows as client_called_back when the client rings back and connects (D-17)', async () => {
      missedCallModel.update.mockResolvedValueOnce([1]);
      const events: any[] = [];
      state.getEventStream(7).subscribe(e => events.push(e));

      await service.autoResolveOnAnswer(7, '79990001122');

      expect(missedCallModel.update).toHaveBeenCalledWith(
        { client_called_back: true },
        expect.objectContaining({
          where: expect.objectContaining({
            user_uid: 7,
            caller_id_num: '79990001122',
            called_back: false,
            client_called_back: false,
          }),
        }),
      );
      expect(events.some(e => e.type === 'missedCallUpdate' && e.data.clientCalledBack === true)).toBe(true);
    });

    it('does not emit when nothing matched', async () => {
      missedCallModel.update.mockResolvedValueOnce([0]);
      const events: any[] = [];
      state.getEventStream(7).subscribe(e => events.push(e));

      await service.autoResolveOnAnswer(7, '79990009999');

      expect(events.some(e => e.type === 'missedCallUpdate')).toBe(false);
    });

    it('is a no-op when callerIdNum is empty', async () => {
      await service.autoResolveOnAnswer(7, '');
      expect(missedCallModel.update).not.toHaveBeenCalled();
    });
  });

  // ─── Wrap-up done cancels timer ─────────────────────────

  describe('agentWrapupDone', () => {
    it('cancels the wrap-up timer and sets READY', async () => {
      await service.agentLogin('PJSIP/101', ['sales'], 7, 42);
      state.setAgent(7, 'PJSIP/101', { status: 'WRAPUP', currentCall: 'U1' });

      await service.agentWrapupDone(7, 42);

      expect(ccAmi.cancelWrapupTimer).toHaveBeenCalledWith(7, 'PJSIP/101');
      expect(state.getAgent(7, 'PJSIP/101')?.status).toBe('READY');
      expect(state.getAgent(7, 'PJSIP/101')?.currentCall).toBeUndefined();
    });
  });

  describe('agentWrapupExtend', () => {
    it('calls extendWrapupTimer with wrapup_extend_step when seconds not provided', async () => {
      settingsService.getOperatorSettings.mockResolvedValue({
        pickup_enabled: true,
        wrapup_timeout: 30,
        wrapup_extend_step: 45,
        wrapup_autosave_draft: true,
      });
      await service.agentLogin('PJSIP/101', ['sales'], 7, 42);
      state.setAgent(7, 'PJSIP/101', { status: 'WRAPUP' });

      const res = await service.agentWrapupExtend(7, 42);

      expect(res).toEqual({ success: true });
      expect(ccAmi.extendWrapupTimer).toHaveBeenCalledWith(7, 'PJSIP/101', 45);
      settingsService.getOperatorSettings.mockResolvedValue({
        pickup_enabled: true,
        wrapup_timeout: 30,
        wrapup_extend_step: 30,
        wrapup_autosave_draft: true,
      });
    });
  });

  // ─── Supervisor RBAC indirectly via spy formatting ──────

  describe('supervisorSpy', () => {
    it('formats an Originate with the correct ChanSpy option per mode', async () => {
      state.setAgent(7, 'PJSIP/101', { name: 'Alice', status: 'IN_CALL' });

      await service.supervisorSpy('PJSIP/101', 'whisper', 7, 1);

      expect(ami.originate).toHaveBeenCalledWith(
        expect.stringMatching(/^PJSIP\//),
        expect.stringContaining('Spy on'),
        'from-internal',
        'ChanSpy(PJSIP/101,w)',
      );
    });

    it('throws if the agent is not in a call', async () => {
      state.setAgent(7, 'PJSIP/101', { name: 'Alice', status: 'READY' });
      await expect(service.supervisorSpy('PJSIP/101', 'spy', 7, 1)).rejects.toBeInstanceOf(BadRequestException);
    });
  });

  // ─── Peer ChanSpy (D-21…D-25) ────────────────────────────

  describe('peerSpy', () => {
    const REQUESTER_ID = 10;
    const TARGET_ID = 20;

    function fullPerms(overrides: Record<string, any> = {}) {
      return {
        can_spy: true,
        spyable: true,
        spy_modes: ['listen'],
        click_to_call: false,
        customize_ui: false,
        ...overrides,
      };
    }

    function mockPerms(opts: { requester?: Record<string, any>; target?: Record<string, any> } = {}) {
      permissionsService.getEffective.mockImplementation((_userUid: number, operatorUserId: number) => {
        if (operatorUserId === TARGET_ID) {
          return Promise.resolve(fullPerms({ can_spy: false, ...opts.target }));
        }
        return Promise.resolve(fullPerms(opts.requester));
      });
    }

    beforeEach(() => {
      state.setAgent(7, 'PJSIP/req', {
        name: 'Requester',
        status: 'READY',
        queues: ['sales'],
        userId: REQUESTER_ID,
        userUid: 7,
      });
      state.setAgent(7, 'PJSIP/target', {
        name: 'Target',
        status: 'IN_CALL',
        queues: ['sales'],
        userId: TARGET_ID,
        userUid: 7,
      });
    });

    it('writes the audit log before AMI originate, and originates ChanSpy with the correct listen option', async () => {
      mockPerms();
      const result = await service.peerSpy(REQUESTER_ID, 'PJSIP/target', 'listen', 7);

      expect(result).toEqual({ success: true, mode: 'listen' });
      expect(loggerService.logAction).toHaveBeenCalledWith(
        REQUESTER_ID,
        'peer_spy',
        'cc_agent',
        TARGET_ID,
        7,
        expect.stringContaining('listen'),
      );
      expect(ami.originate).toHaveBeenCalledWith(
        'PJSIP/req',
        expect.stringContaining('Peer spy on'),
        'from-internal',
        'ChanSpy(PJSIP/target,q)',
      );

      const logOrder = loggerService.logAction.mock.invocationCallOrder[0];
      const originateOrder = ami.originate.mock.invocationCallOrder[0];
      expect(logOrder).toBeLessThan(originateOrder);
    });

    it('rejects with BadRequest when the target agent is not IN_CALL', async () => {
      state.setAgent(7, 'PJSIP/target', { status: 'READY' });
      mockPerms();
      await expect(
        service.peerSpy(REQUESTER_ID, 'PJSIP/target', 'listen', 7),
      ).rejects.toBeInstanceOf(BadRequestException);
      expect(ami.originate).not.toHaveBeenCalled();
    });

    it('rejects with Forbidden when requester and target share no online queue', async () => {
      state.setAgent(7, 'PJSIP/target', { queues: ['support'] });
      mockPerms();
      await expect(
        service.peerSpy(REQUESTER_ID, 'PJSIP/target', 'listen', 7),
      ).rejects.toBeInstanceOf(ForbiddenException);
      expect(ami.originate).not.toHaveBeenCalled();
    });

    it('rejects with Forbidden when the target is not spyable', async () => {
      mockPerms({ target: { spyable: false } });
      await expect(
        service.peerSpy(REQUESTER_ID, 'PJSIP/target', 'listen', 7),
      ).rejects.toBeInstanceOf(ForbiddenException);
      expect(ami.originate).not.toHaveBeenCalled();
    });

    it('rejects with Forbidden when the requester lacks can_spy', async () => {
      mockPerms({ requester: { can_spy: false } });
      await expect(
        service.peerSpy(REQUESTER_ID, 'PJSIP/target', 'listen', 7),
      ).rejects.toBeInstanceOf(ForbiddenException);
      expect(ami.originate).not.toHaveBeenCalled();
    });

    it('rejects with Forbidden when the mode is not in the requester spy_modes', async () => {
      mockPerms({ requester: { spy_modes: ['listen'] } });
      await expect(
        service.peerSpy(REQUESTER_ID, 'PJSIP/target', 'whisper', 7),
      ).rejects.toBeInstanceOf(ForbiddenException);
      expect(ami.originate).not.toHaveBeenCalled();
    });

    it('rejects a cross-tenant target (agent registered under a different tenant is simply not found)', async () => {
      state.setAgent(99, 'PJSIP/other-tenant-target', {
        name: 'OtherTenantTarget',
        status: 'IN_CALL',
        queues: ['sales'],
        userId: 30,
        userUid: 99,
      });
      mockPerms();
      await expect(
        service.peerSpy(REQUESTER_ID, 'PJSIP/other-tenant-target', 'listen', 7),
      ).rejects.toBeInstanceOf(NotFoundException);
      expect(ami.originate).not.toHaveBeenCalled();
    });

    it('rejects when the requester agent is not logged in', async () => {
      mockPerms();
      await expect(
        service.peerSpy(999, 'PJSIP/target', 'listen', 7),
      ).rejects.toBeInstanceOf(NotFoundException);
      expect(ami.originate).not.toHaveBeenCalled();
    });
  });

  // ─── Supervisor redirect / agent detail (07-09) ─────────

  describe('supervisorRedirectCall', () => {
    it('rejects redirect when call belongs to another tenant', async () => {
      state.setCall('C1', {
        uniqueid: 'C1',
        userUid: 999,
        callerChannel: 'SIP/1001-0001',
        status: 'WAITING',
        queue: 'sales',
        callerIdNum: '1001',
        callerIdName: '',
        enterTime: new Date(),
        holdTime: 0,
        talkTime: 0,
      });

      await expect(
        service.supervisorRedirectCall('C1', 'PJSIP/101', 7),
      ).rejects.toThrow('Call belongs to another tenant');
      expect(ami.action).not.toHaveBeenCalled();
    });

    it('redirects caller channel for valid tenant', async () => {
      state.setCall('C1', {
        uniqueid: 'C1',
        userUid: 7,
        callerChannel: 'SIP/1001-0001',
        status: 'WAITING',
        queue: 'sales',
        callerIdNum: '1001',
        callerIdName: '',
        enterTime: new Date(),
        holdTime: 0,
        talkTime: 0,
      });

      const res = await service.supervisorRedirectCall('C1', 'PJSIP/101', 7);
      expect(res.success).toBe(true);
      expect(ami.action).toHaveBeenCalledWith(
        expect.objectContaining({
          action: 'Redirect',
          channel: 'SIP/1001-0001',
        }),
      );
    });
  });

  // ─── Call Control (D-27/D-28/D-29/D-33) ─────────────────

  describe('parkCall', () => {
    it('rejects when agent is not logged in', async () => {
      await expect(service.parkCall('U1', 7, 42)).rejects.toBeInstanceOf(NotFoundException);
    });

    it('rejects cross-tenant call', async () => {
      await service.agentLogin('PJSIP/101', ['sales'], 7, 42);
      state.setCall('U1', { userUid: 99, queue: 'sales', status: 'TALKING', callerChannel: 'PJSIP/trunk-1', agent: 'PJSIP/101' });

      await expect(service.parkCall('U1', 7, 42)).rejects.toBeInstanceOf(BadRequestException);
      expect(ami.action).not.toHaveBeenCalled();
    });

    it("rejects a coworker's call (own-call ownership guard)", async () => {
      await service.agentLogin('PJSIP/101', ['sales'], 7, 42);
      state.setCall('U1', { userUid: 7, queue: 'sales', status: 'TALKING', callerChannel: 'PJSIP/trunk-1', agent: 'PJSIP/other' });

      await expect(service.parkCall('U1', 7, 42)).rejects.toBeInstanceOf(ForbiddenException);
    });

    it('parks the caller channel and returns the parking space', async () => {
      ami.park.mockResolvedValueOnce({ response: 'Success', exten: '71' });
      await service.agentLogin('PJSIP/101', ['sales'], 7, 42);
      state.setCall('U1', { userUid: 7, queue: 'sales', status: 'TALKING', callerChannel: 'PJSIP/trunk-1', agent: 'PJSIP/101' });

      const res = await service.parkCall('U1', 7, 42);

      expect(res).toEqual({ success: true, uniqueid: 'U1', parkingSpace: '71' });
      expect(ami.park).toHaveBeenCalledWith('PJSIP/trunk-1');
      expect(state.getCall('U1')?.status).toBe('HOLD');
    });

    it('emits a parkedCallsUpdate SSE delta for other operators (D-45, 09-10)', async () => {
      ami.park.mockResolvedValueOnce({ response: 'Success', exten: '71' });
      await service.agentLogin('PJSIP/101', ['sales'], 7, 42);
      state.setCall('U1', { userUid: 7, queue: 'sales', status: 'TALKING', callerChannel: 'PJSIP/trunk-1', agent: 'PJSIP/101' });
      const events: any[] = [];
      state.getEventStream(7).subscribe(e => events.push(e));

      await service.parkCall('U1', 7, 42);

      expect(events.some(e => e.type === 'parkedCallsUpdate' && e.data.parkingSpace === '71')).toBe(true);
    });
  });

  describe('retrieveParkedCall', () => {
    it('rejects when agent is not logged in', async () => {
      await expect(service.retrieveParkedCall('71', 7, 42)).rejects.toBeInstanceOf(NotFoundException);
    });

    it('originates the agent interface into the parking lot context', async () => {
      await service.agentLogin('PJSIP/101', ['sales'], 7, 42);

      const res = await service.retrieveParkedCall('71', 7, 42);

      expect(res).toEqual({ success: true, parkingSpace: '71' });
      expect(ami.originate).toHaveBeenCalledWith(
        'PJSIP/101',
        expect.stringContaining('71'),
        'parkedcalls',
        '71',
      );
    });

    it('emits a parkedCallsUpdate SSE delta for other operators (D-45, 09-10)', async () => {
      await service.agentLogin('PJSIP/101', ['sales'], 7, 42);
      const events: any[] = [];
      state.getEventStream(7).subscribe(e => events.push(e));

      await service.retrieveParkedCall('71', 7, 42);

      expect(events.some(e => e.type === 'parkedCallsUpdate' && e.data.action === 'retrieved')).toBe(true);
    });
  });

  describe('getParkedCalls', () => {
    it('rejects when agent is not logged in', async () => {
      await expect(service.getParkedCalls(7, 42)).rejects.toBeInstanceOf(NotFoundException);
    });

    it('maps ParkedCall AMI events into the ParkedCallsIndicator shape', async () => {
      await service.agentLogin('PJSIP/101', ['sales'], 7, 42);
      ami.parkedCalls.mockResolvedValueOnce({
        events: [
          { event: 'ParkedCall', exten: '71', calleridnum: '79990001122', calleridname: 'Ivan', channel: 'PJSIP/trunk-1', timeout: '45' },
        ],
      });

      const res = await service.getParkedCalls(7, 42);

      expect(res).toEqual([
        { parkingSpace: '71', callerIdNum: '79990001122', callerIdName: 'Ivan', channel: 'PJSIP/trunk-1', timeoutSec: 45 },
      ]);
    });

    it('returns an empty list when the AMI query fails rather than throwing', async () => {
      await service.agentLogin('PJSIP/101', ['sales'], 7, 42);
      ami.parkedCalls.mockRejectedValueOnce(new Error('AMI not connected'));

      const res = await service.getParkedCalls(7, 42);

      expect(res).toEqual([]);
    });
  });

  describe('addToConference', () => {
    it('rejects cross-tenant call', async () => {
      await service.agentLogin('PJSIP/101', ['sales'], 7, 42);
      state.setCall('U1', {
        userUid: 99, queue: 'sales', status: 'TALKING',
        callerChannel: 'PJSIP/trunk-1', agentChannel: 'PJSIP/101-1', agent: 'PJSIP/101',
      });

      await expect(service.addToConference('U1', '201', 7, 42)).rejects.toBeInstanceOf(BadRequestException);
    });

    it("rejects a coworker's call", async () => {
      await service.agentLogin('PJSIP/101', ['sales'], 7, 42);
      state.setCall('U1', {
        userUid: 7, queue: 'sales', status: 'TALKING',
        callerChannel: 'PJSIP/trunk-1', agentChannel: 'PJSIP/101-1', agent: 'PJSIP/other',
      });

      await expect(service.addToConference('U1', '201', 7, 42)).rejects.toBeInstanceOf(ForbiddenException);
    });

    it('rejects when agent channel is not known yet', async () => {
      await service.agentLogin('PJSIP/101', ['sales'], 7, 42);
      state.setCall('U1', { userUid: 7, queue: 'sales', status: 'TALKING', callerChannel: 'PJSIP/trunk-1', agent: 'PJSIP/101' });

      await expect(service.addToConference('U1', '201', 7, 42)).rejects.toBeInstanceOf(BadRequestException);
    });

    it('redirects both bridged legs into the same ConfBridge room and originates the target', async () => {
      await service.agentLogin('PJSIP/101', ['sales'], 7, 42);
      state.setCall('U1', {
        userUid: 7, queue: 'sales', status: 'TALKING',
        callerChannel: 'PJSIP/trunk-1', agentChannel: 'PJSIP/101-1', agent: 'PJSIP/101',
      });

      const res = await service.addToConference('U1', 'PJSIP/201', 7, 42);

      expect(res).toEqual({ success: true, room: 'U1', target: '201' });
      expect(ami.action).toHaveBeenCalledWith(
        expect.objectContaining({
          action: 'Redirect',
          channel: 'PJSIP/trunk-1',
          extrachannel: 'PJSIP/101-1',
          exten: 'ConfBridge(U1)',
        }),
      );
      expect(ami.originate).toHaveBeenCalledWith(
        'PJSIP/201',
        expect.stringContaining('Conference'),
        'from-internal',
        'ConfBridge(U1)',
      );
      expect(state.getCall('U1')?.status).toBe('TALKING');
    });
  });

  describe('resetZombieCall', () => {
    it('rejects when agent is not logged in', async () => {
      await expect(service.resetZombieCall('U1', 7, 42)).rejects.toBeInstanceOf(NotFoundException);
    });

    it('rejects cross-tenant call', async () => {
      await service.agentLogin('PJSIP/101', ['sales'], 7, 42);
      state.setCall('U1', { userUid: 99, queue: 'sales', status: 'TALKING', agent: 'PJSIP/101' });

      await expect(service.resetZombieCall('U1', 7, 42)).rejects.toBeInstanceOf(BadRequestException);
    });

    it("rejects a coworker's call (D-27 own-call only, anti-griefing)", async () => {
      await service.agentLogin('PJSIP/101', ['sales'], 7, 42);
      state.setCall('U1', { userUid: 7, queue: 'sales', status: 'TALKING', agent: 'PJSIP/other' });

      await expect(service.resetZombieCall('U1', 7, 42)).rejects.toBeInstanceOf(ForbiddenException);
      expect(ami.hangup).not.toHaveBeenCalled();
    });

    it('hangs up the stuck channel, clears state, and audit-logs the reset', async () => {
      await service.agentLogin('PJSIP/101', ['sales'], 7, 42);
      state.setAgent(7, 'PJSIP/101', { status: 'IN_CALL', currentCall: 'U1' });
      state.setCall('U1', { userUid: 7, queue: 'sales', status: 'TALKING', callerChannel: 'PJSIP/trunk-1', agent: 'PJSIP/101' });

      const res = await service.resetZombieCall('U1', 7, 42);

      expect(res).toEqual({ success: true, uniqueid: 'U1' });
      expect(ami.hangup).toHaveBeenCalledWith('PJSIP/trunk-1');
      expect(state.getCall('U1')).toBeUndefined();
      expect(state.getAgent(7, 'PJSIP/101')?.status).toBe('READY');
      expect(loggerService.logAction).toHaveBeenCalledWith(
        42, 'zombie_reset', 'cc_call', null, 7, expect.stringContaining('U1'),
      );
    });

    it('still clears state when the AMI hangup itself fails', async () => {
      await service.agentLogin('PJSIP/101', ['sales'], 7, 42);
      state.setCall('U1', { userUid: 7, queue: 'sales', status: 'TALKING', callerChannel: 'PJSIP/trunk-1', agent: 'PJSIP/101' });
      ami.hangup.mockRejectedValueOnce(new Error('No such channel'));

      const res = await service.resetZombieCall('U1', 7, 42);

      expect(res).toEqual({ success: true, uniqueid: 'U1' });
      expect(state.getCall('U1')).toBeUndefined();
    });
  });

  describe('warmTransferToQueue', () => {
    it('rejects an unknown target queue', async () => {
      await service.agentLogin('PJSIP/101', ['sales'], 7, 42);
      state.setCall('U1', { userUid: 7, queue: 'sales', status: 'TALKING', callerChannel: 'PJSIP/trunk-1', agent: 'PJSIP/101' });

      await expect(service.warmTransferToQueue('U1', 'ghost-queue', 7, 42)).rejects.toBeInstanceOf(BadRequestException);
    });

    it("rejects a coworker's call", async () => {
      await service.agentLogin('PJSIP/101', ['sales'], 7, 42);
      state.setQueue(7, 'support', { name: 'support', displayName: 'Support', userUid: 7 });
      state.setCall('U1', { userUid: 7, queue: 'sales', status: 'TALKING', callerChannel: 'PJSIP/trunk-1', agent: 'PJSIP/other' });

      await expect(service.warmTransferToQueue('U1', 'support', 7, 42)).rejects.toBeInstanceOf(ForbiddenException);
    });

    it('redirects the caller channel into the target queue', async () => {
      await service.agentLogin('PJSIP/101', ['sales'], 7, 42);
      state.setQueue(7, 'support', { name: 'support', displayName: 'Support', userUid: 7 });
      state.setCall('U1', { userUid: 7, queue: 'sales', status: 'TALKING', callerChannel: 'PJSIP/trunk-1', agent: 'PJSIP/101' });

      const res = await service.warmTransferToQueue('U1', 'support', 7, 42);

      expect(res).toEqual({ success: true, uniqueid: 'U1', queue: 'support' });
      expect(ami.action).toHaveBeenCalledWith(
        expect.objectContaining({ action: 'Redirect', channel: 'PJSIP/trunk-1', exten: 'support' }),
      );
      expect(state.getCall('U1')?.status).toBe('TRANSFERRED');
    });
  });

  describe('clickToCall', () => {
    it('rejects when agent is not logged in', async () => {
      await expect(service.clickToCall('79990001122', 7, 42)).rejects.toBeInstanceOf(NotFoundException);
    });

    it('throws Forbidden when click_to_call permission is not granted', async () => {
      await service.agentLogin('PJSIP/101', ['sales'], 7, 42);
      permissionsService.getEffective.mockResolvedValue({
        can_spy: false, spyable: true, spy_modes: [], click_to_call: false, customize_ui: false,
      });

      await expect(service.clickToCall('79990001122', 7, 42)).rejects.toBeInstanceOf(ForbiddenException);
      expect(ami.action).not.toHaveBeenCalled();
    });

    it('WebRTC companion dials directly — no AMI Originate issued', async () => {
      await service.agentLogin('PJSIP/ew112_0', ['q700_0'], 0, 58);
      permissionsService.getEffective.mockResolvedValue({
        can_spy: false, spyable: true, spy_modes: [], click_to_call: true, customize_ui: false,
      });

      const res = await service.clickToCall('79990001122', 0, 58);

      expect(res).toEqual({ success: true, mode: 'webrtc', target: '79990001122' });
      expect(ami.action).not.toHaveBeenCalled();
    });

    it('PJSIP client originates the operator leg with an auto-answer Call-Info header', async () => {
      await service.agentLogin('PJSIP/101', ['sales'], 7, 42);
      permissionsService.getEffective.mockResolvedValue({
        can_spy: false, spyable: true, spy_modes: [], click_to_call: true, customize_ui: false,
      });

      const res = await service.clickToCall('79990001122', 7, 42);

      expect(res).toEqual({ success: true, mode: 'pjsip', target: '79990001122' });
      expect(ami.action).toHaveBeenCalledWith(
        expect.objectContaining({
          action: 'Originate',
          channel: 'PJSIP/101',
          exten: '79990001122',
          variable: expect.stringContaining('Call-Info'),
        }),
      );
    });
  });

  describe('callbackMissedCall', () => {
    beforeEach(() => {
      // Fake timers so trackCallbackOutcome's 120s give-up setTimeout never
      // holds a real handle open after the test ends (discarded cleanly by
      // useRealTimers below); Date.now() advances with jest.advanceTimersByTime.
      jest.useFakeTimers();
      permissionsService.getEffective.mockResolvedValue({
        can_spy: false, spyable: true, spy_modes: [], click_to_call: true, customize_ui: false,
      });
    });

    afterEach(() => {
      jest.useRealTimers();
    });

    it('rejects when agent is not logged in', async () => {
      await expect(service.callbackMissedCall(7, 42, '79990001122')).rejects.toBeInstanceOf(NotFoundException);
    });

    it('throws BadRequestException when callerIdNum is missing', async () => {
      await service.agentLogin('PJSIP/101', ['sales'], 7, 42);
      await expect(service.callbackMissedCall(7, 42, '')).rejects.toBeInstanceOf(BadRequestException);
    });

    it('throws Forbidden when click_to_call permission is not granted', async () => {
      await service.agentLogin('PJSIP/101', ['sales'], 7, 42);
      permissionsService.getEffective.mockResolvedValue({
        can_spy: false, spyable: true, spy_modes: [], click_to_call: false, customize_ui: false,
      });

      await expect(service.callbackMissedCall(7, 42, '79990001122')).rejects.toBeInstanceOf(ForbiddenException);
      expect(ami.action).not.toHaveBeenCalled();
    });

    it('dials via the clickToCall branching — same scheme, not duplicated (D-18/D-29)', async () => {
      await service.agentLogin('PJSIP/101', ['sales'], 7, 42);

      const res = await service.callbackMissedCall(7, 42, '79990001122');

      expect(res).toEqual({ success: true, mode: 'pjsip', target: '79990001122' });
      expect(ami.action).toHaveBeenCalledWith(
        expect.objectContaining({ action: 'Originate', channel: 'PJSIP/101', exten: '79990001122' }),
      );
    });

    it('marks the number called_back when the connect exceeds 5s (D-18)', async () => {
      await service.agentLogin('PJSIP/101', ['sales'], 7, 42);
      await service.callbackMissedCall(7, 42, '79990001122');

      state.setAgent(7, 'PJSIP/101', { status: 'IN_CALL' });
      jest.advanceTimersByTime(7_000);
      state.setAgent(7, 'PJSIP/101', { status: 'READY' });
      await Promise.resolve();
      await Promise.resolve();

      expect(missedCallModel.update).toHaveBeenCalledWith(
        expect.objectContaining({ called_back: true, called_back_by: 42 }),
        expect.objectContaining({
          where: expect.objectContaining({ caller_id_num: '79990001122', user_uid: 7, called_back: false }),
        }),
      );
    });

    it('creates a new attempt row and leaves the group active when the connect is <=5s (D-18)', async () => {
      await service.agentLogin('PJSIP/101', ['sales'], 7, 42);
      await service.callbackMissedCall(7, 42, '79990001122');

      state.setAgent(7, 'PJSIP/101', { status: 'IN_CALL' });
      jest.advanceTimersByTime(2_000);
      state.setAgent(7, 'PJSIP/101', { status: 'READY' });
      await Promise.resolve();
      await Promise.resolve();

      expect(missedCallModel.create).toHaveBeenCalledWith(
        expect.objectContaining({ caller_id_num: '79990001122', called_back: false, user_uid: 7 }),
      );
      expect(missedCallModel.update).not.toHaveBeenCalled();
    });
  });

  describe('getAgentDetail', () => {
    it('aggregates stats and builds timeline segments from history', async () => {
      const t0 = new Date('2026-07-15T08:00:00Z');
      const t1 = new Date('2026-07-15T09:00:00Z');

      sessionModel.findAll.mockResolvedValue([{ uid: 10 }]);
      queueCallModel.findAll.mockResolvedValue([
        { disposition: 'answered', talk_time: 120, hold_time: 5 },
        { disposition: 'answered', talk_time: 60, hold_time: 0 },
        { disposition: 'abandoned', talk_time: 0, hold_time: 0 },
      ]);
      agentEventModel.findAll.mockResolvedValue([
        { event_type: 'LOGIN', created_at: t0, reason: '' },
        { event_type: 'PAUSE', created_at: t1, reason: 'Lunch' },
      ]);

      state.setAgent(7, 'PJSIP/101', {
        name: 'Alice',
        status: 'PAUSED',
        pauseReason: 'Lunch',
        callsTaken: 5,
        queues: ['sales'],
      });

      const detail = await service.getAgentDetail('PJSIP/101', 7);

      expect(detail.stats.callsHandled).toBe(2);
      expect(detail.stats.totalTalk).toBe(180);
      expect(detail.stats.aht).toBe(90);
      expect(detail.stats.totalHold).toBe(5);
      expect(detail.stats.status).toBe('PAUSED');
      expect(detail.segments).toHaveLength(2);
      expect(detail.segments[0].state).toBe('READY');
      expect(detail.segments[1].state).toBe('PAUSED');
      expect(detail.segments[1].reason).toBe('Lunch');
    });

    it('maps DIALING/CONSULT/ACW journal events to their own timeline states (D-09/D-13)', async () => {
      const t0 = new Date('2026-07-15T08:00:00Z');
      const t1 = new Date('2026-07-15T08:00:20Z');
      const t2 = new Date('2026-07-15T08:01:00Z');

      sessionModel.findAll.mockResolvedValue([{ uid: 10 }]);
      queueCallModel.findAll.mockResolvedValue([]);
      agentEventModel.findAll.mockResolvedValue([
        { event_type: 'DIALING', created_at: t0, reason: '' },
        { event_type: 'CONSULT', created_at: t1, reason: '' },
        { event_type: 'ACW', created_at: t2, reason: '' },
      ]);

      state.setAgent(7, 'PJSIP/101', { name: 'Alice', status: 'ACW', queues: ['sales'] });

      const detail = await service.getAgentDetail('PJSIP/101', 7);

      expect(detail.segments.map((s: any) => s.state)).toEqual(['DIALING', 'CONSULT', 'ACW']);
    });
  });
});
