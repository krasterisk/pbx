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
exports.CallCenterChatService = void 0;
const common_1 = require("@nestjs/common");
const sequelize_1 = require("@nestjs/sequelize");
const sequelize_2 = require("sequelize");
const chat_message_model_1 = require("./models/chat-message.model");
const chat_channel_model_1 = require("./models/chat-channel.model");
const user_model_1 = require("../users/user.model");
const callcenter_state_service_1 = require("./callcenter-state.service");
let CallCenterChatService = class CallCenterChatService {
    messageModel;
    channelModel;
    userModel;
    stateService;
    constructor(messageModel, channelModel, userModel, stateService) {
        this.messageModel = messageModel;
        this.channelModel = channelModel;
        this.userModel = userModel;
        this.stateService = stateService;
    }
    buildDirectKey(a, b) {
        const min = Math.min(a, b);
        const max = Math.max(a, b);
        return `dm:${min}:${max}`;
    }
    groupKey(uid) {
        return `group:${uid}`;
    }
    broadcastAllKey() {
        return 'broadcast:all';
    }
    broadcastQueueKey(queueName) {
        return `broadcast:queue:${queueName}`;
    }
    parseDirectKey(channelKey) {
        const match = /^dm:(\d+):(\d+)$/.exec(channelKey);
        if (!match)
            return null;
        return [Number(match[1]), Number(match[2])];
    }
    isDirectParticipant(userId, channelKey) {
        const ids = this.parseDirectKey(channelKey);
        if (!ids)
            return false;
        return ids[0] === userId || ids[1] === userId;
    }
    async canAccessChannel(userId, _level, channelKey, userUid) {
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
            if (!channel?.member_user_ids)
                return false;
            return channel.member_user_ids.includes(userId);
        }
        return false;
    }
    async createMessage(params) {
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
    async getHistory(channelKey, userUid, opts = {}) {
        const limit = Math.min(Math.max(opts.limit ?? 50, 1), 100);
        const where = {
            channel_key: channelKey,
            user_uid: userUid,
        };
        if (opts.before) {
            where.created_at = { [sequelize_2.Op.lt]: opts.before };
        }
        const rows = await this.messageModel.findAll({
            where,
            order: [['created_at', 'DESC']],
            limit,
        });
        return rows.reverse();
    }
    async listChannels(userId, _level, userUid) {
        const result = [];
        const seen = new Set();
        const directRows = await this.messageModel.findAll({
            attributes: ['channel_key'],
            where: { user_uid: userUid, channel_type: 'direct' },
            group: ['channel_key'],
            raw: true,
        });
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
        });
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
    async createGroup(params) {
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
    async listContacts(userUid) {
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
    async resolveSenderName(senderUserId, userUid) {
        const user = await this.userModel.findOne({
            where: { uniqueid: senderUserId, vpbx_user_uid: userUid },
            attributes: ['name'],
        });
        return user?.name ?? null;
    }
    async computeRecipientUserIds(channelType, channelKey, queueName, senderUserId, userUid) {
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
            const ids = new Set([senderUserId]);
            for (const agent of agents) {
                if (agent.queues.includes(qName)) {
                    ids.add(agent.userId);
                }
            }
            return [...ids];
        }
        return [];
    }
};
exports.CallCenterChatService = CallCenterChatService;
exports.CallCenterChatService = CallCenterChatService = __decorate([
    (0, common_1.Injectable)(),
    __param(0, (0, sequelize_1.InjectModel)(chat_message_model_1.CcChatMessage)),
    __param(1, (0, sequelize_1.InjectModel)(chat_channel_model_1.CcChatChannel)),
    __param(2, (0, sequelize_1.InjectModel)(user_model_1.User)),
    __metadata("design:paramtypes", [Object, Object, Object, callcenter_state_service_1.CallCenterStateService])
], CallCenterChatService);
//# sourceMappingURL=callcenter-chat.service.js.map