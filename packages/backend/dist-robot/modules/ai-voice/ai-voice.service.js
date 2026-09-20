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
exports.AiVoiceService = void 0;
exports.assertUuid = assertUuid;
const common_1 = require("@nestjs/common");
const sequelize_1 = require("@nestjs/sequelize");
const node_crypto_1 = require("node:crypto");
const sequelize_2 = require("sequelize");
const sequelize_typescript_1 = require("sequelize-typescript");
const ai_agent_model_1 = require("../ai-agents/models/ai-agent.model");
const product_access_service_1 = require("../product-access/product-access.service");
const product_resource_authorization_1 = require("../integration-credentials/product-resource.authorization");
const ai_voice_models_1 = require("./ai-voice.models");
const voice_engine_1 = require("./voice-engine");
const call_control_1 = require("./call-control");
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
let AiVoiceService = class AiVoiceService {
    sequelize;
    products;
    resources;
    agents;
    drafts;
    versions;
    deployments;
    sessions;
    turns;
    events;
    operations;
    tickets;
    constructor(sequelize, products, resources, agents, drafts, versions, deployments, sessions, turns, events, operations, tickets) {
        this.sequelize = sequelize;
        this.products = products;
        this.resources = resources;
        this.agents = agents;
        this.drafts = drafts;
        this.versions = versions;
        this.deployments = deployments;
        this.sessions = sessions;
        this.turns = turns;
        this.events = events;
        this.operations = operations;
        this.tickets = tickets;
    }
    ticketSecret() {
        return process.env.AI_VOICE_TICKET_SECRET || 'ai-voice-ticket-dev';
    }
    userId(context) {
        const match = /^user:(\d+)$/.exec(context.principalId);
        return match ? Number(match[1]) : 0;
    }
    mapError(error) {
        if (error instanceof common_1.HttpException)
            throw error;
        if (error instanceof voice_engine_1.DomainError)
            throw new common_1.HttpException({ code: error.code }, error.status);
        throw error;
    }
    async assertScope(context, deploymentId, action) {
        await this.resources.authorize(context, {
            product: 'ai_voice_robots', action, resourceKind: 'deployment', resourceId: deploymentId,
        });
        const row = await this.deployments.findOne({ where: { tenant_uid: context.tenantUid, id: deploymentId } });
        if (!row)
            throw new common_1.NotFoundException({ code: 'resource_not_found' });
        return row;
    }
    async listDeployments(context) {
        return this.deployments.findAll({
            where: { tenant_uid: context.tenantUid }, order: [['created_at', 'DESC']],
        });
    }
    async publish(context, agentUid, operationKey) {
        try {
            if (!operationKey)
                throw new voice_engine_1.DomainError('operation_key_required', 422);
            const access = await this.products.decide(context.tenantUid, 'ai_voice_robots');
            if (!access.allowed)
                throw new common_1.ForbiddenException({ code: access.reason ?? 'not_entitled' });
            const agent = await this.agents.findOne({ where: { uid: agentUid, user_uid: context.tenantUid } });
            if (!agent)
                throw new common_1.NotFoundException({ code: 'resource_not_found' });
            const snapshot = this.snapshot(agent);
            if (snapshot.mode !== 'cascade')
                throw new voice_engine_1.DomainError('realtime_unavailable', 409);
            if (!snapshot.enabled || !snapshot.modelProfileId || !snapshot.sttProfileId || !snapshot.ttsProfileId) {
                throw new voice_engine_1.DomainError('agent_not_ready', 409);
            }
            const previous = await this.versions.findAll({ where: { tenant_uid: context.tenantUid, agent_uid: agentUid } });
            const replayed = previous.find(row => {
                try {
                    return JSON.parse(row.config).operationKey === operationKey;
                }
                catch {
                    return false;
                }
            });
            if (replayed)
                return { id: replayed.id, replay: true };
            const draft = await this.ensureDraft(context.tenantUid, agentUid);
            const policy = JSON.parse(draft.runtime_policy);
            const version = await this.versions.create({
                id: (0, node_crypto_1.randomUUID)(), tenant_uid: context.tenantUid, agent_uid: agentUid,
                version_no: previous.length + 1, config_digest: (0, voice_engine_1.snapshotDigest)(snapshot, policy),
                config: JSON.stringify({ agent: snapshot, policy, operationKey }),
                llm_revision_id: String(snapshot.modelProfileId),
                stt_revision_id: snapshot.sttProfileId ? String(snapshot.sttProfileId) : null,
                tts_revision_id: snapshot.ttsProfileId ? String(snapshot.ttsProfileId) : null,
                created_by: this.userId(context), created_at: new Date(),
            });
            return { id: version.id, replay: false };
        }
        catch (error) {
            this.mapError(error);
        }
    }
    async createDeployment(context, input) {
        try {
            if (input.kind === 'external_sip') {
                return this.deployments.create({
                    id: (0, node_crypto_1.randomUUID)(), tenant_uid: context.tenantUid, agent_uid: input.agentUid,
                    kind: input.kind, active_version_id: null, status: 'disabled', revision: 1,
                    capture_policy: '{"mode":"allow"}', fallback_policy: '{"action":"hangup"}',
                    created_at: new Date(), updated_at: new Date(),
                });
            }
            if (!input.versionId || !UUID.test(input.versionId))
                throw new voice_engine_1.DomainError('version_not_found', 404);
            const version = await this.versions.findOne({
                where: { id: input.versionId, tenant_uid: context.tenantUid, agent_uid: input.agentUid },
            });
            if (!version)
                throw new voice_engine_1.DomainError('version_not_found', 404);
            return this.deployments.create({
                id: (0, node_crypto_1.randomUUID)(), tenant_uid: context.tenantUid, agent_uid: input.agentUid,
                kind: input.kind, active_version_id: version.id, status: 'disabled', revision: 1,
                capture_policy: '{"mode":"allow"}', fallback_policy: '{"action":"hangup"}',
                created_at: new Date(), updated_at: new Date(),
            });
        }
        catch (error) {
            this.mapError(error);
        }
    }
    async setReady(context, deploymentId, ready) {
        try {
            const row = await this.assertScope(context, deploymentId, ready ? 'robots:deploy' : 'robots:disable');
            if (row.kind === 'external_sip' && ready)
                throw new voice_engine_1.DomainError('external_sip_disabled', 409);
            if (ready && !row.active_version_id)
                throw new voice_engine_1.DomainError('version_not_found', 409);
            row.status = ready ? 'ready' : 'disabled';
            row.revision += 1;
            row.updated_at = new Date();
            await row.save();
            return row;
        }
        catch (error) {
            this.mapError(error);
        }
    }
    async issueNodeTicket(context, input) {
        try {
            const deployment = await this.assertScope(context, input.deploymentId, 'robots:admit');
            if (deployment.status !== 'ready')
                throw new voice_engine_1.DomainError('deployment_not_ready', 409);
            const issued = (0, voice_engine_1.issueTicket)({
                secret: this.ticketSecret(), tenantUid: context.tenantUid, nodeId: input.nodeId,
                channelUniqueid: input.channelUniqueid, deploymentId: input.deploymentId, now: new Date(),
            });
            await this.tickets.create({
                id: issued.id, tenant_uid: context.tenantUid, node_id: input.nodeId,
                channel_uniqueid: input.channelUniqueid, deployment_id: input.deploymentId,
                digest: issued.digest, expires_at: issued.expiresAt, consumed_at: null, created_at: new Date(),
            });
            return { id: issued.id, expiresAt: issued.expiresAt.toISOString() };
        }
        catch (error) {
            this.mapError(error);
        }
    }
    async browserTestTicket(context, deploymentId) {
        try {
            if (context.principalKind !== 'user')
                throw new common_1.ForbiddenException({ code: 'tenant_admin_required' });
            const deployment = await this.assertScope(context, deploymentId, 'robots:preview');
            if (deployment.kind !== 'browser_test' || deployment.status !== 'ready') {
                throw new voice_engine_1.DomainError('deployment_not_ready', 409);
            }
            return this.issueNodeTicket(context, {
                nodeId: `browser:${this.userId(context)}`,
                channelUniqueid: (0, node_crypto_1.randomUUID)(),
                deploymentId,
            });
        }
        catch (error) {
            this.mapError(error);
        }
    }
    async admit(context, input) {
        try {
            const ticket = await this.tickets.findOne({ where: { id: input.ticketId, tenant_uid: context.tenantUid } });
            if (!ticket)
                throw new voice_engine_1.DomainError('spoof_ticket', 403);
            (0, voice_engine_1.consumeTicket)({
                secret: this.ticketSecret(),
                ticket: {
                    id: ticket.id, digest: ticket.digest, tenantUid: ticket.tenant_uid, nodeId: ticket.node_id,
                    channelUniqueid: ticket.channel_uniqueid, deploymentId: ticket.deployment_id,
                    expiresAt: ticket.expires_at, consumedAt: ticket.consumed_at,
                },
                claimed: {
                    nodeId: input.nodeId, channelUniqueid: input.channelUniqueid,
                    deploymentId: input.deploymentId, tenantUid: context.tenantUid,
                },
                now: new Date(),
            });
            ticket.consumed_at = new Date();
            await ticket.save();
            const existing = await this.sessions.findOne({
                where: { ingress_kind: input.ingressKind, ingress_key: input.ingressKey },
            });
            if (existing)
                return { id: existing.id, replay: true };
            const deployment = await this.deployments.findOne({
                where: { id: input.deploymentId, tenant_uid: context.tenantUid },
            });
            if (!deployment || !deployment.active_version_id) {
                throw new voice_engine_1.DomainError('deployment_not_ready', 409);
            }
            if (deployment.status === 'draining' || deployment.status === 'stopped') {
                throw new voice_engine_1.DomainError('admissions_stopped', 409);
            }
            if (deployment.status !== 'ready') {
                throw new voice_engine_1.DomainError('deployment_not_ready', 409);
            }
            try {
                const session = await this.sessions.create({
                    id: (0, node_crypto_1.randomUUID)(), tenant_uid: context.tenantUid, deployment_id: deployment.id,
                    version_id: deployment.active_version_id, ingress_kind: input.ingressKind,
                    ingress_key: input.ingressKey, node_id: input.nodeId, channel_uniqueid: input.channelUniqueid,
                    owner: 'ai-voice', fence: '1', state: 'admitted', reason: null,
                    capture_intent_id: null, usage_reservation_id: null, started_at: new Date(), ended_at: null,
                });
                return { id: session.id, replay: false };
            }
            catch (error) {
                if (!(error instanceof sequelize_2.UniqueConstraintError))
                    throw error;
                const replayed = await this.sessions.findOne({
                    where: { ingress_kind: input.ingressKind, ingress_key: input.ingressKey },
                });
                if (!replayed)
                    throw error;
                return { id: replayed.id, replay: true };
            }
        }
        catch (error) {
            this.mapError(error);
        }
    }
    async listSessions(context, deploymentId) {
        const where = { tenant_uid: context.tenantUid };
        if (deploymentId) {
            await this.assertScope(context, deploymentId, 'robots:read');
            where.deployment_id = deploymentId;
        }
        return this.sessions.findAll({
            where, order: [['started_at', 'DESC'], ['id', 'DESC']], limit: 50,
        });
    }
    async sessionTimeline(context, sessionId) {
        const session = await this.sessions.findOne({ where: { tenant_uid: context.tenantUid, id: sessionId } });
        if (!session)
            throw new common_1.NotFoundException({ code: 'resource_not_found' });
        await this.assertScope(context, session.deployment_id, 'robots:read');
        const [turns, events, operations] = await Promise.all([
            this.turns.findAll({ where: { session_id: sessionId }, order: [['input_turn_id', 'ASC'], ['output_epoch', 'ASC']] }),
            this.events.findAll({ where: { session_id: sessionId }, order: [['sequence', 'ASC']] }),
            this.operations.findAll({ where: { session_id: sessionId } }),
        ]);
        return { session, turns, events, operations };
    }
    executeTool(input) {
        return (0, call_control_1.executeVoiceTool)(input);
    }
    async drainTenant(context) {
        const rows = await this.deployments.findAll({
            where: { tenant_uid: context.tenantUid, status: 'ready' },
        });
        for (const row of rows) {
            row.status = 'draining';
            row.revision += 1;
            row.updated_at = new Date();
            await row.save();
        }
        return {
            admissionsStopped: true,
            liveSip: false,
            drained: rows.map((row) => row.id),
        };
    }
    capabilities() {
        return {
            mode: 'cascade',
            realtime: false,
            externalSip: false,
            toolsCatalog: true,
            knowledge: true,
            ariApp: process.env.ARI_AI_VOICE_APP_NAME || 'krasterisk_ai_voice',
            tools: ['end_call', 'transfer', 'get_session_context'],
            previewMic: 'opt-in',
        };
    }
    snapshot(agent) {
        return {
            uid: agent.uid, tenantUid: agent.user_uid, name: agent.name, uniqueId: agent.unique_id,
            mode: agent.mode, greeting: agent.greeting || '',
            instruction: agent.instruction || '', modelProfileId: agent.model_profile_id,
            sttProfileId: agent.stt_profile_id, ttsProfileId: agent.tts_profile_id, enabled: agent.enabled,
        };
    }
    async policyOf(agentUid, tenantUid) {
        const draft = await this.drafts.findOne({ where: { agent_uid: agentUid, tenant_uid: tenantUid } });
        return draft ? JSON.parse(draft.runtime_policy) : { ...voice_engine_1.DEFAULT_RUNTIME_POLICY };
    }
    async ensureDraft(tenantUid, agentUid, transaction) {
        const existing = await this.drafts.findOne({
            where: { tenant_uid: tenantUid, agent_uid: agentUid }, transaction: transaction,
        });
        if (existing)
            return existing;
        return this.drafts.create({
            tenant_uid: tenantUid, agent_uid: agentUid, robot_uuid: (0, node_crypto_1.randomUUID)(), draft_revision: 1,
            runtime_policy: JSON.stringify(voice_engine_1.DEFAULT_RUNTIME_POLICY), created_at: new Date(), updated_at: new Date(),
        }, { transaction: transaction });
    }
};
exports.AiVoiceService = AiVoiceService;
exports.AiVoiceService = AiVoiceService = __decorate([
    (0, common_1.Injectable)(),
    __param(3, (0, sequelize_1.InjectModel)(ai_agent_model_1.CcAiAgent)),
    __param(4, (0, sequelize_1.InjectModel)(ai_voice_models_1.AiRobotDraft)),
    __param(5, (0, sequelize_1.InjectModel)(ai_voice_models_1.AiRobotVersion)),
    __param(6, (0, sequelize_1.InjectModel)(ai_voice_models_1.AiRobotDeployment)),
    __param(7, (0, sequelize_1.InjectModel)(ai_voice_models_1.AiVoiceSession)),
    __param(8, (0, sequelize_1.InjectModel)(ai_voice_models_1.AiVoiceTurn)),
    __param(9, (0, sequelize_1.InjectModel)(ai_voice_models_1.AiVoiceEvent)),
    __param(10, (0, sequelize_1.InjectModel)(ai_voice_models_1.AiCallControlOperation)),
    __param(11, (0, sequelize_1.InjectModel)(ai_voice_models_1.AiVoiceTicket)),
    __metadata("design:paramtypes", [sequelize_typescript_1.Sequelize,
        product_access_service_1.ProductAccessService,
        product_resource_authorization_1.ProductResourceAuthorization, Object, Object, Object, Object, Object, Object, Object, Object, Object])
], AiVoiceService);
function assertUuid(value) {
    if (!UUID.test(value))
        throw new common_1.NotFoundException({ code: 'resource_not_found' });
}
//# sourceMappingURL=ai-voice.service.js.map