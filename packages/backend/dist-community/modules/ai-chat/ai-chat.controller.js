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
var AiChatController_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.AiChatController = void 0;
const common_1 = require("@nestjs/common");
const swagger_1 = require("@nestjs/swagger");
const class_validator_1 = require("class-validator");
const throttler_1 = require("@nestjs/throttler");
const sequelize_1 = require("@nestjs/sequelize");
const jwt_auth_guard_1 = require("../auth/jwt-auth.guard");
const pbx_context_builder_service_1 = require("./pbx-context-builder.service");
const ai_chat_settings_service_1 = require("./ai-chat-settings.service");
const logger_service_1 = require("../logger/logger.service");
const pbx_agent_loop_service_1 = require("./pbx-agent-loop.service");
const pbx_agent_thread_service_1 = require("./pbx-agent-thread.service");
const ai_providers_service_1 = require("../ai-connectivity/ai-providers.service");
const agent_proposal_model_1 = require("./models/agent-proposal.model");
const agent_diff_dto_1 = require("./dto/agent-diff.dto");
const agent_sse_util_1 = require("./agent-sse.util");
const agent_timeline_util_1 = require("./agent-timeline.util");
const pbx_workflow_runner_service_1 = require("./pbx-workflow-runner.service");
const thread_visibility_service_1 = require("./thread-visibility.service");
const user_model_1 = require("../users/user.model");
const BODY_IDENTITY_KEYS = [
    'tenantUid',
    'authorUid',
    'role',
    'tenant',
    'author',
    'vpbxUserUid',
    'vpbx_user_uid',
    'user_uid',
];
class SendMessageDto {
    message;
    threadUid;
    locale;
}
__decorate([
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], SendMessageDto.prototype, "message", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsInt)(),
    __metadata("design:type", Number)
], SendMessageDto.prototype, "threadUid", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], SendMessageDto.prototype, "locale", void 0);
class UpdateAiChatSettingsDto {
    confirmDestructive;
    seeAllThreads;
}
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsBoolean)(),
    __metadata("design:type", Boolean)
], UpdateAiChatSettingsDto.prototype, "confirmDestructive", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsBoolean)(),
    __metadata("design:type", Boolean)
], UpdateAiChatSettingsDto.prototype, "seeAllThreads", void 0);
class UpdateDefaultProviderDto {
    providerUid;
}
__decorate([
    (0, class_validator_1.IsInt)(),
    __metadata("design:type", Number)
], UpdateDefaultProviderDto.prototype, "providerUid", void 0);
const ADMIN_LEVELS = new Set([0, 1]);
/**
 * AiChatController — in-process agent turn (D-06).
 *
 * Rate limits:
 *   - GET/settings and thread create/delete: skip app-wide throttles
 *   - POST /message and /continue: 10 requests/minute
 */
