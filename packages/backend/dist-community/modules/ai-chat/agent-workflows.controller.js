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
exports.AgentWorkflowsController = void 0;
const common_1 = require("@nestjs/common");
const swagger_1 = require("@nestjs/swagger");
const throttler_1 = require("@nestjs/throttler");
const jwt_auth_guard_1 = require("../auth/jwt-auth.guard");
const pbx_workflow_runner_service_1 = require("./pbx-workflow-runner.service");
function contextFromToken(req) {
    const user = req.user ?? {};
    return {
        vpbxUserUid: user.vpbx_user_uid,
        userUid: user.sub || user.id || 0,
        role: user.level,
    };
}
let AgentWorkflowsController = class AgentWorkflowsController {
    workflows;
    constructor(workflows) {
        this.workflows = workflows;
    }
    getPending(req) {
        return this.workflows.listPending(contextFromToken(req));
    }
    getOne(workflowId, req) {
        return this.workflows.getOwned(workflowId, contextFromToken(req));
    }
    apply(workflowId, req) {
        return this.workflows.apply(workflowId, contextFromToken(req));
    }
    reject(workflowId, req) {
        return this.workflows.reject(workflowId, contextFromToken(req));
    }
};
exports.AgentWorkflowsController = AgentWorkflowsController;
__decorate([
    (0, swagger_1.ApiOperation)({ summary: 'List pending/failed agent workflows for the caller' }),
    (0, common_1.Get)('pending'),
    __param(0, (0, common_1.Req)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", void 0)
], AgentWorkflowsController.prototype, "getPending", null);
__decorate([
    (0, swagger_1.ApiOperation)({ summary: 'Get one workflow plan with live step statuses' }),
    (0, common_1.Get)(':workflowId'),
    __param(0, (0, common_1.Param)('workflowId')),
    __param(1, (0, common_1.Req)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, Object]),
    __metadata("design:returntype", void 0)
], AgentWorkflowsController.prototype, "getOne", null);
__decorate([
    (0, swagger_1.ApiOperation)({ summary: 'Apply a staged workflow (stops on first failure)' }),
    (0, throttler_1.Throttle)({ global: { limit: 10, ttl: 60000 } }),
    (0, common_1.Post)(':workflowId/apply'),
    __param(0, (0, common_1.Param)('workflowId')),
    __param(1, (0, common_1.Req)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, Object]),
    __metadata("design:returntype", void 0)
], AgentWorkflowsController.prototype, "apply", null);
__decorate([
    (0, swagger_1.ApiOperation)({ summary: 'Reject a pending workflow' }),
    (0, throttler_1.Throttle)({ global: { limit: 10, ttl: 60000 } }),
    (0, common_1.Post)(':workflowId/reject'),
    __param(0, (0, common_1.Param)('workflowId')),
    __param(1, (0, common_1.Req)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, Object]),
    __metadata("design:returntype", void 0)
], AgentWorkflowsController.prototype, "reject", null);
exports.AgentWorkflowsController = AgentWorkflowsController = __decorate([
    (0, swagger_1.ApiTags)('AI Chat'),
    (0, swagger_1.ApiBearerAuth)(),
    (0, common_1.UseGuards)(jwt_auth_guard_1.JwtAuthGuard),
    (0, common_1.Controller)('ai-chat/workflows'),
    __metadata("design:paramtypes", [pbx_workflow_runner_service_1.PbxWorkflowRunnerService])
], AgentWorkflowsController);
//# sourceMappingURL=agent-workflows.controller.js.map