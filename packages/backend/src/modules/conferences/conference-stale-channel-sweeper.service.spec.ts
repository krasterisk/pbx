import { ConferenceStateService } from './conference-state.service';
import {
  ConferenceStaleChannelSweeperService,
  STALE_CHANNEL_THRESHOLD_MS,
} from './conference-stale-channel-sweeper.service';

const ROOM_UID = 77;
const CONFERENCE = 'conf6007_42';
const NOW = 1_000_000;

function joinEvt(channel: string, callerIdNum: string) {
  return {
    Conference: CONFERENCE,
    Channel: channel,
    CallerIDNum: callerIdNum,
    Admin: 'No',
    MarkedUser: 'No',
  };
}

describe('ConferenceStaleChannelSweeperService (16-07)', () => {
  let state: ConferenceStateService;
  let ami: { action: jest.Mock; isConnected: jest.Mock };
  let sweeper: ConferenceStaleChannelSweeperService;

  beforeEach(() => {
    jest.useFakeTimers();
    jest.setSystemTime(NOW);
    state = new ConferenceStateService();
    state.registerRoom({ uid: ROOM_UID, number: '6007', user_uid: 42 });
    ami = {
      action: jest.fn().mockResolvedValue({ response: 'Success' }),
      isConnected: jest.fn().mockReturnValue(true),
    };
    sweeper = new ConferenceStaleChannelSweeperService(state, ami as any);
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  function join(channel: string, callerIdNum: string) {
    state.handleJoin(joinEvt(channel, callerIdNum));
  }

  it('exports a 120000 ms stale threshold as a named constant', () => {
    expect(STALE_CHANNEL_THRESHOLD_MS).toBe(120000);
  });

  it('makes no AMI calls when there are no active rooms', async () => {
    await sweeper.tick();
    expect(ami.action).not.toHaveBeenCalled();
  });

  it('makes no AMI calls when AMI is disconnected', async () => {
    join('PJSIP/601-00000001', '601');
    jest.setSystemTime(NOW + STALE_CHANNEL_THRESHOLD_MS + 1000);
    ami.isConnected.mockReturnValue(false);
    await sweeper.tick();
    expect(ami.action).not.toHaveBeenCalled();
  });

  it('kicks a channel whose last signal is 121 seconds old', async () => {
    join('PJSIP/601-00000001', '601');
    jest.setSystemTime(NOW + 121_000);
    await sweeper.tick();
    expect(ami.action).toHaveBeenCalledTimes(1);
    expect(ami.action.mock.calls[0][0]).toEqual(
      expect.objectContaining({ action: expect.any(String) }),
    );
    expect(Object.prototype.hasOwnProperty.call(ami.action.mock.calls[0][0], 'action')).toBe(
      true,
    );
  });

  it('does not kick a channel whose last signal is 119 seconds old', async () => {
    join('PJSIP/601-00000001', '601');
    jest.setSystemTime(NOW + 119_000);
    await sweeper.tick();
    expect(ami.action).not.toHaveBeenCalled();
  });

  it('does not kick a channel whose last signal is exactly 120 seconds old', async () => {
    join('PJSIP/601-00000001', '601');
    jest.setSystemTime(NOW + 120_000);
    await sweeper.tick();
    expect(ami.action).not.toHaveBeenCalled();
  });

  it('skips an overlapping tick without extra AMI work', async () => {
    join('PJSIP/601-00000001', '601');
    jest.setSystemTime(NOW + 121_000);
    let release!: (value?: unknown) => void;
    ami.action.mockImplementation(
      () =>
        new Promise((resolve) => {
          release = resolve;
        }),
    );
    const first = sweeper.tick();
    await sweeper.tick();
    expect(ami.action).toHaveBeenCalledTimes(1);
    release();
    await first;
  });

  it('continues the walk when AMI fails on the first stale channel', async () => {
    join('PJSIP/601-00000001', '601');
    join('PJSIP/602-00000002', '602');
    jest.setSystemTime(NOW + 121_000);
    ami.action
      .mockRejectedValueOnce(new Error('AMI kick failed'))
      .mockResolvedValueOnce({ response: 'Success' });
    await sweeper.tick();
    expect(ami.action).toHaveBeenCalledTimes(2);
  });
});
