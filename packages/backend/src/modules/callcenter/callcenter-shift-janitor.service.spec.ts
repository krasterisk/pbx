import { CallCenterShiftJanitorService } from './callcenter-shift-janitor.service';
import { DEFAULT_SHIFT_POLICY } from './models/shift-policy.types';

describe('CallCenterShiftJanitorService', () => {
  const endShift = jest.fn().mockResolvedValue({ success: true });
  const moduleRef: any = {
    get: jest.fn().mockReturnValue({
      endShift,
      getPanelConnectionCount: jest.fn().mockReturnValue(0),
    }),
  };
  const settingsService: any = {};
  const presenceService: any = {
    getPresence: jest.fn().mockReturnValue(undefined),
  };
  const sessionModel: any = {
    findAll: jest.fn(),
  };
  const settingsModel: any = {
    findOne: jest.fn(),
  };

  let service: CallCenterShiftJanitorService;

  beforeEach(() => {
    jest.clearAllMocks();
    service = new CallCenterShiftJanitorService(
      moduleRef,
      settingsService,
      presenceService,
      sessionModel,
      settingsModel,
    );
  });

  it('closes by max duration', async () => {
    const login = new Date(Date.now() - 3 * 60 * 60_000);
    sessionModel.findAll.mockResolvedValue([
      {
        uid: 1,
        user_id: 42,
        user_uid: 7,
        agent_interface: 'PJSIP/e201_0',
        login_time: login,
        panel_seen_at: new Date(),
      },
    ]);
    settingsModel.findOne.mockResolvedValue({
      shift_policy: { ...DEFAULT_SHIFT_POLICY, max_duration_min: 60 },
    });

    const n = await service.runOnce();
    expect(n).toBe(1);
    expect(endShift).toHaveBeenCalledWith(
      expect.objectContaining({
        sessionId: 1,
        reason: 'SYSTEM_MAX_DURATION',
      }),
    );
  });

  it('skips idle close while panel SSE is connected', async () => {
    moduleRef.get.mockReturnValue({
      endShift,
      getPanelConnectionCount: jest.fn().mockReturnValue(1),
    });
    sessionModel.findAll.mockResolvedValue([
      {
        uid: 2,
        user_id: 42,
        user_uid: 7,
        agent_interface: 'PJSIP/e201_0',
        login_time: new Date(Date.now() - 60_000),
        panel_seen_at: new Date(Date.now() - 60 * 60_000),
      },
    ]);
    settingsModel.findOne.mockResolvedValue({
      shift_policy: {
        ...DEFAULT_SHIFT_POLICY,
        idle_timeout_min: 5,
        idle_requires_unregistered: false,
      },
    });

    const n = await service.runOnce();
    expect(n).toBe(0);
    expect(endShift).not.toHaveBeenCalled();
  });

  it('closes by idle when panel gone and unregistered', async () => {
    moduleRef.get.mockReturnValue({
      endShift,
      getPanelConnectionCount: jest.fn().mockReturnValue(0),
    });
    presenceService.getPresence.mockReturnValue('Unavailable');
    sessionModel.findAll.mockResolvedValue([
      {
        uid: 3,
        user_id: 42,
        user_uid: 7,
        agent_interface: 'PJSIP/e201_0',
        login_time: new Date(Date.now() - 60_000),
        panel_seen_at: new Date(Date.now() - 60 * 60_000),
      },
    ]);
    settingsModel.findOne.mockResolvedValue({
      shift_policy: {
        ...DEFAULT_SHIFT_POLICY,
        idle_timeout_min: 5,
        idle_requires_unregistered: true,
      },
    });

    const n = await service.runOnce();
    expect(n).toBe(1);
    expect(endShift).toHaveBeenCalledWith(
      expect.objectContaining({ reason: 'SYSTEM_IDLE' }),
    );
  });
});
