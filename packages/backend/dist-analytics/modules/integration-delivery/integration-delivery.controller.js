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
exports.IntegrationDeliveryController = void 0;
const common_1 = require("@nestjs/common");
const common_2 = require("@nestjs/common");
const sequelize_1 = require("@nestjs/sequelize");
const node_crypto_1 = require("node:crypto");
const tenant_context_guard_1 = require("../integration-credentials/tenant-context.guard");
const product_resource_authorization_1 = require("../integration-credentials/product-resource.authorization");
const webhook_security_1 = require("./webhook-security");
const webhook_models_1 = require("./webhook.models");
let IntegrationDeliveryController = class IntegrationDeliveryController {
    endpoints;
    resources;
    constructor(endpoints, resources) {
        this.endpoints = endpoints;
        this.resources = resources;
    }
    async list(request) {
        if (request.tenantContext.principalKind !== 'user') {
            throw new common_2.ForbiddenException({ code: 'tenant_admin_required' });
        }
        return this.endpoints.findAll({
            where: { tenant_uid: request.tenantContext.tenantUid },
            attributes: ['id', 'project_id', 'destination_url', 'status', 'key_version', 'revision'],
        });
    }
    async create(request, body) {
        if (request.tenantContext.principalKind !== 'user') {
            throw new common_2.ForbiddenException({ code: 'tenant_admin_required' });
        }
        await this.resources.authorize(request.tenantContext, {
            product: 'speech_analytics', action: 'grant', resourceKind: 'project', resourceId: body.projectId,
        });
        (0, webhook_security_1.assertSafeWebhookUrl)(body.url);
        const now = new Date();
        return this.endpoints.create({
            id: (0, node_crypto_1.randomUUID)(), tenant_uid: request.tenantContext.tenantUid,
            principal_id: request.tenantContext.principalId, project_id: body.projectId,
            destination_url: body.url, secret_ref: `secret:${(0, node_crypto_1.randomUUID)()}`, key_version: 1,
            previous_secret_ref: null, status: 'active', revision: 1, created_at: now, updated_at: now,
        });
    }
    async revoke(request, id) {
        if (request.tenantContext.principalKind !== 'user') {
            throw new common_2.ForbiddenException({ code: 'tenant_admin_required' });
        }
        const endpoint = await this.endpoints.findOne({
            where: { tenant_uid: request.tenantContext.tenantUid, id },
        });
        if (!endpoint)
            return { status: 'revoked' };
        endpoint.status = 'revoked';
        endpoint.updated_at = new Date();
        await endpoint.save();
        return { status: 'revoked' };
    }
};
exports.IntegrationDeliveryController = IntegrationDeliveryController;
__decorate([
    (0, common_1.Get)(),
    __param(0, (0, common_1.Req)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", Promise)
], IntegrationDeliveryController.prototype, "list", null);
__decorate([
    (0, common_1.Post)(),
    __param(0, (0, common_1.Req)()),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, Object]),
    __metadata("design:returntype", Promise)
], IntegrationDeliveryController.prototype, "create", null);
__decorate([
    (0, common_1.Put)(':id/revoke'),
    __param(0, (0, common_1.Req)()),
    __param(1, (0, common_1.Param)('id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String]),
    __metadata("design:returntype", Promise)
], IntegrationDeliveryController.prototype, "revoke", null);
exports.IntegrationDeliveryController = IntegrationDeliveryController = __decorate([
    (0, common_1.UseGuards)(tenant_context_guard_1.TenantContextGuard),
    (0, common_1.Controller)('speech-analytics/webhooks'),
    __param(0, (0, sequelize_1.InjectModel)(webhook_models_1.AiWebhookEndpoint)),
    __metadata("design:paramtypes", [Object, product_resource_authorization_1.ProductResourceAuthorization])
], IntegrationDeliveryController);
//# sourceMappingURL=integration-delivery.controller.js.map