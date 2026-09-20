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
exports.TrunksController = void 0;
const common_1 = require("@nestjs/common");
const trunks_service_1 = require("./trunks.service");
const jwt_auth_guard_1 = require("../auth/jwt-auth.guard");
let TrunksController = class TrunksController {
    trunksService;
    constructor(trunksService) {
        this.trunksService = trunksService;
    }
    findAll(req) {
        return this.trunksService.findAll(req.user.vpbx_user_uid);
    }
    findOne(trunkId, req) {
        return this.trunksService.findOne(trunkId, req.user.vpbx_user_uid);
    }
    create(dto, req) {
        return this.trunksService.create(dto, req.user.vpbx_user_uid, req.user.uid);
    }
    update(trunkId, dto, req) {
        return this.trunksService.update(trunkId, dto, req.user.vpbx_user_uid, req.user.uid);
    }
    remove(trunkId, req) {
        return this.trunksService.remove(trunkId, req.user.vpbx_user_uid, req.user.uid);
    }
    bulkDelete(body, req) {
        return this.trunksService.bulkRemove(body.ids, req.user.vpbx_user_uid, req.user.uid);
    }
};
exports.TrunksController = TrunksController;
__decorate([
    (0, common_1.Get)(),
    __param(0, (0, common_1.Req)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", void 0)
], TrunksController.prototype, "findAll", null);
__decorate([
    (0, common_1.Get)(':trunkId'),
    __param(0, (0, common_1.Param)('trunkId')),
    __param(1, (0, common_1.Req)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, Object]),
    __metadata("design:returntype", void 0)
], TrunksController.prototype, "findOne", null);
__decorate([
    (0, common_1.Post)(),
    __param(0, (0, common_1.Body)()),
    __param(1, (0, common_1.Req)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, Object]),
    __metadata("design:returntype", void 0)
], TrunksController.prototype, "create", null);
__decorate([
    (0, common_1.Put)(':trunkId'),
    __param(0, (0, common_1.Param)('trunkId')),
    __param(1, (0, common_1.Body)()),
    __param(2, (0, common_1.Req)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, Object, Object]),
    __metadata("design:returntype", void 0)
], TrunksController.prototype, "update", null);
__decorate([
    (0, common_1.Delete)(':trunkId'),
    __param(0, (0, common_1.Param)('trunkId')),
    __param(1, (0, common_1.Req)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, Object]),
    __metadata("design:returntype", void 0)
], TrunksController.prototype, "remove", null);
__decorate([
    (0, common_1.Post)('bulk/delete'),
    __param(0, (0, common_1.Body)()),
    __param(1, (0, common_1.Req)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, Object]),
    __metadata("design:returntype", void 0)
], TrunksController.prototype, "bulkDelete", null);
exports.TrunksController = TrunksController = __decorate([
    (0, common_1.UseGuards)(jwt_auth_guard_1.JwtAuthGuard),
    (0, common_1.Controller)('trunks'),
    __metadata("design:paramtypes", [trunks_service_1.TrunksService])
], TrunksController);
//# sourceMappingURL=trunks.controller.js.map