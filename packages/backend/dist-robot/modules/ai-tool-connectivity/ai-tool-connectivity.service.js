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
exports.AiToolConnectivityService = void 0;
const common_1 = require("@nestjs/common");
const sequelize_1 = require("@nestjs/sequelize");
const product_access_service_1 = require("../product-access/product-access.service");
const tool_gateway_1 = require("./tool-gateway");
const tool_models_1 = require("./tool.models");
let AiToolConnectivityService = class AiToolConnectivityService {
    products;
    connections;
    revisions;
    bindings;
    constructor(products, connections, revisions, bindings) {
        this.products = products;
        this.connections = connections;
        this.revisions = revisions;
        this.bindings = bindings;
    }
    mapError(error) {
        if (error instanceof common_1.HttpException)
            throw error;
        if (error instanceof tool_gateway_1.DomainError)
            throw new common_1.HttpException({ code: error.code }, error.status);
        throw error;
    }
    async list(context) {
        return this.connections.findAll({ where: { tenant_uid: context.tenantUid } });
    }
    async create(context, body) {
        try {
            const access = await this.products.decide(context.tenantUid, 'ai_voice_robots');
            if (!access.allowed)
                throw new tool_gateway_1.DomainError('entitlement', 403);
            return this.connections.create({
                id: (0, tool_gateway_1.newToolId)(), tenant_uid: context.tenantUid, name: body.name, kind: body.kind,
                status: 'draft', draft_revision: 1, destination: body.destination,
                created_at: new Date(), updated_at: new Date(),
            });
        }
        catch (error) {
            this.mapError(error);
        }
    }
    async publishTool(context, connectionId, schema, sideEffect) {
        try {
            const connection = await this.connections.findOne({
                where: { tenant_uid: context.tenantUid, id: connectionId },
            });
            if (!connection)
                throw new tool_gateway_1.DomainError('resource_not_found', 404);
            const last = await this.revisions.findOne({
                where: { connection_id: connectionId }, order: [['revision', 'DESC']],
            });
            return this.revisions.create({
                id: (0, tool_gateway_1.newToolId)(), tenant_uid: context.tenantUid, connection_id: connectionId,
                revision: (last?.revision ?? 0) + 1, schema_digest: (0, tool_gateway_1.schemaDigest)(schema),
                schema_json: JSON.stringify(schema), side_effect: sideEffect, created_at: new Date(),
            });
        }
        catch (error) {
            this.mapError(error);
        }
    }
    async bind(context, body) {
        try {
            const revision = await this.revisions.findOne({
                where: { tenant_uid: context.tenantUid, id: body.toolRevisionId },
            });
            if (!revision)
                throw new tool_gateway_1.DomainError('resource_not_found', 404);
            (0, tool_gateway_1.authorizeToolCall)({
                tenantUid: context.tenantUid, robotVersionId: body.robotVersionId,
                toolRevisionId: body.toolRevisionId, sideEffect: revision.side_effect,
                policy: body.policy, simulated: false,
            });
            return this.bindings.create({
                tenant_uid: context.tenantUid, robot_version_id: body.robotVersionId,
                tool_revision_id: body.toolRevisionId, timeout_ms: body.timeoutMs,
                side_effect_policy: body.policy, created_at: new Date(),
            });
        }
        catch (error) {
            this.mapError(error);
        }
    }
    probe(simulated) {
        return { sideEffects: simulated ? 'disabled' : 'sandbox_only', liveMcp: false };
    }
};
exports.AiToolConnectivityService = AiToolConnectivityService;
exports.AiToolConnectivityService = AiToolConnectivityService = __decorate([
    (0, common_1.Injectable)(),
    __param(1, (0, sequelize_1.InjectModel)(tool_models_1.AiBusinessConnection)),
    __param(2, (0, sequelize_1.InjectModel)(tool_models_1.AiToolRevision)),
    __param(3, (0, sequelize_1.InjectModel)(tool_models_1.AiRobotToolBinding)),
    __metadata("design:paramtypes", [product_access_service_1.ProductAccessService, Object, Object, Object])
], AiToolConnectivityService);
//# sourceMappingURL=ai-tool-connectivity.service.js.map