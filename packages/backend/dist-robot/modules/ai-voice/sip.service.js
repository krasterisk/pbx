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
exports.AiSipService = void 0;
const common_1 = require("@nestjs/common");
const sequelize_1 = require("@nestjs/sequelize");
const sequelize_2 = require("sequelize");
const product_access_service_1 = require("../product-access/product-access.service");
const product_resource_authorization_1 = require("../integration-credentials/product-resource.authorization");
const voice_engine_1 = require("./voice-engine");
const ai_voice_models_1 = require("./ai-voice.models");
const realtime_session_1 = require("./realtime-session");
const sip_models_1 = require("./sip.models");
let AiSipService = class AiSipService {
    products;
    resources;
    connections;
    invocations;
    deployments;
    constructor(products, resources, connections, invocations, deployments) {
        this.products = products;
        this.resources = resources;
        this.connections = connections;
        this.invocations = invocations;
        this.deployments = deployments;
    }
    mapError(error) {
        if (error instanceof common_1.HttpException)
            throw error;
        if (error instanceof voice_engine_1.DomainError)
            throw new common_1.HttpException({ code: error.code }, error.status);
        throw error;
    }
    async listConnections(context) {
        const rows = await this.connections.findAll({ where: { tenant_uid: context.tenantUid } });
        return rows.map((row) => {
            const profile = (0, realtime_session_1.evaluateSipProfile)({ transport: row.transport });
            return { ...row.toJSON(), status: profile.status, reason: profile.reason, ready: profile.ready };
        });
    }
    async createConnection(context, body) {
        try {
            const access = await this.products.decide(context.tenantUid, 'ai_voice_robots');
            if (!access.allowed)
                throw new voice_engine_1.DomainError('entitlement', 403);
            const profile = (0, realtime_session_1.evaluateSipProfile)({ transport: body.transport });
            const row = await this.connections.create({
                id: (0, realtime_session_1.newSipId)(), tenant_uid: context.tenantUid, name: body.name,
                status: profile.status === 'disabled' ? 'failed' : profile.status,
                transport: body.transport, auth_kind: 'digest', draft_revision: 1, secret_once_shown: false,
                created_at: new Date(), updated_at: new Date(),
            });
            return { ...row.toJSON(), status: profile.status, reason: profile.reason, ready: profile.ready };
        }
        catch (error) {
            this.mapError(error);
        }
    }
    async showSecretOnce(context, id) {
        try {
            const row = await this.connections.findOne({ where: { tenant_uid: context.tenantUid, id } });
            if (!row)
                throw new common_1.NotFoundException({ code: 'resource_not_found' });
            if (row.secret_once_shown)
                throw new voice_engine_1.DomainError('secret_already_shown', 409);
            await row.update({ secret_once_shown: true });
            return { id: row.id, secret: `sip-once-${row.id.slice(0, 8)}` };
        }
        catch (error) {
            this.mapError(error);
        }
    }
    async invoke(context, body) {
        try {
            await this.resources.authorize(context, {
                product: 'ai_voice_robots', action: 'voice:invoke', resourceKind: 'deployment',
                resourceId: body.deploymentId,
            });
            const deployment = await this.deployments.findOne({
                where: { tenant_uid: context.tenantUid, id: body.deploymentId },
            });
            if (!deployment)
                throw new common_1.NotFoundException({ code: 'resource_not_found' });
            (0, realtime_session_1.assertSipReady)({
                kind: deployment.kind,
                appliedRevision: false,
            });
            const requestHash = (0, realtime_session_1.hashInvocation)(body.payload);
            const existing = await this.invocations.findOne({
                where: {
                    tenant_uid: context.tenantUid, principal: context.principalId,
                    deployment_id: body.deploymentId, external_call_id: body.externalCallId,
                },
            });
            if (existing) {
                if ((0, realtime_session_1.invocationReplay)(existing.request_hash, requestHash) === 'replay')
                    return { ...existing.toJSON(), replay: true };
            }
            try {
                return await this.invocations.create({
                    id: (0, realtime_session_1.newSipId)(), tenant_uid: context.tenantUid, deployment_id: body.deploymentId,
                    principal: context.principalId, external_call_id: body.externalCallId, request_hash: requestHash,
                    status: 'accepted', destination_ref: body.destinationRef, created_at: new Date(),
                });
            }
            catch (error) {
                if (error instanceof sequelize_2.UniqueConstraintError) {
                    throw new common_1.ConflictException({ code: 'invocation_conflict' });
                }
                throw error;
            }
        }
        catch (error) {
            this.mapError(error);
        }
    }
    drain() {
        return { admissionsStopped: true, liveSip: false };
    }
};
exports.AiSipService = AiSipService;
exports.AiSipService = AiSipService = __decorate([
    (0, common_1.Injectable)(),
    __param(2, (0, sequelize_1.InjectModel)(sip_models_1.AiSipConnection)),
    __param(3, (0, sequelize_1.InjectModel)(sip_models_1.AiVoiceInvocation)),
    __param(4, (0, sequelize_1.InjectModel)(ai_voice_models_1.AiRobotDeployment)),
    __metadata("design:paramtypes", [product_access_service_1.ProductAccessService,
        product_resource_authorization_1.ProductResourceAuthorization, Object, Object, Object])
], AiSipService);
//# sourceMappingURL=sip.service.js.map