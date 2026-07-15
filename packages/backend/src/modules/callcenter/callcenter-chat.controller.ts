import {
  Controller, Get, Post, Body, Query, Req, UseGuards, ForbiddenException,
} from '@nestjs/common';
import { Request } from 'express';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CallCenterChatService } from './callcenter-chat.service';
import { CallCenterStateService } from './callcenter-state.service';
import {
  SendChatMessageDto,
  CreateChatChannelDto,
  GetHistoryQueryDto,
} from './dto/chat.dto';
import type { CcChatChannelType } from './models/chat-message.model';

const SUPERVISOR_LEVEL = 3;

function assertSupervisor(user: { level: number }): void {
  if (user.level < SUPERVISOR_LEVEL) {
    throw new ForbiddenException('Supervisor access required (level >= 3)');
  }
}

@UseGuards(JwtAuthGuard)
@Controller('callcenter/chat')
export class CallCenterChatController {
  constructor(
    private readonly chatService: CallCenterChatService,
    private readonly stateService: CallCenterStateService,
  ) {}

  @Get('channels')
  listChannels(@Req() req: Request & { user: { id: number; level: number; vpbx_user_uid: number } }) {
    return this.chatService.listChannels(req.user.id, req.user.level, req.user.vpbx_user_uid);
  }

  @Get('contacts')
  listContacts(@Req() req: Request & { user: { vpbx_user_uid: number } }) {
    return this.chatService.listContacts(req.user.vpbx_user_uid);
  }

  @Get('messages')
  async getMessages(
    @Query() query: GetHistoryQueryDto,
    @Req() req: Request & { user: { id: number; level: number; vpbx_user_uid: number } },
  ) {
    const tenant = req.user.vpbx_user_uid;
    const allowed = await this.chatService.canAccessChannel(
      req.user.id,
      req.user.level,
      query.channelKey,
      tenant,
    );
    if (!allowed) {
      throw new ForbiddenException('Access denied to this chat channel');
    }

    const before = query.before ? new Date(query.before) : undefined;
    return this.chatService.getHistory(query.channelKey, tenant, {
      before: before && !Number.isNaN(before.getTime()) ? before : undefined,
      limit: query.limit,
    });
  }

  @Post('messages')
  async sendMessage(
    @Body() dto: SendChatMessageDto,
    @Req() req: Request & { user: { id: number; level: number; vpbx_user_uid: number } },
  ) {
    const tenant = req.user.vpbx_user_uid;
    const senderUserId = req.user.id;

    if (dto.channelType === 'broadcast_all' || dto.channelType === 'broadcast_queue') {
      assertSupervisor(req.user);
    }

    let channelKey: string;
    let queueName: string | undefined;

    switch (dto.channelType) {
      case 'direct': {
        if (!dto.targetUserId) {
          throw new ForbiddenException('targetUserId required for direct messages');
        }
        channelKey = this.chatService.buildDirectKey(senderUserId, dto.targetUserId);
        break;
      }
      case 'group': {
        if (dto.groupUid == null) {
          throw new ForbiddenException('groupUid required for group messages');
        }
        channelKey = this.chatService.groupKey(dto.groupUid);
        break;
      }
      case 'broadcast_all':
        channelKey = this.chatService.broadcastAllKey();
        break;
      case 'broadcast_queue': {
        if (!dto.queue) {
          throw new ForbiddenException('queue required for broadcast_queue messages');
        }
        queueName = dto.queue;
        channelKey = this.chatService.broadcastQueueKey(dto.queue);
        break;
      }
      default:
        throw new ForbiddenException('Invalid channel type');
    }

    if (dto.channelType === 'direct' || dto.channelType === 'group') {
      const allowed = await this.chatService.canAccessChannel(
        senderUserId,
        req.user.level,
        channelKey,
        tenant,
      );
      if (!allowed) {
        throw new ForbiddenException('Access denied to this chat channel');
      }
    }

    const senderName = await this.chatService.resolveSenderName(senderUserId, tenant);
    const message = await this.chatService.createMessage({
      channelType: dto.channelType as CcChatChannelType,
      channelKey,
      body: dto.body,
      senderUserId,
      senderName,
      userUid: tenant,
    });

    const recipientUserIds = await this.chatService.computeRecipientUserIds(
      dto.channelType as CcChatChannelType,
      channelKey,
      queueName,
      senderUserId,
      tenant,
    );

    const payload = {
      uid: message.uid,
      channel_key: message.channel_key,
      channel_type: message.channel_type,
      sender_user_id: message.sender_user_id,
      sender_name: message.sender_name,
      body: message.body,
      created_at: message.created_at,
      recipientUserIds,
    };

    this.stateService.emitEvent('ccChatMessage', tenant, payload);

    const { recipientUserIds: _strip, ...rest } = payload;
    return rest;
  }

  @Post('channels')
  createChannel(
    @Body() dto: CreateChatChannelDto,
    @Req() req: Request & { user: { id: number; vpbx_user_uid: number } },
  ) {
    return this.chatService.createGroup({
      name: dto.name,
      memberUserIds: dto.memberUserIds,
      createdBy: req.user.id,
      userUid: req.user.vpbx_user_uid,
    });
  }
}
