import 'reflect-metadata';
import { HttpException, HttpStatus } from '@nestjs/common';
import { ConferenceStateService } from './conference-state.service';
import { conferenceRoomContextName } from './conference-dialplan.util';
import { normalizeTarget } from '../../shared/utils/dialplan-target.util';

const VPBX = 42;
const UNIQUEID = '1698765432.1234';
const EPHEMERAL_NUMBER = '16987654321234';
const ROOM_UID = 88;
const OPERATOR_SUB = 7;

function createdRoom(overrides: Record<string, unknown> = {}) {
  const data = {
    uid: ROOM_UID,
    number: EPHEMERAL_NUMBER,
    name: EPHEMERAL_NUMBER,
    user_uid: VPBX,
    kind: 'ephemeral',
    entry_strictness: 'token_name',
    created_by: null,
    ...overrides,
  };
  return {
    ...data,
    toJSON: () => ({ ...data }),
  };
}

describe('ConferenceEphemeralService (16-02)', () => {
  let roomsService: {
    create: jest.Mock;
    remove: jest.Mock;
  };
  let roomModel: { findOne: jest.Mock };
  let stateService: {
    getSnapshot: jest.Mock;
  };
  let service: {
    ensureRoomForCall: (
      uniqueid: string,
      vpbx: number,
      createdBy?: number | null,
    ) => Promise<{ roomUid: number; contextName: string; asteriskName: string }>;
    collectIfEmpty: (roomUid: number) => Promise<void>;
  };

  function loadService() {
    const { ConferenceEphemeralService } = require('./conference-ephemeral.service');
    service = new ConferenceEphemeralService(roomsService, roomModel, stateService);
  }

  beforeEach(() => {
    roomsService = {
      create: jest.fn(),
      remove: jest.fn().mockResolvedValue({ success: true }),
    };
    roomModel = {
      findOne: jest.fn(),
    };
    stateService = {
      getSnapshot: jest.fn().mockReturnValue({ roomUid: ROOM_UID, conference: null, participants: [] }),
    };
  });

  describe('ensureRoomForCall', () => {
    it('creates an ephemeral room whose number is digits from uniqueid', async () => {
      roomModel.findOne.mockResolvedValue(null);
      roomsService.create.mockResolvedValue(createdRoom());
      loadService();

      const result = await service.ensureRoomForCall(UNIQUEID, VPBX);

      expect(roomsService.create).toHaveBeenCalledWith(
        expect.objectContaining({
          number: EPHEMERAL_NUMBER,
          name: EPHEMERAL_NUMBER,
          kind: 'ephemeral',
          entry_strictness: 'token_name',
        }),
        VPBX,
        null,
      );
      expect(/^\d+$/.test(EPHEMERAL_NUMBER)).toBe(true);
      expect(result.roomUid).toBe(ROOM_UID);
      expect(result.contextName).toBe(conferenceRoomContextName(ROOM_UID));
      expect(result.asteriskName).toBe(
        normalizeTarget('conference', { source: 'fixed', value: EPHEMERAL_NUMBER }, VPBX),
      );
    });

    it('passes createdBy=7 through to ConferenceRoomsService.create', async () => {
      roomModel.findOne.mockResolvedValue(null);
      roomsService.create.mockImplementation(async (_dto: unknown, _vpbx: number, createdBy: number | null) =>
        createdRoom({ created_by: createdBy }),
      );
      loadService();

      await service.ensureRoomForCall(UNIQUEID, VPBX, OPERATOR_SUB);

      expect(roomsService.create).toHaveBeenCalledWith(expect.any(Object), VPBX, OPERATOR_SUB);
      expect(roomsService.create.mock.calls[0][2]).toBe(7);
    });

    it('stores created_by=null when the third argument is omitted or null', async () => {
      roomModel.findOne.mockResolvedValue(null);
      roomsService.create.mockImplementation(async (_dto: unknown, _vpbx: number, createdBy: number | null) =>
        createdRoom({ created_by: createdBy ?? null }),
      );
      loadService();

      await service.ensureRoomForCall(UNIQUEID, VPBX);
      expect(roomsService.create.mock.calls[0][2]).toBeNull();

      roomsService.create.mockClear();
      await service.ensureRoomForCall(UNIQUEID, VPBX, null);
      expect(roomsService.create.mock.calls[0][2]).toBeNull();
    });

    it('reuses the existing room for the same uniqueid and tenant', async () => {
      const existing = createdRoom();
      roomModel.findOne
        .mockResolvedValueOnce(null)
        .mockResolvedValueOnce(existing);
      roomsService.create.mockResolvedValue(existing);
      loadService();

      const first = await service.ensureRoomForCall(UNIQUEID, VPBX);
      const second = await service.ensureRoomForCall(UNIQUEID, VPBX);

      expect(first.roomUid).toBe(second.roomUid);
      expect(roomsService.create).toHaveBeenCalledTimes(1);
      expect(roomModel.findOne).toHaveBeenCalledWith({
        where: { user_uid: VPBX, number: EPHEMERAL_NUMBER },
      });
    });

    it('rejects a uniqueid with no digits as CONFERENCE_NUMBER_INVALID', async () => {
      loadService();

      try {
        await service.ensureRoomForCall('....', VPBX);
        throw new Error('expected CONFERENCE_NUMBER_INVALID');
      } catch (err) {
        expect(err).toBeInstanceOf(HttpException);
        expect((err as HttpException).getStatus()).toBe(HttpStatus.BAD_REQUEST);
        expect((err as HttpException).getResponse()).toMatchObject({
          code: 'CONFERENCE_NUMBER_INVALID',
        });
      }
      expect(roomsService.create).not.toHaveBeenCalled();
    });
  });

  describe('collectIfEmpty', () => {
    it('does not remove a permanent room even when empty', async () => {
      roomModel.findOne.mockResolvedValue(createdRoom({ kind: 'permanent' }));
      loadService();

      await service.collectIfEmpty(ROOM_UID);

      expect(roomsService.remove).not.toHaveBeenCalled();
    });

    it('removes an empty ephemeral room once', async () => {
      roomModel.findOne.mockResolvedValue(createdRoom({ kind: 'ephemeral', user_uid: VPBX }));
      stateService.getSnapshot.mockReturnValue({
        roomUid: ROOM_UID,
        conference: null,
        participants: [],
      });
      loadService();

      await service.collectIfEmpty(ROOM_UID);

      expect(roomsService.remove).toHaveBeenCalledTimes(1);
      expect(roomsService.remove).toHaveBeenCalledWith(ROOM_UID, VPBX);
    });

    it('does not remove an ephemeral room that still has a participant', async () => {
      roomModel.findOne.mockResolvedValue(createdRoom({ kind: 'ephemeral' }));
      stateService.getSnapshot.mockReturnValue({
        roomUid: ROOM_UID,
        conference: 'conf16987654321234_42',
        participants: [{ channel: 'PJSIP/101-0001', callerIdNum: '101', role: 'participant', talking: false, muted: false }],
      });
      loadService();

      await service.collectIfEmpty(ROOM_UID);

      expect(roomsService.remove).not.toHaveBeenCalled();
    });
  });
});

