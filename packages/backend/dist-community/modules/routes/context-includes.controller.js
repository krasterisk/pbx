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
exports.ContextIncludesController = void 0;
const common_1 = require("@nestjs/common");
const context_includes_service_1 = require("./context-includes.service");
const jwt_auth_guard_1 = require("../auth/jwt-auth.guard");
let ContextIncludesController = class ContextIncludesController {
    ciService;
    constructor(ciService) {
        this.ciService = ciService;
    }
    findByContext(contextUid, req) {
        return this.ciService.findByContext(+contextUid, req.user.vpbx_user_uid);
    }
    add(body, req) {
        return this.ciService.add(body.contextUid, body.includeUid, req.user.vpbx_user_uid);
    }
    remove(id, req) {
        return this.ciService.remove(+id, req.user.vpbx_user_uid);
    }
};
exports.ContextIncludesController = ContextIncludesController;
__decorate([
    (0, common_1.Get)(),
    __param(0, (0, common_1.Query)('contextUid')),
    __param(1, (0, common_1.Req)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, Object]),
    __metadata("design:returntype", void 0)
], ContextIncludesController.prototype, "findByContext", null);
__decorate([
    (0, common_1.Post)(),
    __param(0, (0, common_1.Body)()),
    __param(1, (0, common_1.Req)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, Object]),
    __metadata("design:returntype", void 0)
], ContextIncludesController.prototype, "add", null);
__decorate([
    (0, common_1.Delete)(':id'),
    __param(0, (0, common_1.Param)('id')),
    __param(1, (0, common_1.Req)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, Object]),
    __metadata("design:returntype", void 0)
], ContextIncludesController.prototype, "remove", null);
exports.ContextIncludesController = ContextIncludesController = __decorate([
    (0, common_1.UseGuards)(jwt_auth_guard_1.JwtAuthGuard),
    (0, common_1.Controller)('context-includes'),
    __metadata("design:paramtypes", [context_includes_service_1.ContextIncludesService])
], ContextIncludesController);
//# sourceMappingURL=context-includes.controller.js.map