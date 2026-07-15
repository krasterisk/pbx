import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/sequelize';
import { Op } from 'sequelize';
import { CcChatMessage, CcChatChannelType } from './models/chat-message.model';
import { CcChatChannel } from './models/chat-channel.model';
import { User } from '../users/user.model';
import { CallCenterStateService } from './callcenter-state.service';

export interface ChatChannelSummary {
  channel_key: string;
  type: CcChatChannelType;
  name?: string;
  member_user_ids?: number[];
  queue_name?: string;
}

export interface ChatContact {
  id: number;
  name: string;
  level: number;
}

@Injectable()
export class CallCenterChatService {
  constructor(
    @InjectModel(CcChatMessage) private readonly messageModel: typeof CcChatMessage,
    @InjectModel(CcChatChannel) private readonly channelModel: typeof CcChatChannel,
    @InjectModel(User) private readonly userModel: typeof User,
    private readonly stateService: CallCenterStateService,
  ) {}

  buildDirectKey(a: number, b: number): string {
    const min = Math.min(a, b);
    const max = Math.max(a, b);
    return `dm:${min}:${max}`;
  }

  groupKey(uid: number): string {
    return `group:${uid}`;
  }

  broadcastAllKey(): string {
    return 'broadcast:all';
  }

  broadcastQueueKey(queueName: string): string {
    return `broadcast:queue:${queueName}`;
  }

  parseDirectKey(channelKey: string): [number, number] | null {
    const match = /^dm:(\d+):(\d+)$/.exec(channelKey);
    if (!match) return null;
    return [Number(match[1]), Number(match[2])];
  }

  isDirectParticipant(userId: number, channelKey: string): boolean {
    const ids = this.parseDirectKey(channelKey);
    if (!ids) return false;
    return ids[0] === userId || ids[1] === userId;
  }

  async canAccessChannel(
    userId: number,
    _level: number,
    channelKey: string,
    userUid: number,
  ): Promise<boolean> {
    if (channelKey.startsWith('broadcast:')) {
      return true;
    }

    if (channelKey.startsWith('dm:')) {
      return this.isDirectParticipant(userId, channelKey);
    }

    if (channelKey.startsWith('group:')) {
      const channel = await this.channelModel.findOne({
        where: { channel_key: channelKey, user_uid: userUid },
      });
      if (!channel?.member_user_ids) return false;
      return channel.member_user_ids.includes(userId);
    }

    return false;
  }

  async createMessage(params: {
    channelType: CcChatChannelType;
    channelKey: string;
    body: string;
    senderUserId: number;
    senderName: string | null;
    userUid: number;
  }): Promise<CcChatMessage> {
    return this.messageModel.create({
      channel_key: params.channelKey,
      channel_type: params.channelType,
      sender_user_id: params.senderUserId,
      sender_name: params.senderName,
      body: params.body,
      user_uid: params.userUid,
      created_at: new Date(),
    });
  }

  async getHistory(
    channelKey: string,
    userUid: number,
    opts: { before?: Date; limit?: number } = {},
  ): Promise<CcChatMessage[]> {
    const limit = Math.min(Math.max(opts.limit ?? 50, 1), 100);
    const where: Record<string, unknown> = {
      channel_key: channelKey,
      user_uid: userUid,
    };
    if (opts.before) {
      where.created_at = { [Op.lt]: opts.before };
    }

    const rows = await this.messageModel.findAll({
      where,
      order: [['created_at', 'DESC']],
      limit,
    });
    return rows.reverse();
  }

