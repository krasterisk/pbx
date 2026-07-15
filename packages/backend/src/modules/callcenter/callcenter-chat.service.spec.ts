import { ForbiddenException } from '@nestjs/common';
import { CallCenterChatService } from './callcenter-chat.service';
import { CallCenterStateService } from './callcenter-state.service';
import { CallCenterChatController } from './callcenter-chat.controller';

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

describe('CallCenterChatController (authorization)', () => {
  let controller: CallCenterChatController;
  let chatService: jest.Mocked<Pick<CallCenterChatService,
    'buildDirectKey' | 'canAccessChannel' | 'createMessage' | 'resolveSenderName'
    | 'computeRecipientUserIds' | 'broadcastAllKey' | 'groupKey' | 'broadcastQueueKey'
  >>;
  let stateService: { emitEvent: jest.Mock };

  const reqUser = { id: 5, level: 2, vpbx_user_uid: 7 };

  beforeEach(() => {
    chatService = {
      buildDirectKey: jest.fn((a, b) => `dm:${Math.min(a, b)}:${Math.max(a, b)}`),
      canAccessChannel: jest.fn(),
      createMessage: jest.fn().mockImplementation((params) => Promise.resolve({
        uid: 100,
        channel_key: params.channelKey,
        channel_type: params.channelType,
        sender_user_id: params.senderUserId,
        sender_name: params.senderName,
        body: params.body,
        created_at: new Date('2026-07-15T12:00:00Z'),
      })),
      resolveSenderName: jest.fn().mockResolvedValue('Alice'),
      computeRecipientUserIds: jest.fn().mockResolvedValue([5, 9]),
      broadcastAllKey: jest.fn().mockReturnValue('broadcast:all'),
      groupKey: jest.fn((uid) => `group:${uid}`),
      broadcastQueueKey: jest.fn((q) => `broadcast:queue:${q}`),
    };
    stateService = { emitEvent: jest.fn() };
    controller = new CallCenterChatController(
      chatService as unknown as CallCenterChatService,
      stateService as unknown as CallCenterStateService,
    );
  });

  it('emitEvent ccChatMessage with recipientUserIds on direct send', async () => {
    chatService.canAccessChannel.mockResolvedValue(true);

    await controller.sendMessage(
      { channelType: 'direct', body: 'hello', targetUserId: 9 },
      { user: reqUser } as any,
    );

    expect(stateService.emitEvent).toHaveBeenCalledWith(
      'ccChatMessage',
      7,
      expect.objectContaining({
        recipientUserIds: [5, 9],
        sender_user_id: 5,
        body: 'hello',
      }),
    );
  });

  it('ForbiddenException when operator sends broadcast_all', async () => {
    await expect(
      controller.sendMessage(
        { channelType: 'broadcast_all', body: 'announcement' },
        { user: reqUser } as any,
      ),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('ForbiddenException when reading history of foreign direct channel', async () => {
    chatService.canAccessChannel.mockResolvedValue(false);

    await expect(
      controller.getMessages(
        { channelKey: 'dm:1:2' },
        { user: reqUser } as any,
      ),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });
});
