import { BadRequestException, ForbiddenException, NotFoundException } from '@nestjs/common';
import { Op } from 'sequelize';
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
    playDtmf: jest.fn().mockResolvedValue({ response: 'Success' }),
    action: jest.fn().mockResolvedValue({ response: 'Success' }),
    originate: jest.fn().mockResolvedValue(undefined),
    park: jest.fn().mockResolvedValue({ response: 'Success' }),
    parkedCalls: jest.fn().mockResolvedValue({ events: [] }),
    collectDeviceStateList: jest.fn().mockResolvedValue({ events: [] }),
    isPjsipEndpointReachable: jest.fn().mockResolvedValue(null),
    getActiveChannels: jest.fn().mockResolvedValue({ events: [] }),
  };
  const ccAmi: any = {
    logAgentEvent: jest.fn().mockResolvedValue(undefined),
    logAgentEventForAgent: jest.fn().mockResolvedValue(undefined),
    beginTimedStatus: jest.fn().mockResolvedValue(undefined),
    endTimedStatus: jest.fn().mockResolvedValue(0),
    incrementSessionTotals: jest.fn().mockResolvedValue(undefined),
    cancelWrapupTimer: jest.fn(),
    extendWrapupTimer: jest.fn(),
    clearNonQueueDialAttempt: jest.fn(),
  };
  const metricsService: any = {
    resetKpiSinceLogin: jest.fn(),
    recordAgentStatus: jest.fn(),
    rebuildSinceLoginFromHistory: jest.fn().mockResolvedValue({
      answered: 0, made: 0, missed: 0,
    }),
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
      auto_answer: true,
      auto_answer_zip_tone: true,
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
    findAll: jest.fn().mockResolvedValue([]),
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
  const queueModel: any = {
    findAll: jest.fn().mockResolvedValue([]),
    findOne: jest.fn().mockResolvedValue(null),
  };
  const endpointModel: any = {
    findAll: jest.fn().mockResolvedValue([]),
    findByPk: jest.fn().mockResolvedValue({
      getDataValue: (k: string) => (k === 'context' ? 'from-internal7' : undefined),
      context: 'from-internal7',
    }),
  };
  const callGroupModel: any = {
    findAll: jest.fn().mockResolvedValue([]),
  };
  const callGroupMemberModel: any = {
    findAll: jest.fn().mockResolvedValue([]),
  };
  const contactModel: any = {
    findAll: jest.fn().mockResolvedValue([]),
    findOne: jest.fn(),
    create: jest.fn(),
  };
  const presenceService: any = {
    getPresence: jest.fn().mockReturnValue(undefined),
    handleDeviceStateChange: jest.fn(),
  };

  beforeEach(() => {
    jest.clearAllMocks();
    settingsService.getOperatorSettings.mockResolvedValue({
      pickup_enabled: true,
      wrapup_timeout: 30,
      wrapup_extend_step: 30,
      wrapup_autosave_draft: true,
      auto_answer: true,
      auto_answer_zip_tone: true,
    });
    endpointModel.findByPk.mockResolvedValue({
      getDataValue: (k: string) => (k === 'context' ? 'from-internal7' : undefined),
      context: 'from-internal7',
    });
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
      queueModel,
      endpointModel,
      callGroupModel,
      callGroupMemberModel,
      presenceService,
      contactModel,
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

    it('seeds live queue rows into the snapshot so QueuesTab has data before AMI QueueParams', async () => {
      queueModel.findOne.mockResolvedValueOnce({
        getDataValue: (k: string) =>
          ({ display_name: 'Продажи', name: 'q700_0' } as any)[k],
      });

      await service.agentLogin('PJSIP/ew112_0', ['q700_0'], 0, 58);

      const q = state.getQueue(0, 'q700_0');
      expect(q).toBeDefined();
      expect(q?.displayName).toBe('Продажи');
      expect(q?.agents.total).toBe(1);
      expect(q?.agents.available).toBe(1);
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

      const result = await service.getAgentKpi(7, 42);

      expect(metricsService.getAgentKpi).toHaveBeenCalledWith(7, 'PJSIP/101');
      expect(result).toEqual({
        sinceLogin: { answered: 0, made: 0, missed: 0 },
        sinceMidnight: { answered: 0, made: 0, missed: 0 },
      });
    });

    it('never accepts a client-supplied interface — falls back to an empty lookup when the user is not online (self-scoped, T-09-04-01)', async () => {
      await service.getAgentKpi(7, 999);

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

  describe('agentStartOutboundWork', () => {
    it('pauses queues and sets OUTBOUND_WORK without PAUSE journal', async () => {
      await service.agentLogin('PJSIP/101', ['sales'], 7, 42);
      await service.agentStartOutboundWork(7, 42);

      const agent = state.getAgent(7, 'PJSIP/101');
      expect(agent?.status).toBe('OUTBOUND_WORK');
      expect(agent?.pauseReason).toBe('outbound_work');
      expect(ami.queuePause).toHaveBeenCalledWith('sales', 'PJSIP/101', true, 'outbound_work');
      expect(ccAmi.beginTimedStatus).not.toHaveBeenCalledWith(
        expect.anything(),
        'PAUSE',
        expect.anything(),
      );
      expect(ccAmi.logAgentEventForAgent).toHaveBeenCalledWith(
        expect.objectContaining({ status: 'OUTBOUND_WORK' }),
        'OUTBOUND_WORK',
        'outbound_work',
      );
    });

    it('leave returns READY and unpauses queues', async () => {
      await service.agentLogin('PJSIP/101', ['sales'], 7, 42);
      await service.agentStartOutboundWork(7, 42);
      await service.agentLeaveOutboundWork(7, 42);

      expect(state.getAgent(7, 'PJSIP/101')?.status).toBe('READY');
      expect(ami.queuePause).toHaveBeenCalledWith('sales', 'PJSIP/101', false);
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
      expect(res).toEqual({ success: true, uniqueid: 'U1', target: '101', context: 'from-internal7' });
      expect(ami.action).toHaveBeenCalledWith(
        expect.objectContaining({
          action: 'Redirect',
          channel: 'PJSIP/trunk-1',
          context: 'from-internal7',
          exten: '101',
        }),
      );
    });

    it('maps WebRTC sip id to numeric exten and endpoint dialplan context', async () => {
      endpointModel.findByPk.mockResolvedValue({
        getDataValue: (k: string) => (k === 'context' ? 'sip-out0' : undefined),
        context: 'sip-out0',
      });
      await service.agentLogin('PJSIP/ew112_0', ['q700_0'], 0, 58);
      state.setCall('U-w', {
        userUid: 0,
        queue: 'q700_0',
        status: 'WAITING',
        callerChannel: 'PJSIP/e201_0-00000073',
      });

      const res = await service.agentPickCall('U-w', 0, 58);
      expect(res).toEqual({ success: true, uniqueid: 'U-w', target: '112', context: 'sip-out0' });
      expect(ami.action).toHaveBeenCalledWith(
        expect.objectContaining({
          action: 'Redirect',
          channel: 'PJSIP/e201_0-00000073',
          context: 'sip-out0',
          exten: '112',
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
          context: 'from-internal7',
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

  describe('getMissedCalls', () => {
    it('attaches called_back_by_name for operator-handled rows', async () => {
      missedCallModel.findAll.mockResolvedValueOnce([
        {
          call_uniqueid: 'u1',
          called_back_by: 42,
          toJSON: () => ({
            uid: 1,
            call_uniqueid: 'u1',
            caller_id_num: '79990001122',
            called_back: true,
            called_back_by: 42,
            called_back_at: '2026-07-28T10:05:00.000Z',
            client_called_back: false,
            created_at: '2026-07-28T10:00:00.000Z',
          }),
        },
        {
          call_uniqueid: 'u2',
          called_back_by: null,
          toJSON: () => ({
            uid: 2,
            call_uniqueid: 'u2',
            caller_id_num: '79990003344',
            called_back: false,
            called_back_by: null,
            called_back_at: null,
            client_called_back: true,
            created_at: '2026-07-28T09:00:00.000Z',
          }),
        },
      ]);
      userModel.findAll.mockResolvedValueOnce([
        {
          getDataValue: (k: string) =>
            ({ uniqueid: 42, name: 'Alice Operator', login: 'alice' } as any)[k],
        },
      ]);

      const result = await service.getMissedCalls(7, true, 42);

      expect(userModel.findAll).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            uniqueid: { [Op.in]: [42] },
            vpbx_user_uid: 7,
          }),
        }),
      );
      expect(result).toEqual([
        expect.objectContaining({
          call_uniqueid: 'u1',
          called_back_by: 42,
          called_back_by_name: 'Alice Operator',
        }),
        expect.objectContaining({
          call_uniqueid: 'u2',
          called_back_by_name: null,
        }),
      ]);
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
        'from-internal7',
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
        'from-internal7',
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
          context: 'from-internal7',
          exten: '101',
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
          context: 'from-internal7',
          extracontext: 'from-internal7',
        }),
      );
      expect(ami.originate).toHaveBeenCalledWith(
        'PJSIP/201',
        expect.stringContaining('Conference'),
        'from-internal7',
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
        expect.objectContaining({
          action: 'Redirect',
          channel: 'PJSIP/trunk-1',
          exten: 'support',
          context: 'from-internal7',
        }),
      );
      expect(state.getCall('U1')?.status).toBe('TRANSFERRED');
    });
  });

  describe('clickToCall', () => {
    it('rejects when agent is not logged in', async () => {
      await expect(service.clickToCall('79990001122', 7, 42)).rejects.toBeInstanceOf(NotFoundException);
    });

    it('throws Forbidden when SIP shift lacks click_to_call permission', async () => {
      await service.agentLogin('PJSIP/101', ['sales'], 7, 42);
      permissionsService.getEffective.mockResolvedValue({
        can_spy: false, spyable: true, spy_modes: [], click_to_call: false, customize_ui: false,
      });

      await expect(service.clickToCall('79990001122', 7, 42)).rejects.toBeInstanceOf(ForbiddenException);
      expect(ami.action).not.toHaveBeenCalled();
    });

    it('WebRTC companion skips click_to_call assert and dials directly (no AMI)', async () => {
      await service.agentLogin('PJSIP/ew112_0', ['q700_0'], 0, 58);
      permissionsService.getEffective.mockResolvedValue({
        can_spy: false, spyable: true, spy_modes: [], click_to_call: false, customize_ui: false,
      });

      const res = await service.clickToCall('79990001122', 0, 58);

      expect(res).toEqual({ success: true, mode: 'webrtc', target: '79990001122' });
      expect(ami.action).not.toHaveBeenCalled();
      expect(permissionsService.assert).not.toHaveBeenCalled();
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
          context: 'from-internal7',
          exten: '79990001122',
          // Callee must see operator extension, not "Click-to-call" / PJSIP/…
          callerid: '"101" <101>',
          variable: expect.stringMatching(/Call-Info:.*answer-after=0/),
        }),
      );
      expect(ami.action).not.toHaveBeenCalledWith(
        expect.objectContaining({ callerid: expect.stringContaining('Click-to-call') }),
      );
      expect(ami.action).not.toHaveBeenCalledWith(
        expect.objectContaining({ callerid: expect.stringContaining('PJSIP/') }),
      );
      expect(state.getAgent(7, 'PJSIP/101')?.status).toBe('DIALING');
      expect(state.getAgent(7, 'PJSIP/101')?.dialTarget).toBe('79990001122');
    });

    it('omits Call-Info auto-answer header when operator auto_answer is off', async () => {
      settingsService.getOperatorSettings.mockResolvedValue({
        pickup_enabled: true,
        wrapup_timeout: 30,
        wrapup_extend_step: 30,
        wrapup_autosave_draft: true,
        auto_answer: false,
        auto_answer_zip_tone: false,
      });
      await service.agentLogin('PJSIP/101', ['sales'], 7, 42);
      permissionsService.getEffective.mockResolvedValue({
        can_spy: false, spyable: true, spy_modes: [], click_to_call: true, customize_ui: false,
      });

      await service.clickToCall('201', 7, 42);

      expect(ami.action).toHaveBeenCalledWith(
        expect.objectContaining({
          action: 'Originate',
          channel: 'PJSIP/101',
          exten: '201',
        }),
      );
      const originateArgs = ami.action.mock.calls.find(
        (c: any[]) => c[0]?.action === 'Originate',
      )?.[0];
      expect(originateArgs?.variable).toBeUndefined();
    });

    it('uses endpoint dialplan context (sip-outN), never bare from-internal', async () => {
      endpointModel.findByPk.mockResolvedValueOnce({
        getDataValue: (k: string) => (k === 'context' ? 'sip-out0' : undefined),
        context: 'sip-out0',
      });
      await service.agentLogin('PJSIP/e112_0', ['q700_0'], 0, 58);
      permissionsService.getEffective.mockResolvedValue({
        can_spy: false, spyable: true, spy_modes: [], click_to_call: true, customize_ui: false,
      });

      await service.clickToCall('201', 0, 58);

      expect(ami.action).toHaveBeenCalledWith(
        expect.objectContaining({
          action: 'Originate',
          channel: 'PJSIP/e112_0',
          context: 'sip-out0',
          exten: '201',
          callerid: '"112" <112>',
        }),
      );
      expect(ami.action).not.toHaveBeenCalledWith(
        expect.objectContaining({ context: 'from-internal' }),
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

    it('allows callback without click_to_call permission (missed worklist is shift-scoped)', async () => {
      await service.agentLogin('PJSIP/101', ['sales'], 7, 42);
      permissionsService.getEffective.mockResolvedValue({
        can_spy: false, spyable: true, spy_modes: [], click_to_call: false, customize_ui: false,
      });

      const res = await service.callbackMissedCall(7, 42, '79990001122');

      expect(res).toEqual({ success: true, mode: 'pjsip', target: '79990001122' });
      expect(ami.action).toHaveBeenCalled();
    });

    it('dials via the clickToCall branching — same scheme, not duplicated (D-18/D-29)', async () => {
      await service.agentLogin('PJSIP/101', ['sales'], 7, 42);

      const res = await service.callbackMissedCall(7, 42, '79990001122');

      expect(res).toEqual({ success: true, mode: 'pjsip', target: '79990001122' });
      expect(ami.action).toHaveBeenCalledWith(
        expect.objectContaining({
          action: 'Originate',
          channel: 'PJSIP/101',
          context: 'from-internal7',
          exten: '79990001122',
        }),
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

  // ─── Operator call history (D-34/D-35) ──────────────────

  describe('getOperatorCallHistory', () => {
    beforeEach(() => {
      queueCallModel.findAll.mockClear();
      sessionModel.findOne.mockClear();
    });

    it('queries cc_queue_calls tenant+operator scoped, most-recent-first, for a "day" period', async () => {
      queueCallModel.findAll.mockResolvedValue([
        {
          getDataValue: (k: string) =>
            ({
              uid: 1,
              call_uniqueid: 'U1',
              queue_name: 'sales_7',
              caller_id_num: '+7999',
              caller_id_name: 'Ivan',
              direction: 'inbound',
              call_type: '',
              disposition: 'answered',
              enter_time: new Date('2026-07-15T08:00:00Z'),
              answer_time: new Date('2026-07-15T08:00:05Z'),
              end_time: new Date('2026-07-15T08:01:00Z'),
              wait_time: 5,
              talk_time: 55,
            } as any)[k],
        },
      ]);

      const rows = await service.getOperatorCallHistory(7, 42, 'day');

      expect(queueCallModel.findAll).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ user_uid: 7, agent_user_uid: 42 }),
          order: [['created_at', 'DESC']],
        }),
      );
      expect(rows).toHaveLength(1);
      expect(rows[0]).toEqual(
        expect.objectContaining({
          callUniqueid: 'U1',
          direction: 'inbound',
          disposition: 'answered',
          waitTime: 5,
          talkTime: 55,
        }),
      );
    });

    it('resolves the "shift" period from the operator\'s open login session', async () => {
      const loginTime = new Date('2026-07-15T06:00:00Z');
      sessionModel.findOne.mockResolvedValue({
        getDataValue: (k: string) => ({ login_time: loginTime } as any)[k],
      });
      queueCallModel.findAll.mockResolvedValue([]);

      await service.getOperatorCallHistory(7, 42, 'shift');

      expect(sessionModel.findOne).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ user_id: 42, user_uid: 7, logout_time: null }),
        }),
      );
      const call = queueCallModel.findAll.mock.calls[0][0];
      expect(call.where.created_at[Op.gte]).toEqual(loginTime);
    });

    it('falls back to start-of-day when no open session is found for "shift"', async () => {
      sessionModel.findOne.mockResolvedValue(null);
      queueCallModel.findAll.mockResolvedValue([]);

      await service.getOperatorCallHistory(7, 42, 'shift');

      const call = queueCallModel.findAll.mock.calls[0][0];
      const since: Date = call.where.created_at[Op.gte];
      expect(since.getHours()).toBe(0);
      expect(since.getMinutes()).toBe(0);
    });
  });

  // ─── Transfer directory (D-36) ──────────────────────────

  describe('getTransferDirectory', () => {
    beforeEach(() => {
      endpointModel.findAll.mockResolvedValue([
        { id: 'e101_7', department: 'Sales' },
        { id: 'ew101_7', department: 'Sales' }, // webrtc companion — excluded
      ]);
      queueModel.findAll.mockResolvedValue([
        { getDataValue: (k: string) => ({ name: 'sales_7', display_name: 'Sales' } as any)[k] },
      ]);
      callGroupModel.findAll.mockResolvedValue([
        { getDataValue: (k: string) => ({ uid: 1, name: 'Support Group' } as any)[k] },
      ]);
      callGroupMemberModel.findAll.mockResolvedValue([
        { getDataValue: (k: string) => ({ call_group_uid: 1, value: '101' } as any)[k] },
        { getDataValue: (k: string) => ({ call_group_uid: 1, value: '102' } as any)[k] },
      ]);
    });

    it('returns endpoints (webrtc companions excluded) with presence, queues with free/total, and groups with free/total', async () => {
      state.setAgent(7, 'PJSIP/e101_7', { name: 'Alice', status: 'READY', userId: 42 });
      state.setQueue(7, 'sales_7', { agents: { total: 3, available: 2, paused: 0, busy: 1 } });
      presenceService.getPresence.mockReturnValue('INUSE');

      const dir = await service.getTransferDirectory(7);

      expect(dir.endpoints).toEqual([
        { type: 'endpoint', id: 'e101_7', extension: '101', label: 'Sales', presence: 'INUSE' },
      ]);
      expect(dir.queues).toEqual([
        { type: 'queue', id: 'sales_7', label: 'Sales', freeOperators: 2, totalOperators: 3 },
      ]);
      expect(dir.groups).toEqual([
        { type: 'group', id: '1', label: 'Support Group', freeOperators: 1, totalOperators: 2 },
      ]);
    });

    it('falls back to live CC agent status when the presence service has no entry', async () => {
      state.setAgent(7, 'PJSIP/e101_7', { name: 'Alice', status: 'PAUSED', userId: 42 });
      presenceService.getPresence.mockReturnValue(undefined);

      const dir = await service.getTransferDirectory(7);

      expect(dir.endpoints[0].presence).toBe('PAUSED');
    });

    it('filters all three entity types by a case-insensitive search term', async () => {
      state.setQueue(7, 'sales_7', { agents: { total: 1, available: 1, paused: 0, busy: 0 } });

      const dir = await service.getTransferDirectory(7, 'SALES_7');

      expect(dir.endpoints).toHaveLength(0); // extension "101" / label "Sales" — neither matches "sales_7"
      expect(dir.queues).toHaveLength(1);
      expect(dir.groups).toHaveLength(0);
    });

    it('scopes every query by tenant (vpbx_user_uid)', async () => {
      await service.getTransferDirectory(7);

      expect(endpointModel.findAll).toHaveBeenCalledWith(
        expect.objectContaining({ where: { tenantid: '7' } }),
      );
      expect(queueModel.findAll).toHaveBeenCalledWith(
        expect.objectContaining({ where: { user_uid: 7 } }),
      );
      expect(callGroupModel.findAll).toHaveBeenCalledWith(
        expect.objectContaining({ where: { user_uid: 7 } }),
      );
    });
  });

  // ─── SIP DTMF + registration-state (Phase 10 D-32/D-35) ─

  describe('sendDtmf', () => {
    async function loginOwnCall() {
      await service.agentLogin('PJSIP/101', ['sales'], 7, 42);
      state.setCall('U1', {
        uniqueid: 'U1',
        userUid: 7,
        agent: 'PJSIP/101',
        agentChannel: 'PJSIP/101-00000001',
        callerChannel: 'PJSIP/trunk-1-00000002',
        status: 'TALKING',
        queue: 'sales',
      });
      state.setAgent(7, 'PJSIP/101', { currentCall: 'U1', status: 'IN_CALL' });
    }

    it('calls playDtmf on the operator own agent channel for a valid digit', async () => {
      await loginOwnCall();
      const res = await service.sendDtmf(7, 42, 'U1', '5');
      expect(res).toEqual({ success: true, uniqueid: 'U1', digit: '5' });
      expect(ami.playDtmf).toHaveBeenCalledWith('PJSIP/101-00000001', '5');
    });

    it('rejects illegal/multi-char digits before AMI', async () => {
      await loginOwnCall();
      await expect(service.sendDtmf(7, 42, 'U1', '12')).rejects.toBeInstanceOf(BadRequestException);
      await expect(service.sendDtmf(7, 42, 'U1', 'x')).rejects.toBeInstanceOf(BadRequestException);
      expect(ami.playDtmf).not.toHaveBeenCalled();
    });

    it('does not dispatch PlayDTMF for a foreign or unknown uniqueid', async () => {
      await loginOwnCall();
      state.setCall('OTHER', {
        uniqueid: 'OTHER',
        userUid: 7,
        agent: 'PJSIP/999',
        agentChannel: 'PJSIP/999-00000009',
        status: 'TALKING',
        queue: 'sales',
      });

      await expect(service.sendDtmf(7, 42, 'OTHER', '1')).rejects.toBeInstanceOf(ForbiddenException);
      await expect(service.sendDtmf(7, 42, 'MISSING', '1')).rejects.toBeInstanceOf(NotFoundException);
      expect(ami.playDtmf).not.toHaveBeenCalled();
    });
  });

  describe('getMyRegistrationState', () => {
    it('returns online true when DeviceState is NOT_INUSE', async () => {
      await service.agentLogin('PJSIP/e101_7', ['sales'], 7, 42);
      presenceService.getPresence.mockReturnValue('NOT_INUSE');

      const res = await service.getMyRegistrationState(7, 42);
      expect(res).toEqual({ online: true });
      expect(presenceService.getPresence).toHaveBeenCalledWith(7, '101');
      expect(ami.collectDeviceStateList).not.toHaveBeenCalled();
    });

    it('prefers live PJSIP contact Avail over stale DeviceState UNAVAILABLE', async () => {
      await service.agentLogin('PJSIP/e201_0', ['q700_0'], 0, 58);
      presenceService.getPresence.mockReturnValue('UNAVAILABLE');
      ami.isPjsipEndpointReachable.mockResolvedValueOnce(true);

      const res = await service.getMyRegistrationState(0, 58);
      expect(res).toEqual({ online: true });
      expect(ami.isPjsipEndpointReachable).toHaveBeenCalledWith('e201_0');
      expect(presenceService.handleDeviceStateChange).toHaveBeenCalledWith(
        expect.objectContaining({ device: 'PJSIP/e201_0', state: 'NOT_INUSE' }),
      );
      expect(ami.collectDeviceStateList).not.toHaveBeenCalled();
    });

    it('returns online false for UNAVAILABLE or missing presence', async () => {
      await service.agentLogin('PJSIP/e101_7', ['sales'], 7, 42);
      ami.isPjsipEndpointReachable.mockResolvedValue(null);
      presenceService.getPresence.mockReturnValue('UNAVAILABLE');
      expect(await service.getMyRegistrationState(7, 42)).toEqual({ online: false });
      expect(ami.collectDeviceStateList).toHaveBeenCalled();

      presenceService.getPresence.mockReturnValue(undefined);
      ami.collectDeviceStateList.mockClear();
      expect(await service.getMyRegistrationState(7, 42)).toEqual({ online: false });
      expect(ami.collectDeviceStateList).toHaveBeenCalled();
    });

    it('seeds presence from live DeviceStateList when cache is empty', async () => {
      await service.agentLogin('PJSIP/e101_7', ['sales'], 7, 42);
      ami.isPjsipEndpointReachable.mockResolvedValue(null);
      presenceService.getPresence
        .mockReturnValueOnce(undefined)
        .mockReturnValueOnce('NOT_INUSE');
      ami.collectDeviceStateList.mockResolvedValueOnce({
        events: [{ device: 'PJSIP/e101_7', state: 'NOT_INUSE' }],
      });

      const res = await service.getMyRegistrationState(7, 42);
      expect(res).toEqual({ online: true });
      expect(presenceService.handleDeviceStateChange).toHaveBeenCalledWith(
        expect.objectContaining({ device: 'PJSIP/e101_7', state: 'NOT_INUSE' }),
      );
    });

    it('maps WebRTC companion to primary SIP extension for presence lookup', async () => {
      await service.agentLogin('PJSIP/ew101_7', ['sales'], 7, 42);
      presenceService.getPresence.mockReturnValue('INUSE');

      const res = await service.getMyRegistrationState(7, 42);
      expect(res).toEqual({ online: true });
      expect(presenceService.getPresence).toHaveBeenCalledWith(7, '101');
    });

    it('maps WebRTC companion to primary endpoint for PJSIP contact check', async () => {
      await service.agentLogin('PJSIP/ew201_0', ['q700_0'], 0, 58);
      ami.isPjsipEndpointReachable.mockResolvedValueOnce(true);

      const res = await service.getMyRegistrationState(0, 58);
      expect(res).toEqual({ online: true });
      expect(ami.isPjsipEndpointReachable).toHaveBeenCalledWith('e201_0');
    });

    it('rebounds via open DB session after Nest restart (userId wiped to 0)', async () => {
      await service.agentLogin('PJSIP/e201_0', ['q700_0'], 0, 58);
      // Simulate AMI QueueMember preload after Nest restart: identity lost.
      state.setAgent(0, 'PJSIP/e201_0', { userId: 0 });
      sessionModel.findOne.mockResolvedValue({
        user_id: 58,
        user_uid: 0,
        agent_interface: 'PJSIP/e201_0',
        login_time: new Date(),
        uid: 99,
      });
      ami.isPjsipEndpointReachable.mockResolvedValueOnce(true);

      const res = await service.getMyRegistrationState(58, 58);
      expect(res).toEqual({ online: true });
      expect(state.getAgent(0, 'PJSIP/e201_0')?.userId).toBe(58);
      expect(ami.isPjsipEndpointReachable).toHaveBeenCalledWith('e201_0');
    });
  });

  describe('agentHangup (SIP outbound / post-restart)', () => {
    it('hangs live channels when agent is IN_CALL without queue currentCall', async () => {
      await service.agentLogin('PJSIP/101', ['sales'], 7, 42);
      state.setAgent(7, 'PJSIP/101', {
        status: 'IN_CALL',
        dialTarget: '201',
        currentCall: undefined,
      });
      ami.getActiveChannels.mockResolvedValueOnce({
        events: [
          { channel: 'PJSIP/101-00000001' },
          { channel: 'PJSIP/201-00000002' },
        ],
      });

      const res = await service.agentHangup(7, 42);
      expect(res).toEqual({ success: true });
      expect(ami.hangup).toHaveBeenCalledWith('PJSIP/101-00000001');
      expect(state.getAgent(7, 'PJSIP/101')?.status).toBe('READY');
      expect(ccAmi.clearNonQueueDialAttempt).toHaveBeenCalledWith(7, 'PJSIP/101');
    });

    it('resolves interface from open session when in-memory userId is 0', async () => {
      await service.agentLogin('PJSIP/e201_0', ['q700_0'], 0, 58);
      state.setAgent(0, 'PJSIP/e201_0', {
        userId: 0,
        status: 'IN_CALL',
        dialTarget: '7900',
      });
      sessionModel.findOne.mockResolvedValue({
        user_id: 58,
        user_uid: 0,
        agent_interface: 'PJSIP/e201_0',
        login_time: new Date(),
        uid: 99,
      });
      ami.getActiveChannels.mockResolvedValueOnce({
        events: [{ channel: 'PJSIP/e201_0-00000009' }],
      });

      const res = await service.agentHangup(58, 58);
      expect(res).toEqual({ success: true });
      expect(ami.hangup).toHaveBeenCalledWith('PJSIP/e201_0-00000009');
    });
  });

  describe('clickToCall dialTarget tenant bucket', () => {
    it('writes DIALING+dialTarget on the live queue-suffix agent, not JWT vpbx ghost', async () => {
      // Agent lives under tenant 0 (q700_0); JWT vpbx may be 58 after restart rebound.
      state.setAgent(0, 'PJSIP/e201_0', {
        userId: 58,
        status: 'READY',
        queues: ['q700_0'],
        name: 'Op',
      });
      sessionModel.findOne.mockResolvedValue({
        user_id: 58,
        user_uid: 0,
        agent_interface: 'PJSIP/e201_0',
        login_time: new Date(),
        uid: 99,
      });
      permissionsService.getEffective.mockResolvedValue({
        can_spy: false, spyable: true, spy_modes: [], click_to_call: true, customize_ui: false,
      });
      endpointModel.findByPk.mockResolvedValue({
        getDataValue: (k: string) => (k === 'context' ? 'from-internal0' : undefined),
        context: 'from-internal0',
      });

      await service.clickToCall('201', 58, 58);

      expect(state.getAgent(0, 'PJSIP/e201_0')?.status).toBe('DIALING');
      expect(state.getAgent(0, 'PJSIP/e201_0')?.dialTarget).toBe('201');
      expect(state.getAgent(58, 'PJSIP/e201_0')).toBeUndefined();
    });
  });
});
