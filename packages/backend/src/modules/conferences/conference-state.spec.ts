import { NotFoundException } from '@nestjs/common';
import { ConferenceParticipantController } from './conference-participant.controller';
import { ConferenceStateService } from './conference-state.service';
import { toConferenceParticipantDto } from './dto/conference-participant.dto';

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

  it('accepts lowercase AMI headers from asterisk-manager', () => {
    state.handleJoin({
      conference: CONFERENCE,
      channel: 'Local/s@krsk-conf-77-00000001;2',
      calleridnum: '16001',
    } as never);
    expect(state.getSnapshot(ROOM_UID).participants).toHaveLength(1);
    expect(state.getSnapshot(ROOM_UID).participants[0].callerIdNum).toBe('16001');
    state.handleLeave({
      conference: CONFERENCE,
      channel: 'Local/s@krsk-conf-77-00000001;2',
    } as never);
    expect(state.getSnapshot(ROOM_UID).participants).toHaveLength(0);
  });

  it('hydrates the room from DB when AMI join arrives before any list/CRUD', async () => {
    const findOne = jest.fn().mockResolvedValue({
      uid: ROOM_UID,
      number: '6007',
      user_uid: 42,
    });
    const moduleRef = {
      get: jest.fn().mockReturnValue({ findOne }),
    };
    const cold = new ConferenceStateService(moduleRef as never);
    await cold.handleJoin(
      joinEvt({
        Channel: 'Local/s@krsk-conf-77-00000001;2',
        CallerIDNum: '16001',
      }),
    );
    expect(findOne).toHaveBeenCalledWith({
      where: { number: '6007', user_uid: 42 },
    });
    expect(cold.getSnapshot(ROOM_UID).participants).toHaveLength(1);
    expect(cold.getSnapshot(ROOM_UID).conference).toBe(CONFERENCE);
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

describe('ConferenceStateService parallel joins (D-34)', () => {
  it('records N participants with unique channels after concurrent handleJoin calls', async () => {
    const state = new ConferenceStateService();
    state.registerRoom({ uid: ROOM_UID, number: '6007', user_uid: 42 });
    const N = 6;

    await Promise.all(
      Array.from({ length: N }, (_, i) =>
        state.handleJoin(
          joinEvt({
            Channel: `PJSIP/60${i}-0000000${i}`,
            CallerIDNum: `60${i}`,
          }),
        ),
      ),
    );

    const snapshot = state.getSnapshot(ROOM_UID);
    expect(snapshot.participants).toHaveLength(N);
    const uniqueChannels = new Set(snapshot.participants.map((p) => p.channel));
    expect(uniqueChannels.size).toBe(N);
  });
});

describe('ConferenceStateService waiting for moderator (16-06)', () => {
  let state: ConferenceStateService;

  function registerWaitingRoom() {
    state.registerRoom({
      uid: ROOM_UID,
      number: '6007',
      user_uid: 42,
      entry_strictness: 'token_name_pin_moderator',
      pin: '1234',
    });
  }

  beforeEach(() => {
    state = new ConferenceStateService();
    registerWaitingRoom();
    state.setRoomRights(ROOM_UID, { ownerRef: '601', moderatorRefs: ['602'] });
  });

  it('reports waiting when wait policy is on and only a participant is present', () => {
    state.handleJoin(joinEvt({ Channel: 'PJSIP/777-00000001', CallerIDNum: '777' }));
    expect(state.getSnapshot(ROOM_UID).waitingForModerator).toBe(true);
  });

  it('clears waiting after a moderator joins', () => {
    state.handleJoin(joinEvt({ Channel: 'PJSIP/777-00000001', CallerIDNum: '777' }));
    expect(state.getSnapshot(ROOM_UID).waitingForModerator).toBe(true);
    state.handleJoin(joinEvt({ Channel: 'PJSIP/602-00000002', CallerIDNum: '602' }));
    expect(state.getSnapshot(ROOM_UID).waitingForModerator).toBe(false);
  });

  it('stays not waiting when wait policy is off', () => {
    state = new ConferenceStateService();
    state.registerRoom({ uid: ROOM_UID, number: '6007', user_uid: 42 });
    state.handleJoin(joinEvt({ Channel: 'PJSIP/777-00000001', CallerIDNum: '777' }));
    expect(state.getSnapshot(ROOM_UID).waitingForModerator).toBe(false);
  });

  it('reports waiting for an empty room with wait policy', () => {
    expect(state.getSnapshot(ROOM_UID).participants).toHaveLength(0);
    expect(state.getSnapshot(ROOM_UID).waitingForModerator).toBe(true);
  });

  it('emits exactly one event when waiting flips to false', () => {
    state.handleJoin(joinEvt({ Channel: 'PJSIP/777-00000001', CallerIDNum: '777' }));
    const events: Array<{ type: string; data: { waitingForModerator?: boolean } }> = [];
    const sub = state.getEventStream(ROOM_UID).subscribe((event) => events.push(event));
    state.handleJoin(joinEvt({ Channel: 'PJSIP/602-00000002', CallerIDNum: '602' }));
    expect(events).toHaveLength(1);
    expect(events[0].data.waitingForModerator).toBe(false);
    sub.unsubscribe();
  });

  it('emits exactly one event when the last privileged participant leaves', () => {
    state.handleJoin(joinEvt({ Channel: 'PJSIP/602-00000002', CallerIDNum: '602' }));
    expect(state.getSnapshot(ROOM_UID).waitingForModerator).toBe(false);
    const events: Array<{ type: string; data: { waitingForModerator?: boolean } }> = [];
    const sub = state.getEventStream(ROOM_UID).subscribe((event) => events.push(event));
    state.handleLeave({
      Conference: CONFERENCE,
      Channel: 'PJSIP/602-00000002',
    });
    expect(events).toHaveLength(1);
    expect(events[0].data.waitingForModerator).toBe(true);
    sub.unsubscribe();
  });

  it('keeps the participant field set unchanged', () => {
    state.handleJoin(joinEvt({ Channel: 'PJSIP/777-00000001', CallerIDNum: '777' }));
    expect(Object.keys(state.getSnapshot(ROOM_UID).participants[0]).sort()).toEqual([
      'callerIdNum',
      'channel',
      'joinedAt',
      'muted',
      'role',
      'talking',
      'video',
    ]);
  });
});

describe('ConferenceStateService video flag (16-07)', () => {
  let state: ConferenceStateService;

  beforeEach(() => {
    state = new ConferenceStateService();
    state.registerRoom({ uid: ROOM_UID, number: '6007', user_uid: 42 });
  });

  it('joins a new participant with video off', () => {
    state.handleJoin(joinEvt({ Channel: 'PJSIP/601-00000001', CallerIDNum: '601' }));
    expect(state.getSnapshot(ROOM_UID).participants[0].video).toBe(false);
  });

  it('setVideoState flips the flag and emits one room event', () => {
    state.handleJoin(joinEvt({ Channel: 'PJSIP/601-00000001', CallerIDNum: '601' }));
    const events: unknown[] = [];
    const sub = state.getEventStream(ROOM_UID).subscribe((event) => events.push(event));
    state.setVideoState(ROOM_UID, '601', true);
    expect(state.getSnapshot(ROOM_UID).participants[0].video).toBe(true);
    expect(events).toHaveLength(1);
    sub.unsubscribe();
  });

  it('setVideoState on an unknown ref emits nothing and creates no participant', () => {
    state.handleJoin(joinEvt({ Channel: 'PJSIP/601-00000001', CallerIDNum: '601' }));
    const events: unknown[] = [];
    const sub = state.getEventStream(ROOM_UID).subscribe((event) => events.push(event));
    state.setVideoState(ROOM_UID, 'нет такого', true);
    expect(events).toHaveLength(0);
    expect(state.getSnapshot(ROOM_UID).participants).toHaveLength(1);
    expect(state.getSnapshot(ROOM_UID).participants[0].video).toBe(false);
    sub.unsubscribe();
  });

  it('repeated setVideoState with the same value emits no extra event', () => {
    state.handleJoin(joinEvt({ Channel: 'PJSIP/601-00000001', CallerIDNum: '601' }));
    state.setVideoState(ROOM_UID, '601', true);
    const events: unknown[] = [];
    const sub = state.getEventStream(ROOM_UID).subscribe((event) => events.push(event));
    state.setVideoState(ROOM_UID, '601', true);
    expect(events).toHaveLength(0);
    sub.unsubscribe();
  });
});

describe('ConferenceStateService display name overlay (16.1-06 D-40)', () => {
  let state: ConferenceStateService;

  beforeEach(() => {
    state = new ConferenceStateService();
    state.registerRoom({ uid: ROOM_UID, number: '6007', user_uid: 42 });
  });

  it('setDisplayName writes overlay onto the live participant and DTO', () => {
    state.handleJoin(joinEvt({ Channel: 'PJSIP/601-00000001', CallerIDNum: '601' }));
    state.setDisplayName(ROOM_UID, '601', 'Мария');
    const live = state.getSnapshot(ROOM_UID).participants[0];
    expect(live.displayName).toBe('Мария');
    expect(toConferenceParticipantDto(live).displayName).toBe('Мария');
  });

  it('rememberDisplayName is copied onto the participant at Join', () => {
    state.rememberDisplayName(ROOM_UID, 'gstabc123', 'Гость Иван');
    state.handleJoin(joinEvt({ Channel: 'PJSIP/gstabc123-00000001', CallerIDNum: 'gstabc123' }));
    expect(state.getSnapshot(ROOM_UID).participants[0].displayName).toBe('Гость Иван');
  });

  it('forgets staff overlay after the last leave empties the room', () => {
    state.handleJoin(joinEvt({ Channel: 'PJSIP/601-00000001', CallerIDNum: '601' }));
    state.setDisplayName(ROOM_UID, '601', 'Мария');
    state.handleLeave({ Conference: CONFERENCE, Channel: 'PJSIP/601-00000001' });
    state.handleJoin(joinEvt({ Channel: 'PJSIP/601-00000001', CallerIDNum: '601' }));
    const live = state.getSnapshot(ROOM_UID).participants[0];
    expect(live.displayName).toBeUndefined();
    expect(toConferenceParticipantDto(live).displayName).toBe('601');
  });
});

describe('ConferenceParticipantController self display name (16.1-06 D-40)', () => {
  const caller = { sub: 5, vpbx_user_uid: 42 };

  function controllerWith(
    rooms: {
      assertLiveRoomAccess: jest.Mock;
      resolveCallerRef: jest.Mock;
    },
    state: ConferenceStateService,
  ) {
    return new ConferenceParticipantController(rooms as any, state);
  }

  it('writes in-memory overlay and never calls endpoint or user update', async () => {
    const state = new ConferenceStateService();
    state.registerRoom({ uid: ROOM_UID, number: '6007', user_uid: 42 });
    state.handleJoin(joinEvt({ Channel: 'PJSIP/601-00000001', CallerIDNum: '601' }));
    const endpointModel = { update: jest.fn() };
    const userModel = { update: jest.fn() };
    const rooms = {
      assertLiveRoomAccess: jest.fn().mockResolvedValue({ uid: ROOM_UID }),
      resolveCallerRef: jest.fn().mockResolvedValue('601'),
    };
    const controller = controllerWith(rooms, state);
    await controller.setMyDisplayName(ROOM_UID, { displayName: 'Мария' }, { user: caller } as any);
    expect(state.getSnapshot(ROOM_UID).participants[0].displayName).toBe('Мария');
    expect(endpointModel.update).not.toHaveBeenCalled();
    expect(userModel.update).not.toHaveBeenCalled();
  });
});

describe('ConferenceParticipantController self video (16-07)', () => {
  const caller = { sub: 5, vpbx_user_uid: 42 };

  function controllerWith(
    rooms: {
      assertLiveRoomAccess: jest.Mock;
      resolveCallerRef: jest.Mock;
    },
    state: ConferenceStateService,
  ) {
    return new ConferenceParticipantController(rooms as any, state);
  }

  it('changes video only for the caller from resolveCallerRef', async () => {
    const state = new ConferenceStateService();
    state.registerRoom({ uid: ROOM_UID, number: '6007', user_uid: 42 });
    state.handleJoin(joinEvt({ Channel: 'PJSIP/601-00000001', CallerIDNum: '601' }));
    state.handleJoin(joinEvt({ Channel: 'PJSIP/602-00000002', CallerIDNum: '602' }));
    const rooms = {
      assertLiveRoomAccess: jest.fn().mockResolvedValue({ uid: ROOM_UID }),
      resolveCallerRef: jest.fn().mockResolvedValue('601'),
    };
    const controller = controllerWith(rooms, state);
    await controller.setMyVideo(ROOM_UID, { enabled: true, ref: '602' } as any, {
      user: caller,
    } as any);
    const participants = state.getSnapshot(ROOM_UID).participants;
    expect(participants.find((item) => item.callerIdNum === '601')?.video).toBe(true);
    expect(participants.find((item) => item.callerIdNum === '602')?.video).toBe(false);
    expect(rooms.resolveCallerRef).toHaveBeenCalledWith(caller);
  });

  it('rejects a foreign tenant room without changing flags', async () => {
    const state = new ConferenceStateService();
    state.registerRoom({ uid: ROOM_UID, number: '6007', user_uid: 42 });
    state.handleJoin(joinEvt({ Channel: 'PJSIP/601-00000001', CallerIDNum: '601' }));
    const rooms = {
      assertLiveRoomAccess: jest.fn().mockRejectedValue(new NotFoundException()),
      resolveCallerRef: jest.fn().mockResolvedValue('601'),
    };
    const controller = controllerWith(rooms, state);
    await expect(
      controller.setMyVideo(ROOM_UID, { enabled: true }, { user: caller } as any),
    ).rejects.toBeInstanceOf(NotFoundException);
    expect(state.getSnapshot(ROOM_UID).participants[0].video).toBe(false);
    expect(rooms.resolveCallerRef).not.toHaveBeenCalled();
  });

  it('rejects a caller who is not in the live room', async () => {
    const state = new ConferenceStateService();
    state.registerRoom({ uid: ROOM_UID, number: '6007', user_uid: 42 });
    state.handleJoin(joinEvt({ Channel: 'PJSIP/602-00000002', CallerIDNum: '602' }));
    const rooms = {
      assertLiveRoomAccess: jest.fn().mockResolvedValue({ uid: ROOM_UID }),
      resolveCallerRef: jest.fn().mockResolvedValue('601'),
    };
    const controller = controllerWith(rooms, state);
    await expect(
      controller.setMyVideo(ROOM_UID, { enabled: true }, { user: caller } as any),
    ).rejects.toBeInstanceOf(NotFoundException);
    expect(state.getSnapshot(ROOM_UID).participants[0].video).toBe(false);
  });

  it('rejects a caller whose number did not resolve', async () => {
    const state = new ConferenceStateService();
    state.registerRoom({ uid: ROOM_UID, number: '6007', user_uid: 42 });
    state.handleJoin(joinEvt({ Channel: 'PJSIP/601-00000001', CallerIDNum: '601' }));
    const rooms = {
      assertLiveRoomAccess: jest.fn().mockResolvedValue({ uid: ROOM_UID }),
      resolveCallerRef: jest.fn().mockResolvedValue(null),
    };
    const controller = controllerWith(rooms, state);
    await expect(
      controller.setMyVideo(ROOM_UID, { enabled: true }, { user: caller } as any),
    ).rejects.toBeInstanceOf(NotFoundException);
    expect(state.getSnapshot(ROOM_UID).participants[0].video).toBe(false);
  });
});