  async listChannels(userId: number, _level: number, userUid: number): Promise<ChatChannelSummary[]> {
    const result: ChatChannelSummary[] = [];
    const seen = new Set<string>();

    const directRows = await this.messageModel.findAll({
      attributes: ['channel_key'],
      where: { user_uid: userUid, channel_type: 'direct' },
      group: ['channel_key'],
      raw: true,
    }) as { channel_key: string }[];

    for (const row of directRows) {
      if (this.isDirectParticipant(userId, row.channel_key) && !seen.has(row.channel_key)) {
        seen.add(row.channel_key);
        result.push({ channel_key: row.channel_key, type: 'direct' });
      }
    }

    const groups = await this.channelModel.findAll({
      where: { user_uid: userUid, type: 'group' },
    });
    for (const g of groups) {
      if (g.member_user_ids?.includes(userId)) {
        result.push({
          channel_key: g.channel_key,
          type: 'group',
          name: g.name ?? undefined,
          member_user_ids: g.member_user_ids,
        });
        seen.add(g.channel_key);
      }
    }

    result.push({ channel_key: this.broadcastAllKey(), type: 'broadcast_all', name: 'All' });

    const queueBroadcasts = await this.messageModel.findAll({
      attributes: ['channel_key', 'channel_type'],
      where: { user_uid: userUid, channel_type: 'broadcast_queue' },
      group: ['channel_key', 'channel_type'],
      order: [['channel_key', 'ASC']],
      limit: 20,
      raw: true,
    }) as { channel_key: string; channel_type: CcChatChannelType }[];

    for (const row of queueBroadcasts) {
      if (!seen.has(row.channel_key)) {
        const queueName = row.channel_key.replace(/^broadcast:queue:/, '');
        result.push({
          channel_key: row.channel_key,
          type: 'broadcast_queue',
          queue_name: queueName,
          name: queueName,
        });
        seen.add(row.channel_key);
      }
    }

    return result;
  }

  async createGroup(params: {
    name: string;
    memberUserIds: number[];
    createdBy: number;
    userUid: number;
  }): Promise<CcChatChannel> {
    const members = [...new Set([...params.memberUserIds, params.createdBy])];
    const channel = await this.channelModel.create({
      channel_key: 'pending',
      type: 'group',
      name: params.name,
      member_user_ids: members,
      created_by: params.createdBy,
      user_uid: params.userUid,
      created_at: new Date(),
    });
    const channelKey = this.groupKey(channel.uid);
    await channel.update({ channel_key: channelKey });
    channel.channel_key = channelKey;
    return channel;
  }

  async listContacts(userUid: number): Promise<ChatContact[]> {
    const users = await this.userModel.findAll({
      where: { vpbx_user_uid: userUid },
      attributes: ['uniqueid', 'name', 'level'],
      order: [['name', 'ASC']],
    });
    return users.map(u => ({
      id: u.uniqueid,
      name: u.name,
      level: u.level,
    }));
  }

  async resolveSenderName(senderUserId: number, userUid: number): Promise<string | null> {
    const user = await this.userModel.findOne({
      where: { uniqueid: senderUserId, vpbx_user_uid: userUid },
      attributes: ['name'],
    });
    return user?.name ?? null;
  }

  async computeRecipientUserIds(
    channelType: CcChatChannelType,
    channelKey: string,
    queueName: string | undefined,
    senderUserId: number,
    userUid: number,
  ): Promise<number[] | undefined> {
    if (channelType === 'direct') {
      const ids = this.parseDirectKey(channelKey);
      return ids ? [...ids] : [senderUserId];
    }

    if (channelType === 'group') {
      const channel = await this.channelModel.findOne({
        where: { channel_key: channelKey, user_uid: userUid },
      });
      return channel?.member_user_ids ? [...channel.member_user_ids] : [];
    }

    if (channelType === 'broadcast_all') {
      return undefined;
    }

    if (channelType === 'broadcast_queue') {
      const qName = queueName || channelKey.replace(/^broadcast:queue:/, '');
      const agents = this.stateService.getAllAgents(userUid);
      const ids = new Set<number>([senderUserId]);
      for (const agent of agents) {
        if (agent.queues.includes(qName)) {
          ids.add(agent.userId);
        }
      }
      return [...ids];
    }

    return [];
  }
}
