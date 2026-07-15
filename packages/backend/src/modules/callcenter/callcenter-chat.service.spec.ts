import { CallCenterChatService } from './callcenter-chat.service';
import { CallCenterStateService } from './callcenter-state.service';

describe('CallCenterChatService', () => {
  let service: CallCenterChatService;
  let messageModel: { create: jest.Mock; findAll: jest.Mock };
  let channelModel: { findOne: jest.Mock; create: jest.Mock; findAll: jest.Mock };
  let userModel: { findAll: jest.Mock; findOne: jest.Mock };
  let stateService: { getAllAgents: jest.Mock };

  beforeEach(() => {
    messageModel = {
      create: jest.fn().mockImplementation((data) => Promise.resolve({ uid: 1, ...data })),
      findAll: jest.fn().mockResolvedValue([]),
    };
    channelModel = {
      findOne: jest.fn().mockResolvedValue(null),
      create: jest.fn().mockImplementation((data) => Promise.resolve({ uid: 10, update: jest.fn(), ...data })),
      findAll: jest.fn().mockResolvedValue([]),
    };
    userModel = {
      findAll: jest.fn().mockResolvedValue([]),
      findOne: jest.fn().mockResolvedValue(null),
    };
    stateService = {
      getAllAgents: jest.fn().mockReturnValue([]),
    };

    service = new CallCenterChatService(
      messageModel as any,
      channelModel as any,
      userModel as any,
      stateService as unknown as CallCenterStateService,
    );
  });

  describe('buildDirectKey', () => {
    it('is symmetric and sorts ids', () => {
      expect(service.buildDirectKey(5, 3)).toBe('dm:3:5');
      expect(service.buildDirectKey(3, 5)).toBe('dm:3:5');
      expect(service.buildDirectKey(7, 7)).toBe('dm:7:7');
    });
  });

  describe('canAccessChannel', () => {
    it('returns false for direct channel when userId is not a participant', async () => {
      const key = service.buildDirectKey(1, 2);
      await expect(service.canAccessChannel(99, 2, key, 7)).resolves.toBe(false);
    });

    it('returns true for direct channel participant', async () => {
      const key = service.buildDirectKey(1, 2);
      await expect(service.canAccessChannel(1, 2, key, 7)).resolves.toBe(true);
    });

    it('returns false for group when userId not in member_user_ids', async () => {
      channelModel.findOne.mockResolvedValue({
        member_user_ids: [1, 2],
      });
      await expect(service.canAccessChannel(99, 2, 'group:10', 7)).resolves.toBe(false);
    });

    it('returns true for group member', async () => {
      channelModel.findOne.mockResolvedValue({
        member_user_ids: [1, 2],
      });
      await expect(service.canAccessChannel(2, 2, 'group:10', 7)).resolves.toBe(true);
    });
  });

  describe('computeRecipientUserIds', () => {
    it('returns exactly two participants for direct channel', async () => {
      const key = service.buildDirectKey(4, 9);
      await expect(service.computeRecipientUserIds('direct', key, undefined, 4, 7))
        .resolves.toEqual([4, 9]);
    });

    it('returns undefined for broadcast_all (whole tenant)', async () => {
      await expect(
        service.computeRecipientUserIds('broadcast_all', 'broadcast:all', undefined, 1, 7),
      ).resolves.toBeUndefined();
    });
  });
});
