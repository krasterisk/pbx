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
exports.CallGroupsController = void 0;
const common_1 = require("@nestjs/common");
const call_groups_service_1 = require("./call-groups.service");
const call_group_dto_1 = require("./dto/call-group.dto");
const jwt_auth_guard_1 = require("../auth/jwt-auth.guard");
let CallGroupsController = class CallGroupsController {
    callGroupsService;
    constructor(callGroupsService) {
        this.callGroupsService = callGroupsService;
    }
    findAll(req) {
        return this.callGroupsService.findAll(req.user.vpbx_user_uid);
    }
    findOne(uid, req) {
        return this.callGroupsService.findOne(uid, req.user.vpbx_user_uid);
    }
    create(dto, req) {
        return this.callGroupsService.create(dto, req.user.vpbx_user_uid);
    }
    update(uid, dto, req) {
        return this.callGroupsService.update(uid, dto, req.user.vpbx_user_uid);
    }
    remove(uid, req) {
        return this.callGroupsService.remove(uid, req.user.vpbx_user_uid);
    }
};
exports.CallGroupsController = CallGroupsController;
__decorate([
    (0, common_1.Get)(),
    __param(0, (0, common_1.Req)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", void 0)
], CallGroupsController.prototype, "findAll", null);
__decorate([
    (0, common_1.Get)(':uid'),
    __param(0, (0, common_1.Param)('uid', common_1.ParseIntPipe)),
    __param(1, (0, common_1.Req)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Number, Object]),
    __metadata("design:returntype", void 0)
], CallGroupsController.prototype, "findOne", null);
__decorate([
    (0, common_1.Post)(),
    __param(0, (0, common_1.Body)()),
    __param(1, (0, common_1.Req)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [call_group_dto_1.CreateCallGroupDto, Object]),
    __metadata("design:returntype", void 0)
], CallGroupsController.prototype, "create", null);
__decorate([
    (0, common_1.Put)(':uid'),
    __param(0, (0, common_1.Param)('uid', common_1.ParseIntPipe)),
    __param(1, (0, common_1.Body)()),
    __param(2, (0, common_1.Req)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Number, call_group_dto_1.UpdateCallGroupDto, Object]),
    __metadata("design:returntype", void 0)
], CallGroupsController.prototype, "update", null);
__decorate([
    (0, common_1.Delete)(':uid'),
    __param(0, (0, common_1.Param)('uid', common_1.ParseIntPipe)),
    __param(1, (0, common_1.Req)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Number, Object]),
    __metadata("design:returntype", void 0)
], CallGroupsController.prototype, "remove", null);
exports.CallGroupsController = CallGroupsController = __decorate([
    (0, common_1.UseGuards)(jwt_auth_guard_1.JwtAuthGuard),
    (0, common_1.Controller)('call-groups'),
    __metadata("design:paramtypes", [call_groups_service_1.CallGroupsService])
], CallGroupsController);
//# sourceMappingURL=call-groups.controller.js.map