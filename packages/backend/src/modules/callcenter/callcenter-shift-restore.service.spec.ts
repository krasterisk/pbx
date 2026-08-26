import { CallCenterStateService } from './callcenter-state.service';
import { CallCenterShiftRestoreService } from './callcenter-shift-restore.service';

describe('CallCenterShiftRestoreService', () => {
  let state: CallCenterStateService;
  let service: CallCenterShiftRestoreService;
  const metricsService: any = {
    rebuildSinceLoginFromHistory: jest.fn().mockResolvedValue({
      answered: 2, made: 1, missed: 0,
    }),
  };
  const settingsService: any = {
    getOperatorSettings: jest.fn().mockResolvedValue({
      wrapup_timeout: 30,
      wrapup_extend_step: 15,
      wrapup_autosave_draft: true,
    }),
  };
  const moduleRef: any = {
    get: jest.fn().mockReturnValue({
      bindActiveSession: jest.fn(),
    }),
  };
  const sessionModel: any = {
    findAll: jest.fn(),
    findOne: jest.fn(),
    update: jest.fn().mockResolvedValue([1]),
  };
  const userModel: any = {
    findOne: jest.fn().mockResolvedValue({
      getDataValue: (k: string) => ({ name: 'Alice', login: 'alice' } as any)[k],
    }),
  };

  beforeEach(() => {
    jest.clearAllMocks();
    state = new CallCenterStateService();
    service = new CallCenterShiftRestoreService(
      state,
      metricsService,
      settingsService,
      moduleRef,
      sessionModel,
      userModel,
    );
  });

  it('hydrates open session without marking queuesDetached (auto QueueAdd heals Asterisk)', async () => {
    const login = new Date('2026-08-17T08:00:00Z');
    const statusAt = new Date('2026-08-17T09:00:00Z');
    const session: any = {
      uid: 11,
      user_id: 42,
      user_uid: 7,
      agent_interface: 'PJSIP/e201_0',
      login_time: login,
      last_status: 'IN_CALL',
      last_status_at: statusAt,
      pause_reason: null,
      getDataValue: (k: string) =>
        ({
          queues_snapshot: ['q700_0', 'q701_0'],
        } as any)[k],
    };

    await service.restoreSession(session);

    const agent = state.getAgent(7, 'PJSIP/e201_0');
    expect(agent).toBeDefined();
    expect(agent?.userId).toBe(42);
    expect(agent?.name).toBe('Alice');
    expect(agent?.status).toBe('READY'); // transient without live channel
    expect(agent?.queues).toEqual(['q700_0', 'q701_0']);
    expect(agent?.queuesDetached).toBe(false);
    expect(agent?.statusSince).toEqual(statusAt);
    expect(agent?.callsTaken).toBe(2);
    expect(moduleRef.get).toHaveBeenCalled();
  });

  it('clears stale queuesDetached flag on restore', async () => {
    state.setAgent(7, 'PJSIP/e201_0', {
      status: 'READY',
      queues: ['q700_0', 'q701_0'],
      queuesDetached: true,
      userId: 0,
      name: 'e201_0',
    });

    const session: any = {
      uid: 14,
      user_id: 42,
      user_uid: 7,
      agent_interface: 'PJSIP/e201_0',
      login_time: new Date('2026-08-17T08:00:00Z'),
      last_status: 'READY',
      last_status_at: new Date('2026-08-17T09:00:00Z'),
      pause_reason: null,
      getDataValue: () => ['q700_0', 'q701_0'],
    };

    await service.restoreSession(session);
    const agent = state.getAgent(7, 'PJSIP/e201_0');
    expect(agent?.queuesDetached).toBe(false);
    expect(agent?.queues).toEqual(['q700_0', 'q701_0']);
    expect(agent?.userId).toBe(42);
  });

  it('prefers Asterisk PAUSED over DB last_status', async () => {
    state.setAgent(7, 'PJSIP/e201_0', {
      status: 'PAUSED',
      pauseReason: 'lunch',
      queues: ['q700_0'],
      userId: 0,
      name: 'e201_0',
    });

    const session: any = {
      uid: 12,
      user_id: 42,
      user_uid: 7,
      agent_interface: 'PJSIP/e201_0',
      login_time: new Date(),
      last_status: 'READY',
      last_status_at: new Date(),
      pause_reason: null,
      getDataValue: () => ['q700_0'],
    };

    await service.restoreSession(session);
    const agent = state.getAgent(7, 'PJSIP/e201_0');
    expect(agent?.status).toBe('PAUSED');
    expect(agent?.queuesDetached).toBe(false);
    expect(agent?.userId).toBe(42);
  });

  it('uses login_time when last_status_at is missing (not AMI boot stamp)', async () => {
    const login = new Date('2026-08-17T08:00:00Z');
    const bootStamp = new Date('2026-08-18T10:00:00Z');
    state.setAgent(7, 'PJSIP/e201_0', {
      status: 'READY',
      queues: [],
      userId: 0,
      statusSince: bootStamp,
    });

    const session: any = {
      uid: 13,
      user_id: 42,
      user_uid: 7,
      agent_interface: 'PJSIP/e201_0',
      login_time: login,
      last_status: 'READY',
      last_status_at: null,
      pause_reason: null,
      getDataValue: () => ['q700_0'],
    };

    await service.restoreSession(session);
    const agent = state.getAgent(7, 'PJSIP/e201_0');
    expect(agent?.statusSince).toEqual(login);
    expect(sessionModel.update).toHaveBeenCalledWith(
      expect.objectContaining({ last_status_at: login }),
      expect.objectContaining({ where: expect.objectContaining({ uid: 13 }) }),
    );
  });
});