let AiChatController = AiChatController_1 = class AiChatController {
    loop;
    threads;
    contextBuilder;
    aiChatSettingsService;
    providers;
    loggerService;
    proposals;
    workflows;
    visibility;
    users;
    logger = new common_1.Logger(AiChatController_1.name);
    constructor(loop, threads, contextBuilder, aiChatSettingsService, providers, loggerService, proposals, workflows, visibility, users) {
        this.loop = loop;
        this.threads = threads;
        this.contextBuilder = contextBuilder;
        this.aiChatSettingsService = aiChatSettingsService;
        this.providers = providers;
        this.loggerService = loggerService;
        this.proposals = proposals;
        this.workflows = workflows;
        this.visibility = visibility;
        this.users = users;
    }
    async listThreads(req) {
        const { tenantUid, authorUid } = this.identityFromToken(req);
        const rows = await this.threads.listThreads(tenantUid, authorUid);
        return rows.map((row) => this.toThreadJson(row));
    }
    async createThread(req) {
        const { tenantUid, authorUid } = this.identityFromToken(req);
        const row = await this.threads.createThread(tenantUid, authorUid);
        return this.toThreadJson(row);
    }
    async listSharedThreads(req) {
        const { tenantUid, authorUid, role } = this.identityFromToken(req);
        const scope = await this.visibility.resolve(tenantUid, authorUid, role);
        const rows = await this.threads.listReadableThreads(tenantUid, scope, authorUid);
        const names = await this.ownerNamesByUid(rows.map((row) => row.user_uid), tenantUid);
        return rows.map((row) => ({
            ...this.toThreadJson(row),
            ownerName: names.get(row.user_uid) ?? '',
            readOnly: true,
        }));
    }
    async getThread(uid, req) {
        const { tenantUid, authorUid, role } = this.identityFromToken(req);
        const scope = await this.visibility.resolve(tenantUid, authorUid, role);
        const thread = await this.threads.getReadableThread(uid, tenantUid, authorUid, scope);
        const messages = await this.threads.listReadableMessages(uid, tenantUid, authorUid, scope);
        const threadAuthorUid = thread.user_uid;
        const proposalById = await this.proposalViewsFor(messages, tenantUid, threadAuthorUid);
        const workflowById = await this.workflowViewsFor(messages, tenantUid, threadAuthorUid, role, new Set(proposalById.keys()));
        const proposalRefs = new Map();
        for (const id of proposalById.keys()) {
            proposalRefs.set(id, { proposalId: id, card: 'single' });
        }
        for (const id of workflowById.keys()) {
            proposalRefs.set(id, { proposalId: id, card: 'workflow' });
        }
        const timeline = (0, agent_timeline_util_1.buildTimeline)(messages.filter((row) => row.visibility !== 'internal'), { proposals: proposalRefs });
        const isOwn = threadAuthorUid === authorUid;
        const ownerName = isOwn
            ? undefined
            : (await this.ownerNamesByUid([threadAuthorUid], tenantUid)).get(threadAuthorUid) ?? '';
        return {
            ...this.toThreadJson(thread),
            ...(isOwn ? {} : { ownerName }),
            readOnly: !isOwn,
            timeline,
            cards: this.cardsFor(messages, proposalById, workflowById),
        };
    }
    async continueThread(uid, req, res) {
        this.rejectBodyIdentity(req.body ?? {});
        const { tenantUid, authorUid } = this.identityFromToken(req);
        await this.threads.getThread(uid, tenantUid, authorUid);
        await this.streamTurn(pbx_agent_loop_service_1.CONTINUE_AFTER_APPLY_PROMPT, uid, req, res, { visibility: 'internal' });
    }
    async deleteThread(uid, req) {
        const { tenantUid, authorUid, role } = this.identityFromToken(req);
        await this.threads.deleteThread(uid, tenantUid, authorUid);
        await this.workflows.deleteForThread(uid, { vpbxUserUid: tenantUid, userUid: authorUid, role });
        await this.proposals.destroy({
            where: { thread_uid: uid, vpbx_user_uid: tenantUid, user_uid: authorUid },
        });
    }
    async getDefaultProvider(req) {
        this.assertAdmin(req);
        const tenantUid = Number(req.user.vpbx_user_uid);
        const providerUid = await this.aiChatSettingsService.getDefaultProviderUid(tenantUid);
        return { providerUid };
    }
    async setDefaultProvider(dto, req) {
        this.assertAdmin(req);
        const tenantUid = Number(req.user.vpbx_user_uid);
        await this.providers.findOne(dto.providerUid, tenantUid);
        const providerUid = await this.aiChatSettingsService.setDefaultProviderUid(tenantUid, dto.providerUid);
        return { providerUid };
    }
    async getSettings(req) {
        return this.aiChatSettingsService.getSettings(req.user.vpbx_user_uid);
    }
    async updateSettings(dto, req) {
        if (dto.seeAllThreads !== undefined) {
            this.assertAdmin(req);
        }
        return this.aiChatSettingsService.updateSettings(req.user.vpbx_user_uid, dto);
    }
    async getState(req) {
        return this.contextBuilder.buildState(req.user.vpbx_user_uid);
    }
    /** Tenants do not pick a model (D-07). Kept so existing clients stay on 200. */
    async getModels() {
        return [];
    }
    /**
     * POST /api/ai-chat/message
     * Streams the in-process turn. Tenant, author and role come from the token.
     */
    async sendMessage(dto, req, res) {
        this.rejectBodyIdentity(req.body ?? dto);
        const { tenantUid, authorUid } = this.identityFromToken(req);
        const conversation = dto.threadUid
            ? await this.threads.getThread(dto.threadUid, tenantUid, authorUid)
            : await this.threads.createThread(tenantUid, authorUid);
        await this.streamTurn(dto.message, conversation.uid, req, res, {
            visibility: 'public',
            locale: this.resolveLocale(dto.locale, req),
        });
    }
    assertAdmin(req) {
        if (!ADMIN_LEVELS.has(Number(req.user?.level))) {
            throw new common_1.ForbiddenException('Admin access required to choose the chat provider');
        }
    }
    identityFromToken(req) {
        return {
            tenantUid: Number(req.user?.vpbx_user_uid),
            authorUid: Number(req.user?.sub || req.user?.id || 0),
            role: Number(req.user?.level ?? 1),
        };
    }
    toIso(value) {
        if (!value)
            return null;
        return value instanceof Date ? value.toISOString() : String(value);
    }
    toThreadJson(thread) {
        return {
            uid: thread.uid,
            title: thread.title,
            status: thread.status,
            last_message_at: this.toIso(thread.last_message_at),
            created_at: this.toIso(thread.created_at) ?? '',
            updated_at: this.toIso(thread.updated_at) ?? '',
        };
    }
    async ownerNamesByUid(authorUids, tenantUid) {
        const unique = [...new Set(authorUids.filter((id) => Number(id) > 0))];
        if (!unique.length)
            return new Map();
        const rows = await this.users.findAll({
            where: { uniqueid: unique, vpbx_user_uid: tenantUid },
            attributes: ['uniqueid', 'name', 'login'],
        });
        return new Map(rows.map((row) => [row.uniqueid, row.name || row.login || '']));
    }
    async streamTurn(message, threadUid, req, res, opts) {
        const { tenantUid, authorUid, role } = this.identityFromToken(req);
        const startedAt = Date.now();
        res.setHeader('Content-Type', 'text/event-stream');
        res.setHeader('Cache-Control', 'no-cache');
        res.setHeader('Connection', 'keep-alive');
        res.setHeader('X-Accel-Buffering', 'no');
        res.flushHeaders();
        const abortController = new AbortController();
        req.on?.('close', () => abortController.abort());
        const session = new agent_sse_util_1.SseStreamSession((chunk) => res.write(chunk), agent_sse_util_1.DEFAULT_SSE_HEARTBEAT_MS);
        session.startHeartbeat();
        let hasError = false;
        try {
            for await (const event of this.loop.runTurn(message, { uid: threadUid }, {
                tenantUid,
                authorUid,
                role,
                locale: opts.locale ?? this.resolveLocale(undefined, req),
                signal: abortController.signal,
                userVisibility: opts.visibility,
            })) {
                if (abortController.signal.aborted)
                    break;
                session.emit(event.name, event.data);
                if (event.name === 'error')
                    hasError = true;
            }
        }
        catch (err) {
            hasError = true;
            if (!abortController.signal.aborted) {
                const text = err instanceof Error ? err.message : 'Unknown error';
                session.emit('error', text);
            }
        }
        finally {
            session.stop();
            res.end();
        }
        const durationMs = Date.now() - startedAt;
        this.loggerService.logAction(authorUid, 'ai_chat', 'ai_dialog', threadUid, tenantUid, `"${message.slice(0, 100)}" | ${durationMs}ms`, hasError ? 'error' : 'success').catch((error) => this.logger.warn(`Audit log failed: ${error.message}`));
    }
    async proposalViewsFor(messages, tenantUid, authorUid) {
        const ids = [...new Set(messages.map((row) => row.proposal_id).filter((id) => !!id))];
        if (!ids.length)
            return new Map();
        const rows = await this.proposals.findAll({
            where: { proposal_id: ids, vpbx_user_uid: tenantUid, user_uid: authorUid },
        });
        return new Map(rows.map((row) => [row.proposal_id, (0, agent_diff_dto_1.toProposalView)(row)]));
    }
    async workflowViewsFor(messages, tenantUid, authorUid, role, knownProposalIds) {
        const ids = [...new Set(messages
                .map((row) => row.proposal_id)
                .filter((id) => !!id && !knownProposalIds.has(id)))];
        const views = new Map();
        for (const id of ids) {
            try {
                const view = await this.workflows.getOwned(id, {
                    vpbxUserUid: tenantUid,
                    userUid: authorUid,
                    role,
                });
                views.set(id, view);
            }
            catch (err) {
                if (err instanceof common_1.NotFoundException)
                    continue;
                throw err;
            }
        }
        return views;
    }
    cardsFor(messages, proposalById, workflowById) {
        const cards = {};
        for (const message of messages) {
            if (message.visibility === 'internal')
                continue;
            if (message.role === 'system' || message.role === 'user' || message.role === 'assistant')
                continue;
            if (message.tool_name === 'read_skill')
                continue;
            const proposalId = message.proposal_id;
            if (!proposalId)
                continue;
            const itemId = `p${message.uid}`;
            const proposal = proposalById.get(proposalId);
            if (proposal) {
                cards[itemId] = { card: 'single', proposal };
                continue;
            }
            const workflow = workflowById.get(proposalId);
            if (workflow) {
                cards[itemId] = { card: 'workflow', workflow };
            }
        }
        return cards;
    }
    rejectBodyIdentity(body) {
        for (const key of BODY_IDENTITY_KEYS) {
            if (Object.prototype.hasOwnProperty.call(body, key)) {
                throw new common_1.BadRequestException('tenant, author and role are taken from the token');
            }
        }
    }
    resolveLocale(dtoLocale, req) {
        if (dtoLocale?.trim())
            return dtoLocale.trim();
        const header = req.headers?.['accept-language'];
        if (typeof header === 'string' && header.trim()) {
            return header.split(',')[0]?.trim() || 'ru';
        }
        return 'ru';
    }
};
exports.AiChatController = AiChatController;
__decorate([
    (0, swagger_1.ApiOperation)({ summary: 'List the caller\'s conversations (tenant + author)' }),
    (0, throttler_1.SkipThrottle)({ default: true, global: true }),
    (0, common_1.Get)('threads'),
    __param(0, (0, common_1.Req)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", Promise)
], AiChatController.prototype, "listThreads", null);
__decorate([
    (0, swagger_1.ApiOperation)({ summary: 'Create an empty conversation' }),
    (0, throttler_1.SkipThrottle)({ default: true, global: true }),
    (0, common_1.Post)('threads'),
    __param(0, (0, common_1.Req)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", Promise)
], AiChatController.prototype, "createThread", null);
__decorate([
    (0, swagger_1.ApiOperation)({ summary: 'Threads of other users the caller may read' }),
    (0, throttler_1.SkipThrottle)({ default: true, global: true }),
    (0, common_1.Get)('threads/shared'),
    __param(0, (0, common_1.Req)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", Promise)
], AiChatController.prototype, "listSharedThreads", null);
__decorate([
    (0, swagger_1.ApiOperation)({ summary: 'Get one conversation and its timeline' }),
    (0, throttler_1.SkipThrottle)({ default: true, global: true }),
    (0, common_1.Get)('threads/:uid'),
    __param(0, (0, common_1.Param)('uid', common_1.ParseIntPipe)),
    __param(1, (0, common_1.Req)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Number, Object]),
    __metadata("design:returntype", Promise)
], AiChatController.prototype, "getThread", null);
__decorate([
    (0, swagger_1.ApiOperation)({ summary: 'Continue the turn after the user applied a card' }),
    (0, throttler_1.Throttle)({ global: { limit: 10, ttl: 60000 } }),
    (0, common_1.Post)('threads/:uid/continue'),
    __param(0, (0, common_1.Param)('uid', common_1.ParseIntPipe)),
    __param(1, (0, common_1.Req)()),
    __param(2, (0, common_1.Res)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Number, Object, Object]),
    __metadata("design:returntype", Promise)
], AiChatController.prototype, "continueThread", null);
__decorate([
    (0, swagger_1.ApiOperation)({ summary: 'Delete a conversation the caller owns' }),
    (0, throttler_1.SkipThrottle)({ default: true, global: true }),
    (0, common_1.HttpCode)(common_1.HttpStatus.NO_CONTENT),
    (0, common_1.Delete)('threads/:uid'),
    __param(0, (0, common_1.Param)('uid', common_1.ParseIntPipe)),
    __param(1, (0, common_1.Req)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Number, Object]),
    __metadata("design:returntype", Promise)
], AiChatController.prototype, "deleteThread", null);
__decorate([
    (0, swagger_1.ApiOperation)({ summary: 'Provider the chat agent uses (admin)' }),
    (0, throttler_1.SkipThrottle)({ default: true, global: true }),
    (0, common_1.Get)('default-provider'),
    __param(0, (0, common_1.Req)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", Promise)
], AiChatController.prototype, "getDefaultProvider", null);
__decorate([
    (0, swagger_1.ApiOperation)({ summary: 'Choose the provider the chat agent uses (admin)' }),
    (0, throttler_1.SkipThrottle)({ default: true, global: true }),
    (0, common_1.Put)('default-provider'),
    __param(0, (0, common_1.Body)()),
    __param(1, (0, common_1.Req)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [UpdateDefaultProviderDto, Object]),
    __metadata("design:returntype", Promise)
], AiChatController.prototype, "setDefaultProvider", null);
__decorate([
    (0, swagger_1.ApiOperation)({ summary: 'Get per-tenant AI confirmation settings' }),
    (0, throttler_1.SkipThrottle)({ default: true, global: true }),
    (0, common_1.Get)('settings'),
    __param(0, (0, common_1.Req)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", Promise)
], AiChatController.prototype, "getSettings", null);
__decorate([
    (0, swagger_1.ApiOperation)({ summary: 'Update per-tenant AI confirmation settings' }),
    (0, throttler_1.SkipThrottle)({ default: true, global: true }),
    (0, common_1.Put)('settings'),
    __param(0, (0, common_1.Body)()),
    __param(1, (0, common_1.Req)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [UpdateAiChatSettingsDto, Object]),
    __metadata("design:returntype", Promise)
], AiChatController.prototype, "updateSettings", null);
__decorate([
    (0, swagger_1.ApiOperation)({ summary: 'Get PBX state snapshot for AI context' }),
    (0, throttler_1.SkipThrottle)({ default: true, global: true }),
    (0, common_1.Get)('state'),
    __param(0, (0, common_1.Req)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", Promise)
], AiChatController.prototype, "getState", null);
__decorate([
    (0, swagger_1.ApiOperation)({ summary: 'Get available AI models' }),
    (0, throttler_1.SkipThrottle)({ default: true, global: true }),
    (0, common_1.Get)('models'),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", Promise)
], AiChatController.prototype, "getModels", null);
__decorate([
    (0, swagger_1.ApiOperation)({ summary: 'Send message and get SSE streaming response' }),
    (0, throttler_1.Throttle)({ global: { limit: 10, ttl: 60000 } }),
    (0, common_1.Post)('message'),
    __param(0, (0, common_1.Body)()),
    __param(1, (0, common_1.Req)()),
    __param(2, (0, common_1.Res)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [SendMessageDto, Object, Object]),
    __metadata("design:returntype", Promise)
], AiChatController.prototype, "sendMessage", null);
exports.AiChatController = AiChatController = AiChatController_1 = __decorate([
    (0, swagger_1.ApiTags)('AI Chat'),
    (0, swagger_1.ApiBearerAuth)(),
    (0, common_1.UseGuards)(jwt_auth_guard_1.JwtAuthGuard),
    (0, common_1.Controller)('ai-chat'),
    __param(6, (0, sequelize_1.InjectModel)(agent_proposal_model_1.AgentProposal)),
    __param(9, (0, sequelize_1.InjectModel)(user_model_1.User)),
    __metadata("design:paramtypes", [pbx_agent_loop_service_1.PbxAgentLoopService,
        pbx_agent_thread_service_1.PbxAgentThreadService,
        pbx_context_builder_service_1.PbxContextBuilderService,
        ai_chat_settings_service_1.AiChatSettingsService,
        ai_providers_service_1.AiProvidersService,
        logger_service_1.LoggerService, Object, pbx_workflow_runner_service_1.PbxWorkflowRunnerService,
        thread_visibility_service_1.ThreadVisibilityService, Object])
], AiChatController);
//# sourceMappingURL=ai-chat.controller.js.map