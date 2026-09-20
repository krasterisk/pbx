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
exports.PlatformAiThreadsController = void 0;
const common_1 = require("@nestjs/common");
const swagger_1 = require("@nestjs/swagger");
const throttler_1 = require("@nestjs/throttler");
const sequelize_1 = require("@nestjs/sequelize");
const jwt_auth_guard_1 = require("../auth/jwt-auth.guard");
const superadmin_guard_1 = require("../auth/superadmin.guard");
const user_model_1 = require("../users/user.model");
const agent_proposal_model_1 = require("./models/agent-proposal.model");
const agent_diff_dto_1 = require("./dto/agent-diff.dto");
const agent_timeline_util_1 = require("./agent-timeline.util");
const pbx_agent_thread_service_1 = require("./pbx-agent-thread.service");
const pbx_workflow_runner_service_1 = require("./pbx-workflow-runner.service");
/**
 * Platform-administrator read-only view of tenant conversations (F4).
 * Tenant comes from the path — never from the JWT vpbx_user_uid.
 */
let PlatformAiThreadsController = class PlatformAiThreadsController {
    threads;
    proposals;
    workflows;
    users;
    constructor(threads, proposals, workflows, users) {
        this.threads = threads;
        this.proposals = proposals;
        this.workflows = workflows;
        this.users = users;
    }
    async listThreads(tenantUid) {
        const rows = await this.threads.listTenantThreads(tenantUid);
        const names = await this.ownerNamesByUid(rows.map((row) => row.user_uid), tenantUid);
        return rows.map((row) => ({
            ...this.toThreadJson(row),
            ownerName: names.get(row.user_uid) ?? '',
            readOnly: true,
        }));
    }
    async getThread(tenantUid, uid) {
        const thread = await this.threads.getTenantThread(uid, tenantUid);
        const threadAuthorUid = thread.user_uid;
        const messages = await this.threads.listMessages(uid, tenantUid, threadAuthorUid);
        const proposalById = await this.proposalViewsFor(messages, tenantUid, threadAuthorUid);
        const workflowById = await this.workflowViewsFor(messages, tenantUid, threadAuthorUid, new Set(proposalById.keys()));
        const proposalRefs = new Map();
        for (const id of proposalById.keys()) {
            proposalRefs.set(id, { proposalId: id, card: 'single' });
        }
        for (const id of workflowById.keys()) {
            proposalRefs.set(id, { proposalId: id, card: 'workflow' });
        }
        const timeline = (0, agent_timeline_util_1.buildTimeline)(messages.filter((row) => row.visibility !== 'internal'), { proposals: proposalRefs });
        const ownerName = (await this.ownerNamesByUid([threadAuthorUid], tenantUid)).get(threadAuthorUid) ?? '';
        return {
            ...this.toThreadJson(thread),
            ownerName,
            readOnly: true,
            timeline,
            cards: this.cardsFor(messages, proposalById, workflowById),
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
    async proposalViewsFor(messages, tenantUid, authorUid) {
        const ids = [...new Set(messages.map((row) => row.proposal_id).filter((id) => !!id))];
        if (!ids.length)
            return new Map();
        const rows = await this.proposals.findAll({
            where: { proposal_id: ids, vpbx_user_uid: tenantUid, user_uid: authorUid },
        });
        return new Map(rows.map((row) => [row.proposal_id, (0, agent_diff_dto_1.toProposalView)(row)]));
    }
    async workflowViewsFor(messages, tenantUid, authorUid, knownProposalIds) {
        const ids = [...new Set(messages
                .map((row) => row.proposal_id)
                .filter((id) => !!id && !knownProposalIds.has(id)))];
        const views = new Map();
        for (const id of ids) {
            try {
                const view = await this.workflows.getOwned(id, {
                    vpbxUserUid: tenantUid,
                    userUid: authorUid,
                    role: user_model_1.UserLevel.SUPERADMIN,
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
};
exports.PlatformAiThreadsController = PlatformAiThreadsController;
__decorate([
    (0, swagger_1.ApiOperation)({ summary: 'List conversations of a tenant (platform read-only)' }),
    (0, throttler_1.SkipThrottle)({ default: true, global: true }),
    (0, common_1.Get)('tenants/:tenantUid/threads'),
    __param(0, (0, common_1.Param)('tenantUid', common_1.ParseIntPipe)),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Number]),
    __metadata("design:returntype", Promise)
], PlatformAiThreadsController.prototype, "listThreads", null);
__decorate([
    (0, swagger_1.ApiOperation)({ summary: 'Get one tenant conversation as a read-only timeline' }),
    (0, throttler_1.SkipThrottle)({ default: true, global: true }),
    (0, common_1.Get)('tenants/:tenantUid/threads/:uid'),
    __param(0, (0, common_1.Param)('tenantUid', common_1.ParseIntPipe)),
    __param(1, (0, common_1.Param)('uid', common_1.ParseIntPipe)),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Number, Number]),
    __metadata("design:returntype", Promise)
], PlatformAiThreadsController.prototype, "getThread", null);
exports.PlatformAiThreadsController = PlatformAiThreadsController = __decorate([
    (0, swagger_1.ApiTags)('AI Chat'),
    (0, swagger_1.ApiBearerAuth)(),
    (0, common_1.UseGuards)(jwt_auth_guard_1.JwtAuthGuard, superadmin_guard_1.SuperAdminGuard),
    (0, common_1.Controller)('cloud-admin/ai-chat'),
    __param(1, (0, sequelize_1.InjectModel)(agent_proposal_model_1.AgentProposal)),
    __param(3, (0, sequelize_1.InjectModel)(user_model_1.User)),
    __metadata("design:paramtypes", [pbx_agent_thread_service_1.PbxAgentThreadService, Object, pbx_workflow_runner_service_1.PbxWorkflowRunnerService, Object])
], PlatformAiThreadsController);
//# sourceMappingURL=platform-threads.controller.js.map