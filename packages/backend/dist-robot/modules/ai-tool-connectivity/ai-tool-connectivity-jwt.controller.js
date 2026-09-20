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
exports.AiToolConnectivityJwtController = void 0;
const common_1 = require("@nestjs/common");
const tenant_context_guard_1 = require("../integration-credentials/tenant-context.guard");
const ai_tool_connectivity_service_1 = require("./ai-tool-connectivity.service");
let AiToolConnectivityJwtController = class AiToolConnectivityJwtController {
    tools;
    constructor(tools) {
        this.tools = tools;
    }
    list(request) {
        return this.tools.list(request.tenantContext);
    }
    create(request, body) {
        return this.tools.create(request.tenantContext, body);
    }
    probe(body) {
        return this.tools.probe(body.simulated !== false);
    }
};
exports.AiToolConnectivityJwtController = AiToolConnectivityJwtController;
__decorate([
    (0, common_1.Get)(),
    __param(0, (0, common_1.Req)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", void 0)
], AiToolConnectivityJwtController.prototype, "list", null);
__decorate([
    (0, common_1.Post)(),
    __param(0, (0, common_1.Req)()),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, Object]),
    __metadata("design:returntype", void 0)
], AiToolConnectivityJwtController.prototype, "create", null);
__decorate([
    (0, common_1.Post)('probe'),
    __param(0, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", void 0)
], AiToolConnectivityJwtController.prototype, "probe", null);
exports.AiToolConnectivityJwtController = AiToolConnectivityJwtController = __decorate([
    (0, common_1.UseGuards)(tenant_context_guard_1.TenantContextGuard),
    (0, common_1.Controller)('ai-tools'),
    __metadata("design:paramtypes", [ai_tool_connectivity_service_1.AiToolConnectivityService])
], AiToolConnectivityJwtController);
//# sourceMappingURL=ai-tool-connectivity-jwt.controller.js.map