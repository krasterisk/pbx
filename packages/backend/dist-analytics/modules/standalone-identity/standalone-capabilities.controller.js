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
exports.StandaloneCapabilitiesController = void 0;
const common_1 = require("@nestjs/common");
const tenant_context_guard_1 = require("../integration-credentials/tenant-context.guard");
const standalone_capabilities_service_1 = require("./standalone-capabilities.service");
let StandaloneCapabilitiesController = class StandaloneCapabilitiesController {
    capabilities;
    constructor(capabilities) {
        this.capabilities = capabilities;
    }
    self(request) {
        const { tenantUid, principalKind, principalId } = request.tenantContext;
        return { tenantUid, principalKind, principalId };
    }
    capabilitiesFor(request) {
        return this.capabilities.forContext(request.tenantContext);
    }
};
exports.StandaloneCapabilitiesController = StandaloneCapabilitiesController;
__decorate([
    (0, common_1.Get)('self'),
    (0, common_1.Header)('Cache-Control', 'no-store'),
    __param(0, (0, common_1.Req)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", void 0)
], StandaloneCapabilitiesController.prototype, "self", null);
__decorate([
    (0, common_1.Get)('capabilities'),
    (0, common_1.Header)('Cache-Control', 'no-store'),
    __param(0, (0, common_1.Req)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", void 0)
], StandaloneCapabilitiesController.prototype, "capabilitiesFor", null);
exports.StandaloneCapabilitiesController = StandaloneCapabilitiesController = __decorate([
    (0, common_1.Controller)('v1/identity'),
    (0, common_1.UseGuards)(tenant_context_guard_1.TenantContextGuard),
    __metadata("design:paramtypes", [standalone_capabilities_service_1.StandaloneCapabilitiesService])
], StandaloneCapabilitiesController);
//# sourceMappingURL=standalone-capabilities.controller.js.map