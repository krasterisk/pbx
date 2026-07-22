import { CallCenterZombieService, ZOMBIE_GRACE_PERIOD_MS } from './callcenter-zombie.service';
import { CallCenterStateService } from './callcenter-state.service';

describe('CallCenterZombieService', () => {
  let state: CallCenterStateService;
  let service: CallCenterZombieService;

  const ami: any = {
    isConnected: jest.fn(() => true),
    getActiveChannels: jest.fn(),
  };

  beforeEach(() => {
    jest.clearAllMocks();
    ami.isConnected.mockReturnValue(true);
    state = new CallCenterStateService();
    service = new CallCenterZombieService(ami, state);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('does nothing when AMI is not connected', async () => {
    ami.isConnected.mockReturnValue(false);
    await service.checkOnce();
    expect(ami.getActiveChannels).not.toHaveBeenCalled();
  });

  it('does not flag a call whose channels are still present in CoreShowChannels', async () => {
    state.setCall('U1', {
      userUid: 7,
      queue: 'sales',
      status: 'TALKING',
      callerChannel: 'PJSIP/trunk-1',
      agentChannel: 'PJSIP/e101_7-1',
    });
    ami.getActiveChannels.mockResolvedValue({
      events: [{ channel: 'PJSIP/trunk-1' }, { channel: 'PJSIP/e101_7-1' }],
    });

    await service.checkOnce();

    expect(state.getCall('U1')?.zombieCandidate).toBeFalsy();
  });

  it('does not flag immediately when channels first go missing (grace window not yet elapsed)', async () => {
    state.setCall('U2', {
      userUid: 7,
      queue: 'sales',
      status: 'TALKING',
      callerChannel: 'PJSIP/trunk-2',
      agentChannel: 'PJSIP/e101_7-2',
    });
    ami.getActiveChannels.mockResolvedValue({ events: [] });

    await service.checkOnce();

    expect(state.getCall('U2')?.zombieCandidate).toBeFalsy();
  });

  it('flags a call as a zombie candidate once missing beyond the grace period, without hanging it up', async () => {
    state.setCall('U3', {
      userUid: 7,
      queue: 'sales',
      status: 'TALKING',
      callerChannel: 'PJSIP/trunk-3',
      agentChannel: 'PJSIP/e101_7-3',
    });
    ami.getActiveChannels.mockResolvedValue({ events: [] });

    let now = Date.now();
    jest.spyOn(Date, 'now').mockImplementation(() => now);

    await service.checkOnce(); // first sighting of "missing"
    now += ZOMBIE_GRACE_PERIOD_MS + 1000;
    await service.checkOnce(); // grace period elapsed

    expect(state.getCall('U3')?.zombieCandidate).toBe(true);
    // Service never issues a destructive AMI action — only the poll itself.
    expect(ami.getActiveChannels).toHaveBeenCalledTimes(2);
  });

  it('clears the missing-tracking once a flagged call reappears in CoreShowChannels', async () => {
    state.setCall('U4', {
      userUid: 7,
      queue: 'sales',
      status: 'TALKING',
      callerChannel: 'PJSIP/trunk-4',
      agentChannel: 'PJSIP/e101_7-4',
    });

    let now = Date.now();
    jest.spyOn(Date, 'now').mockImplementation(() => now);

    ami.getActiveChannels.mockResolvedValueOnce({ events: [] });
    await service.checkOnce();
    now += ZOMBIE_GRACE_PERIOD_MS + 1000;
    ami.getActiveChannels.mockResolvedValueOnce({ events: [] });
    await service.checkOnce();
    expect(state.getCall('U4')?.zombieCandidate).toBe(true);

    ami.getActiveChannels.mockResolvedValueOnce({ events: [{ channel: 'PJSIP/trunk-4' }] });
    await service.checkOnce();

    expect(state.getCall('U4')?.zombieCandidate).toBeFalsy();
  });

  it('ignores waiting calls with no known channel yet (nothing to verify)', async () => {
    state.setCall('U5', { userUid: 7, queue: 'sales', status: 'WAITING' });
    ami.getActiveChannels.mockResolvedValue({ events: [] });

    let now = Date.now();
    jest.spyOn(Date, 'now').mockImplementation(() => now);
    await service.checkOnce();
    now += ZOMBIE_GRACE_PERIOD_MS + 1000;
    await service.checkOnce();

    expect(state.getCall('U5')?.zombieCandidate).toBeFalsy();
  });
});
