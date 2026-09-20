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
exports.CallbackRequestsController = void 0;
const common_1 = require("@nestjs/common");
const jwt_auth_guard_1 = require("../auth/jwt-auth.guard");
const callcenter_rbac_util_1 = require("../callcenter/callcenter-rbac.util");
const callback_requests_service_1 = require("./callback-requests.service");
const callback_request_dto_1 = require("./dto/callback-request.dto");
let CallbackRequestsController = class CallbackRequestsController {
    service;
    constructor(service) {
        this.service = service;
    }
    list(req, query) {
        const tenantUid = req.user.vpbx_user_uid;
        const agentUid = req.user.sub;
        const status = query.status === 'completed' ? 'completed' : 'active';
        if ((0, callcenter_rbac_util_1.isSupervisorUser)(req.user)) {
            return this.service.listForSupervisor(tenantUid, status);
        }
        return this.service.listForAgent(tenantUid, agentUid, status);
    }
    claim(id, req) {
        return this.service.claim(req.user.vpbx_user_uid, req.user.sub, id);
    }
    cancel(id, req) {
        return this.service.cancel(req.user.vpbx_user_uid, req.user.sub, id, (0, callcenter_rbac_util_1.isSupervisorUser)(req.user));
    }
};
exports.CallbackRequestsController = CallbackRequestsController;
__decorate([
    (0, common_1.Get)(),
    __param(0, (0, common_1.Req)()),
    __param(1, (0, common_1.Query)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, callback_request_dto_1.ListCallbackRequestsQueryDto]),
    __metadata("design:returntype", void 0)
], CallbackRequestsController.prototype, "list", null);
__decorate([
    (0, common_1.Post)(':id/claim'),
    __param(0, (0, common_1.Param)('id', common_1.ParseIntPipe)),
    __param(1, (0, common_1.Req)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Number, Object]),
    __metadata("design:returntype", void 0)
], CallbackRequestsController.prototype, "claim", null);
__decorate([
    (0, common_1.Post)(':id/cancel'),
    __param(0, (0, common_1.Param)('id', common_1.ParseIntPipe)),
    __param(1, (0, common_1.Req)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Number, Object]),
    __metadata("design:returntype", void 0)
], CallbackRequestsController.prototype, "cancel", null);
exports.CallbackRequestsController = CallbackRequestsController = __decorate([
    (0, common_1.UseGuards)(jwt_auth_guard_1.JwtAuthGuard),
    (0, common_1.Controller)('callback-requests'),
    __metadata("design:paramtypes", [callback_requests_service_1.CallbackRequestsService])
], CallbackRequestsController);
//# sourceMappingURL=callback-requests.controller.js.map