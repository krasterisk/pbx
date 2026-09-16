import { ConferenceStateService } from './conference-state.service';

const ROOM_UID = 77;
const CONFERENCE = 'conf6007_42';

function joinEvt(overrides: {
  Channel: string;
  CallerIDNum?: string;
  Admin?: string;
  MarkedUser?: string;
}) {
  return {
    Conference: CONFERENCE,
    Admin: 'No',
    MarkedUser: 'No',
    ...overrides,
  };
}

describe('ConferenceStateService roles and snapshot order', () => {
  let state: ConferenceStateService;

  beforeEach(() => {
    state = new ConferenceStateService();
    state.registerRoom({ uid: ROOM_UID, number: '6007', user_uid: 42 });
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('gives a known caller the role from room settings, not from event flags', () => {
    state.setRoomRights(ROOM_UID, { ownerRef: '601', moderatorRefs: ['602'] });
    state.handleJoin(
      joinEvt({
        Channel: 'PJSIP/601-00000001',
        CallerIDNum: '601',
        Admin: 'No',
        MarkedUser: 'No',
      }),
    );
    expect(state.getSnapshot(ROOM_UID).participants).toHaveLength(1);
    expect(state.getSnapshot(ROOM_UID).participants[0].role).toBe('owner');
  });

  it('falls back to event flags when the caller has no known identity', () => {
    state.setRoomRights(ROOM_UID, { ownerRef: '601', moderatorRefs: ['602'] });
    state.handleJoin(
      joinEvt({
        Channel: 'PJSIP/gst-0001',
        CallerIDNum: '',
        Admin: 'Yes',
        MarkedUser: 'Yes',
      }),
    );
    expect(state.getSnapshot(ROOM_UID).participants[0].role).toBe('moderator');
  });

  it('keeps a single owner row when the caller is both owner and a listed moderator', () => {
    state.setRoomRights(ROOM_UID, { ownerRef: '601', moderatorRefs: ['601'] });
    state.handleJoin(joinEvt({ Channel: 'PJSIP/601-00000001', CallerIDNum: '601' }));
    const participants = state.getSnapshot(ROOM_UID).participants;
    expect(participants).toHaveLength(1);
    expect(participants[0].role).toBe('owner');
  });

  it('gives every caller participant when the room has no owner and no moderators', () => {
    state.setRoomRights(ROOM_UID, { ownerRef: null, moderatorRefs: [] });
    state.handleJoin(
      joinEvt({
        Channel: 'PJSIP/777-00000001',
        CallerIDNum: '777',
        Admin: 'Yes',
        MarkedUser: 'Yes',
      }),
    );
    expect(state.getSnapshot(ROOM_UID).participants[0].role).toBe('participant');
  });

  it('orders snapshot participants by join time, then by channel name', () => {
    jest.useFakeTimers();
    jest.setSystemTime(1_000);
    state.handleJoin(joinEvt({ Channel: 'PJSIP/602-00000002', CallerIDNum: '602' }));
    jest.setSystemTime(2_000);
    state.handleJoin(joinEvt({ Channel: 'PJSIP/601-00000001', CallerIDNum: '601' }));

    expect(state.getSnapshot(ROOM_UID).participants.map((p) => p.channel)).toEqual([
      'PJSIP/602-00000002',
      'PJSIP/601-00000001',
    ]);

    state = new ConferenceStateService();
    state.registerRoom({ uid: ROOM_UID, number: '6007', user_uid: 42 });
    jest.setSystemTime(1_000);
    state.handleJoin(joinEvt({ Channel: 'PJSIP/602-00000002', CallerIDNum: '602' }));
    state.handleJoin(joinEvt({ Channel: 'PJSIP/601-00000001', CallerIDNum: '601' }));

    expect(state.getSnapshot(ROOM_UID).participants.map((p) => p.channel)).toEqual([
      'PJSIP/601-00000001',
      'PJSIP/602-00000002',
    ]);
  });
});
