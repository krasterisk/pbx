import { ForbiddenException } from '@nestjs/common';
import { DialplanApplyService } from '../ami/dialplan-apply.service';
import { ConferenceModerationService } from './conference-moderation.service';
import { ConferenceRoomsService } from './conference-rooms.service';
import { ConferenceStateService } from './conference-state.service';

const VPBX = 42;
const ROOM_UID = 77;
const CONFERENCE = 'conf6007_42';

function roomRow() {
  const data = {
    uid: ROOM_UID,
    number: '6007',
    name: 'Sales conf',
    user_uid: VPBX,
    created_by: 1,
  };
  return { ...data, toJSON: () => ({ ...data }) };
}

describe('ConferenceModerationService (16-05)', () => {
  let userModel: { findOne: jest.Mock };
  let roomModel: { findOne: jest.Mock; findAll: jest.Mock };
  let moderatorModel: { findAll: jest.Mock; create: jest.Mock; destroy: jest.Mock; bulkCreate: jest.Mock };
  let amiService: { action: jest.Mock };
  let loggerService: { logAction: jest.Mock };
  let state: ConferenceStateService;
  let rooms: ConferenceRoomsService;
  let service: ConferenceModerationService;

  function user(overrides: Record<string, unknown> = {}) {
    return { sub: 5, vpbx_user_uid: VPBX, login: 'op', name: 'Op', level: 2, role: 0, ...overrides };
  }

  beforeEach(() => {
    userModel = { findOne: jest.fn() };
    roomModel = {
      findOne: jest.fn().mockResolvedValue(roomRow()),
      findAll: jest.fn().mockResolvedValue([roomRow()]),
    };
    moderatorModel = {
      findAll: jest.fn().mockResolvedValue([
        { endpoint_ref: '601', role: 'owner' },
        { endpoint_ref: '602', role: 'moderator' },
      ]),
      create: jest.fn(),
      destroy: jest.fn(),
      bulkCreate: jest.fn(),
    };
    amiService = { action: jest.fn().mockResolvedValue({ response: 'Success' }) };
    loggerService = { logAction: jest.fn().mockResolvedValue(undefined) };
    state = new ConferenceStateService();
    state.registerRoom({ uid: ROOM_UID, number: '6007', user_uid: VPBX });
    state.setRoomRights(ROOM_UID, { ownerRef: '601', moderatorRefs: ['602'] });
    rooms = new ConferenceRoomsService(
      roomModel as any,
      { transaction: jest.fn() } as any,
      { applyCategories: jest.fn(), deleteCategories: jest.fn() } as unknown as DialplanApplyService,
      state,
      loggerService as any,
      moderatorModel as any,
      userModel as any,
    );
    service = new ConferenceModerationService(
      rooms,
      state,
      amiService as any,
      loggerService as any,
      moderatorModel as any,
    );
  });

  describe('resolveCallerRef', () => {
    it('returns exten and looks up by uniqueid + vpbx_user_uid', async () => {
      userModel.findOne.mockResolvedValue({
        uniqueid: 5,
        vpbx_user_uid: VPBX,
        exten: '602',
        login: 'op',
      });

      await expect(rooms.resolveCallerRef({ sub: 5, vpbx_user_uid: VPBX })).resolves.toBe('602');
      expect(userModel.findOne).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { uniqueid: 5, vpbx_user_uid: VPBX },
        }),
      );
    });

    it('falls back to a numeric login when exten is empty', async () => {
      userModel.findOne.mockResolvedValue({
        uniqueid: 5,
        vpbx_user_uid: VPBX,
        exten: '',
        login: '603',
      });
      await expect(rooms.resolveCallerRef({ sub: 5, vpbx_user_uid: VPBX })).resolves.toBe('603');
    });

    it('returns null when neither exten nor numeric login is present', async () => {
      userModel.findOne.mockResolvedValue({
        uniqueid: 5,
        vpbx_user_uid: VPBX,
        exten: '',
        login: 'alice',
      });
      await expect(rooms.resolveCallerRef({ sub: 5, vpbx_user_uid: VPBX })).resolves.toBeNull();
    });
  });

  describe('muteParticipant', () => {
    beforeEach(() => {
      state.handleJoin({
        Conference: CONFERENCE,
        Channel: 'PJSIP/777-00000001',
        CallerIDNum: '777',
      });
    });

    it('mutes once when the caller is a permanent moderator', async () => {
      userModel.findOne.mockResolvedValue({ uniqueid: 5, vpbx_user_uid: VPBX, exten: '602' });

      await service.muteParticipant(ROOM_UID, '777', user());

      expect(amiService.action).toHaveBeenCalledTimes(1);
      expect(amiService.action.mock.calls[0][0]).toEqual(
        expect.objectContaining({ action: expect.any(String) }),
      );
    });

    it('forbids a caller who is not in room rights', async () => {
      userModel.findOne.mockResolvedValue({ uniqueid: 5, vpbx_user_uid: VPBX, exten: '777' });

      await expect(service.muteParticipant(ROOM_UID, '777', user())).rejects.toBeInstanceOf(
        ForbiddenException,
      );
      expect(amiService.action).not.toHaveBeenCalled();
    });

    it('forbids a caller whose short number cannot be resolved', async () => {
      userModel.findOne.mockResolvedValue({
        uniqueid: 5,
        vpbx_user_uid: VPBX,
        exten: '',
        login: 'alice',
      });

      await expect(service.muteParticipant(ROOM_UID, '777', user())).rejects.toBeInstanceOf(
        ForbiddenException,
      );
      expect(amiService.action).not.toHaveBeenCalled();
    });

    it('ignores a self-declared role on the caller object', async () => {
      userModel.findOne.mockResolvedValue({ uniqueid: 5, vpbx_user_uid: VPBX, exten: '777' });

      await expect(
        service.muteParticipant(ROOM_UID, '777', user({ role: 'owner' })),
      ).rejects.toBeInstanceOf(ForbiddenException);
      expect(amiService.action).not.toHaveBeenCalled();
    });
  });

  describe('assertCanModerate (16.2-02)', () => {
    it('is a public method and still forbids a non-moderator', async () => {
      expect(typeof service.assertCanModerate).toBe('function');
      userModel.findOne.mockResolvedValue({ uniqueid: 5, vpbx_user_uid: VPBX, exten: '777' });
      await expect(service.assertCanModerate(ROOM_UID, user(), 'moderator')).rejects.toMatchObject({
        message: 'Moderator role required',
      });
    });

    it('allows a permanent moderator', async () => {
      userModel.findOne.mockResolvedValue({ uniqueid: 5, vpbx_user_uid: VPBX, exten: '602' });
      await expect(service.assertCanModerate(ROOM_UID, user(), 'moderator')).resolves.toBeUndefined();
    });
  });

  describe('kickParticipant', () => {
    it('kicks via AMI and writes audit for a moderator', async () => {
      userModel.findOne.mockResolvedValue({ uniqueid: 5, vpbx_user_uid: VPBX, exten: '602' });
      state.handleJoin({
        Conference: CONFERENCE,
        Channel: 'PJSIP/777-00000001',
        CallerIDNum: '777',
      });

      await service.kickParticipant(ROOM_UID, '777', user());

      expect(amiService.action).toHaveBeenCalledTimes(1);
      expect(loggerService.logAction).toHaveBeenCalledTimes(1);
    });
  });

  describe('grantRole / revokeRole', () => {
    function joinGuest() {
      state.handleJoin({
        Conference: CONFERENCE,
        Channel: 'PJSIP/gst-0001',
        CallerIDNum: '',
        Admin: 'No',
        MarkedUser: 'No',
      });
    }

    it('lets the owner grant moderator in the live snapshot', async () => {
      userModel.findOne.mockResolvedValue({ uniqueid: 5, vpbx_user_uid: VPBX, exten: '601' });
      state.handleJoin({
        Conference: CONFERENCE,
        Channel: 'PJSIP/777-00000001',
        CallerIDNum: '777',
      });

      await service.grantRole(ROOM_UID, '777', 'moderator', user());

      expect(state.getSnapshot(ROOM_UID).participants.find((p) => p.callerIdNum === '777')?.role).toBe(
        'moderator',
      );
    });

    it('rejects grantRole from a permanent moderator who is not the owner', async () => {
      userModel.findOne.mockResolvedValue({ uniqueid: 5, vpbx_user_uid: VPBX, exten: '602' });
      state.handleJoin({
        Conference: CONFERENCE,
        Channel: 'PJSIP/777-00000001',
        CallerIDNum: '777',
      });

      await expect(
        service.grantRole(ROOM_UID, '777', 'moderator', user()),
      ).rejects.toBeInstanceOf(ForbiddenException);
    });

    it('grants a guest without endpointRef', async () => {
      userModel.findOne.mockResolvedValue({ uniqueid: 5, vpbx_user_uid: VPBX, exten: '601' });
      joinGuest();

      await service.grantRole(ROOM_UID, 'PJSIP/gst-0001', 'moderator', user());

      expect(state.getSnapshot(ROOM_UID).participants[0].role).toBe('moderator');
    });

    it('does not create a conference_room_moderators row', async () => {
      userModel.findOne.mockResolvedValue({ uniqueid: 5, vpbx_user_uid: VPBX, exten: '601' });
      state.handleJoin({
        Conference: CONFERENCE,
        Channel: 'PJSIP/777-00000001',
        CallerIDNum: '777',
      });

      await service.grantRole(ROOM_UID, '777', 'moderator', user());

      expect(moderatorModel.create).not.toHaveBeenCalled();
    });

    it('lets the owner revoke a live grant back to participant', async () => {
      userModel.findOne.mockResolvedValue({ uniqueid: 5, vpbx_user_uid: VPBX, exten: '601' });
      state.handleJoin({
        Conference: CONFERENCE,
        Channel: 'PJSIP/777-00000001',
        CallerIDNum: '777',
      });
      await service.grantRole(ROOM_UID, '777', 'moderator', user());

      await service.revokeRole(ROOM_UID, '777', user());

      expect(state.getSnapshot(ROOM_UID).participants.find((p) => p.callerIdNum === '777')?.role).toBe(
        'participant',
      );
    });

    it('drops live grants when the room empties so the next join is a participant', async () => {
      userModel.findOne.mockResolvedValue({ uniqueid: 5, vpbx_user_uid: VPBX, exten: '601' });
      state.handleJoin({
        Conference: CONFERENCE,
        Channel: 'PJSIP/777-00000001',
        CallerIDNum: '777',
      });
      await service.grantRole(ROOM_UID, '777', 'moderator', user());

      state.handleLeave({
        Conference: CONFERENCE,
        Channel: 'PJSIP/777-00000001',
      });
      state.handleJoin({
        Conference: CONFERENCE,
        Channel: 'PJSIP/777-00000002',
        CallerIDNum: '777',
      });

      expect(state.getSnapshot(ROOM_UID).participants[0].role).toBe('participant');
    });
  });
});
