import { BadRequestException, NotFoundException } from '@nestjs/common';
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
  };
  const ccAmi: any = {
    logAgentEvent: jest.fn().mockResolvedValue(undefined),
    cancelWrapupTimer: jest.fn(),
  };
  const sessionModel: any = {
    create: jest.fn().mockResolvedValue({ uid: 99 }),
    update: jest.fn().mockResolvedValue(undefined),
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

  beforeEach(() => {
    jest.clearAllMocks();
    state = new CallCenterStateService();
    service = new CallCenterService(
      ami,
      state,
      ccAmi,
      pauseReasonModel,
      sessionModel,
      missedCallModel,
      userModel,
      phonebookEntryModel,
      phonebookModel,
      serviceRequestModel,
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
});