describe('ConferenceStateService handleLeave → collectIfEmpty', () => {
  it('calls collectIfEmpty with the roomUid after the last participant leaves', async () => {
    const collectIfEmpty = jest.fn().mockResolvedValue(undefined);
    const moduleRef = {
      get: jest.fn().mockReturnValue({ collectIfEmpty }),
    };
    const state = new ConferenceStateService(moduleRef as any);
    state.registerRoom({ uid: ROOM_UID, number: EPHEMERAL_NUMBER, user_uid: VPBX });
    state.handleJoin({
      Conference: `conf${EPHEMERAL_NUMBER}_${VPBX}`,
      Channel: 'PJSIP/gst-0001',
      CallerIDNum: '6007',
      Admin: 'No',
      MarkedUser: 'No',
    });
    expect(state.getSnapshot(ROOM_UID).participants).toHaveLength(1);

    state.handleLeave({
      Conference: `conf${EPHEMERAL_NUMBER}_${VPBX}`,
      Channel: 'PJSIP/gst-0001',
    });

    expect(state.getSnapshot(ROOM_UID).participants).toHaveLength(0);
    await Promise.resolve();
    expect(collectIfEmpty).toHaveBeenCalledWith(ROOM_UID);
    expect(moduleRef.get).toHaveBeenCalledWith('ConferenceEphemeralService', { strict: false });
  });
});
