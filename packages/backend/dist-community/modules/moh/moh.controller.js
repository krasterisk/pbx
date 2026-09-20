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
exports.MohController = void 0;
const common_1 = require("@nestjs/common");
const jwt_auth_guard_1 = require("../auth/jwt-auth.guard");
const moh_service_1 = require("./moh.service");
let MohController = class MohController {
    mohService;
    constructor(mohService) {
        this.mohService = mohService;
    }
    async findAll(req) {
        const userUid = req.user?.vpbx_user_uid || req.user?.user_uid || 0;
        return this.mohService.findAll(userUid);
    }
    async findOne(name, req) {
        const userUid = req.user?.vpbx_user_uid || req.user?.user_uid || 0;
        return this.mohService.findOne(name, userUid);
    }
    async create(body, req) {
        const userUid = req.user?.vpbx_user_uid || req.user?.user_uid || 0;
        return this.mohService.create(body, userUid);
    }
    async update(name, body, req) {
        const userUid = req.user?.vpbx_user_uid || req.user?.user_uid || 0;
        return this.mohService.update(name, body, userUid);
    }
    async remove(name, req) {
        const userUid = req.user?.vpbx_user_uid || req.user?.user_uid || 0;
        await this.mohService.remove(name, userUid);
        return { message: 'MOH class deleted', name };
    }
};
exports.MohController = MohController;
__decorate([
    (0, common_1.Get)(),
    __param(0, (0, common_1.Req)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", Promise)
], MohController.prototype, "findAll", null);
__decorate([
    (0, common_1.Get)(':name'),
    __param(0, (0, common_1.Param)('name')),
    __param(1, (0, common_1.Req)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, Object]),
    __metadata("design:returntype", Promise)
], MohController.prototype, "findOne", null);
__decorate([
    (0, common_1.Post)(),
    __param(0, (0, common_1.Body)()),
    __param(1, (0, common_1.Req)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, Object]),
    __metadata("design:returntype", Promise)
], MohController.prototype, "create", null);
__decorate([
    (0, common_1.Put)(':name'),
    __param(0, (0, common_1.Param)('name')),
    __param(1, (0, common_1.Body)()),
    __param(2, (0, common_1.Req)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, Object, Object]),
    __metadata("design:returntype", Promise)
], MohController.prototype, "update", null);
__decorate([
    (0, common_1.Delete)(':name'),
    __param(0, (0, common_1.Param)('name')),
    __param(1, (0, common_1.Req)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, Object]),
    __metadata("design:returntype", Promise)
], MohController.prototype, "remove", null);
exports.MohController = MohController = __decorate([
    (0, common_1.Controller)('moh'),
    (0, common_1.UseGuards)(jwt_auth_guard_1.JwtAuthGuard),
    __metadata("design:paramtypes", [moh_service_1.MohService])
], MohController);
//# sourceMappingURL=moh.controller.js.map