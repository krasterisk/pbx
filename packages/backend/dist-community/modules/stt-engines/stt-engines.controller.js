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
exports.SttEnginesController = void 0;
const common_1 = require("@nestjs/common");
const jwt_auth_guard_1 = require("../auth/jwt-auth.guard");
const stt_engines_service_1 = require("./stt-engines.service");
let SttEnginesController = class SttEnginesController {
    sttEnginesService;
    constructor(sttEnginesService) {
        this.sttEnginesService = sttEnginesService;
    }
    async findAll(req) {
        const userUid = req.user.vpbx_user_uid;
        const engines = await this.sttEnginesService.findAll(userUid);
        return engines.map(e => this.sttEnginesService.maskToken(e));
    }
    async findOne(id, req) {
        const userUid = req.user.vpbx_user_uid;
        const engine = await this.sttEnginesService.findOne(id, userUid);
        return this.sttEnginesService.maskToken(engine);
    }
    async create(body, req) {
        const userUid = req.user.vpbx_user_uid;
        return this.sttEnginesService.create(body, userUid);
    }
    async update(id, body, req) {
        const userUid = req.user.vpbx_user_uid;
        return this.sttEnginesService.update(id, body, userUid);
    }
    async remove(id, req) {
        const userUid = req.user.vpbx_user_uid;
        await this.sttEnginesService.remove(id, userUid);
        return { message: 'STT Engine deleted' };
    }
    async bulkDelete(body, req) {
        const userUid = req.user.vpbx_user_uid;
        return this.sttEnginesService.bulkRemove(body.ids, userUid);
    }
};
exports.SttEnginesController = SttEnginesController;
__decorate([
    (0, common_1.Get)(),
    __param(0, (0, common_1.Req)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", Promise)
], SttEnginesController.prototype, "findAll", null);
__decorate([
    (0, common_1.Get)(':id'),
    __param(0, (0, common_1.Param)('id', common_1.ParseIntPipe)),
    __param(1, (0, common_1.Req)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Number, Object]),
    __metadata("design:returntype", Promise)
], SttEnginesController.prototype, "findOne", null);
__decorate([
    (0, common_1.Post)(),
    __param(0, (0, common_1.Body)()),
    __param(1, (0, common_1.Req)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, Object]),
    __metadata("design:returntype", Promise)
], SttEnginesController.prototype, "create", null);
__decorate([
    (0, common_1.Put)(':id'),
    __param(0, (0, common_1.Param)('id', common_1.ParseIntPipe)),
    __param(1, (0, common_1.Body)()),
    __param(2, (0, common_1.Req)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Number, Object, Object]),
    __metadata("design:returntype", Promise)
], SttEnginesController.prototype, "update", null);
__decorate([
    (0, common_1.Delete)(':id'),
    __param(0, (0, common_1.Param)('id', common_1.ParseIntPipe)),
    __param(1, (0, common_1.Req)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Number, Object]),
    __metadata("design:returntype", Promise)
], SttEnginesController.prototype, "remove", null);
__decorate([
    (0, common_1.Post)('bulk/delete'),
    __param(0, (0, common_1.Body)()),
    __param(1, (0, common_1.Req)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, Object]),
    __metadata("design:returntype", Promise)
], SttEnginesController.prototype, "bulkDelete", null);
exports.SttEnginesController = SttEnginesController = __decorate([
    (0, common_1.Controller)('stt-engines'),
    (0, common_1.UseGuards)(jwt_auth_guard_1.JwtAuthGuard),
    __metadata("design:paramtypes", [stt_engines_service_1.SttEnginesService])
], SttEnginesController);
//# sourceMappingURL=stt-engines.controller.js.map