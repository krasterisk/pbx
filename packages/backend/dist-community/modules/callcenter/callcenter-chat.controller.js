"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
var __param = (this && this.__param) || function (paramIndex, decorator) {
    return function (target, key) { decorator(target, key, paramIndex); }
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.CallCenterChatController = void 0;
const common_1 = require("@nestjs/common");
const jwt_auth_guard_1 = require("../auth/jwt-auth.guard");
const callcenter_chat_service_1 = require("./callcenter-chat.service");
const callcenter_state_service_1 = require("./callcenter-state.service");
const chat_dto_1 = require("./dto/chat.dto");
const callcenter_rbac_util_1 = require("./callcenter-rbac.util");
let CallCenterChatController = class CallCenterChatController {
    chatService;
    stateService;
    constructor(chatService, stateService) {
        this.chatService = chatService;
        this.stateService = stateService;
    }
    listChannels(req) {
        return this.chatService.listChannels(req.user.sub, req.user.level, req.user.vpbx_user_uid);
    }
    listContacts(req) {
        return this.chatService.listContacts(req.user.vpbx_user_uid);
    }
    async getMessages(query, req) {
        const tenant = req.user.vpbx_user_uid;
        const allowed = await this.chatService.canAccessChannel(req.user.sub, req.user.level, query.channelKey, tenant);
        if (!allowed) {
            throw new common_1.ForbiddenException('Access denied to this chat channel');
        }
        const before = query.before ? new Date(query.before) : undefined;
        return this.chatService.getHistory(query.channelKey, tenant, {
            before: before && !Number.isNaN(before.getTime()) ? before : undefined,
            limit: query.limit,
        });
    }
    async sendMessage(dto, req) {
        const tenant = req.user.vpbx_user_uid;
        const senderUserId = req.user.sub;
        if (dto.channelType === 'broadcast_all' || dto.channelType === 'broadcast_queue') {
            (0, callcenter_rbac_util_1.assertSupervisor)(req.user);
        }
        let channelKey;
        let queueName;
        switch (dto.channelType) {
            case 'direct': {
                if (!dto.targetUserId) {
                    throw new common_1.ForbiddenException('targetUserId required for direct messages');
                }
                channelKey = this.chatService.buildDirectKey(senderUserId, dto.targetUserId);
                break;
            }
            case 'group': {
                if (dto.groupUid == null) {
                    throw new common_1.ForbiddenException('groupUid required for group messages');
                }
                channelKey = this.chatService.groupKey(dto.groupUid);
                break;
            }
            case 'broadcast_all':
                channelKey = this.chatService.broadcastAllKey();
                break;
            case 'broadcast_queue': {
                if (!dto.queue) {
                    throw new common_1.ForbiddenException('queue required for broadcast_queue messages');
                }
                queueName = dto.queue;
                channelKey = this.chatService.broadcastQueueKey(dto.queue);
                break;
            }
            default:
                throw new common_1.ForbiddenException('Invalid channel type');
        }
        if (dto.channelType === 'direct' || dto.channelType === 'group') {
            const allowed = await this.chatService.canAccessChannel(senderUserId, req.user.level, channelKey, tenant);
            if (!allowed) {
                throw new common_1.ForbiddenException('Access denied to this chat channel');
            }
        }
        const senderName = await this.chatService.resolveSenderName(senderUserId, tenant);
        const message = await this.chatService.createMessage({
            channelType: dto.channelType,
            channelKey,
            body: dto.body,
            senderUserId,
            senderName,
            userUid: tenant,
        });
        const recipientUserIds = await this.chatService.computeRecipientUserIds(dto.channelType, channelKey, queueName, senderUserId, tenant);
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
    createChannel(dto, req) {
        return this.chatService.createGroup({
            name: dto.name,
            memberUserIds: dto.memberUserIds,
            createdBy: req.user.sub,
            userUid: req.user.vpbx_user_uid,
        });
    }
};
exports.CallCenterChatController = CallCenterChatController;
__decorate([
    (0, common_1.Get)('channels'),
    __param(0, (0, common_1.Req)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", void 0)
], CallCenterChatController.prototype, "listChannels", null);
__decorate([
    (0, common_1.Get)('contacts'),
    __param(0, (0, common_1.Req)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", void 0)
], CallCenterChatController.prototype, "listContacts", null);
__decorate([
    (0, common_1.Get)('messages'),
    __param(0, (0, common_1.Query)()),
    __param(1, (0, common_1.Req)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [chat_dto_1.GetHistoryQueryDto, Object]),
    __metadata("design:returntype", Promise)
], CallCenterChatController.prototype, "getMessages", null);
__decorate([
    (0, common_1.Post)('messages'),
    __param(0, (0, common_1.Body)()),
    __param(1, (0, common_1.Req)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [chat_dto_1.SendChatMessageDto, Object]),
    __metadata("design:returntype", Promise)
], CallCenterChatController.prototype, "sendMessage", null);
__decorate([
    (0, common_1.Post)('channels'),
    __param(0, (0, common_1.Body)()),
    __param(1, (0, common_1.Req)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [chat_dto_1.CreateChatChannelDto, Object]),
    __metadata("design:returntype", void 0)
], CallCenterChatController.prototype, "createChannel", null);
exports.CallCenterChatController = CallCenterChatController = __decorate([
    (0, common_1.UseGuards)(jwt_auth_guard_1.JwtAuthGuard),
    (0, common_1.Controller)('callcenter/chat'),
    __metadata("design:paramtypes", [callcenter_chat_service_1.CallCenterChatService,
        callcenter_state_service_1.CallCenterStateService])
], CallCenterChatController);
//# sourceMappingURL=callcenter-chat.controller.js.map