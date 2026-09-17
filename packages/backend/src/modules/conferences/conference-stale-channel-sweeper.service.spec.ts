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

describe('ConferenceStaleChannelSweeperService (16-07 / CR-02)', () => {
  let state: ConferenceStateService;
  let ami: { confbridgeList: jest.Mock; isConnected: jest.Mock; action: jest.Mock };
  let sweeper: ConferenceStaleChannelSweeperService;

  beforeEach(() => {
    jest.useFakeTimers();
    jest.setSystemTime(NOW);
    state = new ConferenceStateService();
    state.registerRoom({ uid: ROOM_UID, number: '6007', user_uid: 42 });
    ami = {
      confbridgeList: jest.fn().mockResolvedValue({ events: [] }),
      isConnected: jest.fn().mockReturnValue(true),
      action: jest.fn().mockResolvedValue({ response: 'Success' }),
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
    expect(ami.confbridgeList).not.toHaveBeenCalled();
    expect(ami.action).not.toHaveBeenCalled();
  });

  it('makes no AMI calls when AMI is disconnected', async () => {
    join('PJSIP/601-00000001', '601');
    jest.setSystemTime(NOW + STALE_CHANNEL_THRESHOLD_MS + 1000);
    ami.isConnected.mockReturnValue(false);
    await sweeper.tick();
    expect(ami.confbridgeList).not.toHaveBeenCalled();
  });

  it('does not kick a quiet channel still present in ConfbridgeList after 121s', async () => {
    join('PJSIP/601-00000001', '601');
    jest.setSystemTime(NOW + 121_000);
    ami.confbridgeList.mockResolvedValue({
      events: [{ event: 'ConfbridgeList', channel: 'PJSIP/601-00000001' }],
    });
    await sweeper.tick();
    expect(ami.confbridgeList).toHaveBeenCalledWith(CONFERENCE);
    expect(ami.action).not.toHaveBeenCalled();
    expect(state.getSnapshot(ROOM_UID).participants).toHaveLength(1);
    expect(state.isStale('PJSIP/601-00000001', STALE_CHANNEL_THRESHOLD_MS)).toBe(false);
  });

  it('removes a leftover channel missing from ConfbridgeList without ConfbridgeKick', async () => {
    join('PJSIP/601-00000001', '601');
    jest.setSystemTime(NOW + 121_000);
    ami.confbridgeList.mockResolvedValue({ events: [] });
    await sweeper.tick();
    expect(ami.action).not.toHaveBeenCalled();
    expect(state.getSnapshot(ROOM_UID).participants).toHaveLength(0);
  });

  it('refreshes live members and drops only the missing one', async () => {
    join('PJSIP/601-00000001', '601');
    join('PJSIP/602-00000002', '602');
    jest.setSystemTime(NOW + 121_000);
    ami.confbridgeList.mockResolvedValue({
      events: [{ event: 'ConfbridgeList', Channel: 'PJSIP/601-00000001' }],
    });
    await sweeper.tick();
    const refs = state.getSnapshot(ROOM_UID).participants.map((p) => p.channel);
    expect(refs).toEqual(['PJSIP/601-00000001']);
    expect(state.isStale('PJSIP/601-00000001', STALE_CHANNEL_THRESHOLD_MS)).toBe(false);
  });

  it('skips an overlapping tick without extra AMI work', async () => {
    join('PJSIP/601-00000001', '601');
    let release!: (value?: unknown) => void;
    ami.confbridgeList.mockImplementation(
      () =>
        new Promise((resolve) => {
          release = resolve;
        }),
    );
    const first = sweeper.tick();
    await sweeper.tick();
    expect(ami.confbridgeList).toHaveBeenCalledTimes(1);
    release({ events: [{ channel: 'PJSIP/601-00000001' }] });
    await first;
  });

  it('continues the walk when ConfbridgeList fails on the first room', async () => {
    state.registerRoom({ uid: 78, number: '6008', user_uid: 42 });
    state.handleJoin({
      Conference: 'conf6008_42',
      Channel: 'PJSIP/603-00000003',
      CallerIDNum: '603',
      Admin: 'No',
      MarkedUser: 'No',
    });
    join('PJSIP/601-00000001', '601');
    ami.confbridgeList
      .mockRejectedValueOnce(new Error('AMI list failed'))
      .mockResolvedValueOnce({
        events: [{ channel: 'PJSIP/603-00000003' }],
      });
    await sweeper.tick();
    expect(ami.confbridgeList).toHaveBeenCalledTimes(2);
    expect(state.getSnapshot(78).participants).toHaveLength(1);
  });
});
