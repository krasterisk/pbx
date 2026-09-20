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
exports.AgentUsageController = void 0;
const common_1 = require("@nestjs/common");
const class_validator_1 = require("class-validator");
const swagger_1 = require("@nestjs/swagger");
const jwt_auth_guard_1 = require("../auth/jwt-auth.guard");
const superadmin_guard_1 = require("../auth/superadmin.guard");
const agent_usage_service_1 = require("./agent-usage.service");
class UpdateDefaultModelDto {
    providerUid;
}
__decorate([
    (0, class_validator_1.IsInt)(),
    __metadata("design:type", Number)
], UpdateDefaultModelDto.prototype, "providerUid", void 0);
/**
 * Platform-administrator usage endpoints (D-07 / D-08).
 * A tenant-role caller is rejected by SuperAdminGuard on every route.
 */
let AgentUsageController = class AgentUsageController {
    usage;
    constructor(usage) {
        this.usage = usage;
    }
    async getUsage(from, to) {
        return this.usage.queryTenantUsage(new Date(from), new Date(to));
    }
    async getFunnel(from, to) {
        return this.usage.queryProposalFunnel(new Date(from), new Date(to));
    }
    async getErrors(from, to) {
        return this.usage.queryToolErrors(new Date(from), new Date(to));
    }
    async getDefaultModel() {
        return this.usage.getDefaultModel();
    }
    async setDefaultModel(dto) {
        return this.usage.setDefaultModel(dto.providerUid);
    }
};
exports.AgentUsageController = AgentUsageController;
__decorate([
    (0, swagger_1.ApiOperation)({ summary: 'Per-tenant token totals and spend (platform admin)' }),
    (0, common_1.Get)(),
    __param(0, (0, common_1.Query)('from')),
    __param(1, (0, common_1.Query)('to')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, String]),
    __metadata("design:returntype", Promise)
], AgentUsageController.prototype, "getUsage", null);
__decorate([
    (0, swagger_1.ApiOperation)({ summary: 'Per-tenant proposal funnel (platform admin)' }),
    (0, common_1.Get)('funnel'),
    __param(0, (0, common_1.Query)('from')),
    __param(1, (0, common_1.Query)('to')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, String]),
    __metadata("design:returntype", Promise)
], AgentUsageController.prototype, "getFunnel", null);
__decorate([
    (0, swagger_1.ApiOperation)({ summary: 'Per-tenant tool invocation counts (platform admin)' }),
    (0, common_1.Get)('errors'),
    __param(0, (0, common_1.Query)('from')),
    __param(1, (0, common_1.Query)('to')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, String]),
    __metadata("design:returntype", Promise)
], AgentUsageController.prototype, "getErrors", null);
__decorate([
    (0, swagger_1.ApiOperation)({ summary: 'Platform default LLM provider (D-07)' }),
    (0, common_1.Get)('default-model'),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", Promise)
], AgentUsageController.prototype, "getDefaultModel", null);
__decorate([
    (0, swagger_1.ApiOperation)({ summary: 'Save platform default LLM provider (D-07)' }),
    (0, common_1.Put)('default-model'),
    __param(0, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [UpdateDefaultModelDto]),
    __metadata("design:returntype", Promise)
], AgentUsageController.prototype, "setDefaultModel", null);
exports.AgentUsageController = AgentUsageController = __decorate([
    (0, swagger_1.ApiTags)('AI Chat Usage'),
    (0, swagger_1.ApiBearerAuth)(),
    (0, common_1.UseGuards)(jwt_auth_guard_1.JwtAuthGuard, superadmin_guard_1.SuperAdminGuard),
    (0, common_1.Controller)('ai-chat/usage'),
    __metadata("design:paramtypes", [agent_usage_service_1.AgentUsageService])
], AgentUsageController);
//# sourceMappingURL=agent-usage.controller.js.map