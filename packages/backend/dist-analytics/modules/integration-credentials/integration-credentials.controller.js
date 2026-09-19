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
exports.IntegrationCredentialsController = void 0;
const common_1 = require("@nestjs/common");
const swagger_1 = require("@nestjs/swagger");
const integration_credentials_service_1 = require("./integration-credentials.service");
const integration_key_rate_limiter_1 = require("./integration-key-rate-limiter");
const tenant_context_guard_1 = require("./tenant-context.guard");
const integration_credentials_dto_1 = require("./integration-credentials.dto");
let IntegrationCredentialsController = class IntegrationCredentialsController {
    credentials;
    limiter;
    constructor(credentials, limiter) {
        this.credentials = credentials;
        this.limiter = limiter;
    }
    self(request) {
        return this.credentials.selfCapabilities(request.tenantContext);
    }
    async list(request, query) {
        await this.limiter.consumeManagement(request.tenantContext);
        return this.credentials.list(request.tenantContext, query.limit ?? 50, query.cursor);
    }
    async create(request, body) {
        await this.limiter.consumeManagement(request.tenantContext);
        return this.credentials.create(request.tenantContext, {
            label: body.label, product: body.product, operationId: body.operationId,
            expiresAt: body.expiresAt ? new Date(body.expiresAt) : null,
        });
    }
    async grants(request, id, body) {
        await this.limiter.consumeManagement(request.tenantContext);
        const permissionRevision = await this.credentials.replaceGrants(request.tenantContext, id, body.expectedRevision, body.grants);
        return { permissionRevision };
    }
    async rotate(request, id, body) {
        await this.limiter.consumeManagement(request.tenantContext);
        return this.credentials.rotate(request.tenantContext, id, body.expectedGeneration, body.operationId);
    }
    async revoke(request, id) {
        await this.limiter.consumeManagement(request.tenantContext);
        await this.credentials.disable(request.tenantContext, id);
    }
};
exports.IntegrationCredentialsController = IntegrationCredentialsController;
__decorate([
    (0, common_1.Get)('self/capabilities'),
    (0, common_1.Header)('Cache-Control', 'no-store'),
    (0, swagger_1.ApiOperation)({ summary: 'Integration key capabilities for its own principal' }),
    (0, swagger_1.ApiResponse)({ status: 200, description: 'Sanitized grants and readiness state' }),
    (0, swagger_1.ApiResponse)({ status: 403, description: 'Integration key required' }),
    __param(0, (0, common_1.Req)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", void 0)
], IntegrationCredentialsController.prototype, "self", null);
__decorate([
    (0, common_1.Get)(),
    (0, swagger_1.ApiOperation)({ summary: 'List tenant integration principals (tenant admin)' }),
    (0, swagger_1.ApiResponse)({ status: 200, description: 'Cursor page of safe principal metadata' }),
    __param(0, (0, common_1.Req)()),
    __param(1, (0, common_1.Query)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, integration_credentials_dto_1.IntegrationListQuery]),
    __metadata("design:returntype", Promise)
], IntegrationCredentialsController.prototype, "list", null);
__decorate([
    (0, common_1.Post)(),
    (0, common_1.HttpCode)(common_1.HttpStatus.CREATED),
    (0, common_1.Header)('Cache-Control', 'no-store'),
    (0, common_1.Header)('Pragma', 'no-cache'),
    (0, swagger_1.ApiOperation)({ summary: 'Create tenant integration key; token shown once' }),
    (0, swagger_1.ApiResponse)({ status: 201, description: 'New one-time token or token:null on replay' }),
    (0, swagger_1.ApiResponse)({ status: 409, description: 'Operation ID conflict' }),
    __param(0, (0, common_1.Req)()),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, integration_credentials_dto_1.CreateIntegrationBody]),
    __metadata("design:returntype", Promise)
], IntegrationCredentialsController.prototype, "create", null);
__decorate([
    (0, common_1.Put)(':id/grants'),
    (0, swagger_1.ApiOperation)({ summary: 'Replace grants with expected permission revision' }),
    (0, swagger_1.ApiResponse)({ status: 200, description: 'New permission revision' }),
    (0, swagger_1.ApiResponse)({ status: 409, description: 'Stale permission revision' }),
    __param(0, (0, common_1.Req)()),
    __param(1, (0, common_1.Param)('id')),
    __param(2, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String, integration_credentials_dto_1.ReplaceIntegrationGrantsBody]),
    __metadata("design:returntype", Promise)
], IntegrationCredentialsController.prototype, "grants", null);
__decorate([
    (0, common_1.Post)(':id/rotate'),
    (0, common_1.HttpCode)(common_1.HttpStatus.CREATED),
    (0, common_1.Header)('Cache-Control', 'no-store'),
    (0, common_1.Header)('Pragma', 'no-cache'),
    (0, swagger_1.ApiOperation)({ summary: 'Rotate key without overlap; token shown once' }),
    (0, swagger_1.ApiResponse)({ status: 201, description: 'New one-time token or token:null on replay' }),
    (0, swagger_1.ApiResponse)({ status: 409, description: 'Stale generation or operation conflict' }),
    __param(0, (0, common_1.Req)()),
    __param(1, (0, common_1.Param)('id')),
    __param(2, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String, integration_credentials_dto_1.RotateIntegrationBody]),
    __metadata("design:returntype", Promise)
], IntegrationCredentialsController.prototype, "rotate", null);
__decorate([
    (0, common_1.Post)(':id/revoke'),
    (0, common_1.HttpCode)(common_1.HttpStatus.NO_CONTENT),
    (0, swagger_1.ApiOperation)({ summary: 'Disable all credentials for a principal' }),
    (0, swagger_1.ApiResponse)({ status: 204, description: 'Disabled or already disabled' }),
    __param(0, (0, common_1.Req)()),
    __param(1, (0, common_1.Param)('id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String]),
    __metadata("design:returntype", Promise)
], IntegrationCredentialsController.prototype, "revoke", null);
exports.IntegrationCredentialsController = IntegrationCredentialsController = __decorate([
    (0, swagger_1.ApiTags)('AI Integrations'),
    (0, swagger_1.ApiBearerAuth)(),
    (0, swagger_1.ApiResponse)({ status: 400, description: 'Invalid request or client-supplied tenant context' }),
    (0, swagger_1.ApiResponse)({ status: 401, description: 'Missing, malformed, expired or revoked credential' }),
    (0, swagger_1.ApiResponse)({ status: 403, description: 'Tenant admin or product permission required' }),
    (0, swagger_1.ApiResponse)({ status: 404, description: 'Principal or tenant-bound resource not found' }),
    (0, swagger_1.ApiResponse)({ status: 429, description: 'Integration key authentication rate limited' }),
    (0, swagger_1.ApiResponse)({ status: 503, description: 'Credential authentication temporarily unavailable' }),
    (0, common_1.UseGuards)(tenant_context_guard_1.TenantContextGuard),
    (0, common_1.Controller)('v1/integrations'),
    __metadata("design:paramtypes", [integration_credentials_service_1.IntegrationCredentialsService,
        integration_key_rate_limiter_1.IntegrationKeyRateLimiter])
], IntegrationCredentialsController);
//# sourceMappingURL=integration-credentials.controller.js.map