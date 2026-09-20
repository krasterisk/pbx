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
exports.TtsEnginesController = void 0;
const common_1 = require("@nestjs/common");
const jwt_auth_guard_1 = require("../auth/jwt-auth.guard");
const tts_engines_service_1 = require("./tts-engines.service");
let TtsEnginesController = class TtsEnginesController {
    ttsEnginesService;
    constructor(ttsEnginesService) {
        this.ttsEnginesService = ttsEnginesService;
    }
    async findAll(req) {
        const userUid = req.user.vpbx_user_uid;
        const engines = await this.ttsEnginesService.findAll(userUid);
        return engines.map(e => this.ttsEnginesService.maskToken(e));
    }
    async findOne(id, req) {
        const userUid = req.user.vpbx_user_uid;
        const engine = await this.ttsEnginesService.findOne(id, userUid);
        return this.ttsEnginesService.maskToken(engine);
    }
    async create(body, req) {
        const userUid = req.user.vpbx_user_uid;
        return this.ttsEnginesService.create(body, userUid);
    }
    async update(id, body, req) {
        const userUid = req.user.vpbx_user_uid;
        return this.ttsEnginesService.update(id, body, userUid);
    }
    async remove(id, req) {
        const userUid = req.user.vpbx_user_uid;
        await this.ttsEnginesService.remove(id, userUid);
        return { message: 'TTS Engine deleted' };
    }
    async bulkDelete(body, req) {
        const userUid = req.user.vpbx_user_uid;
        return this.ttsEnginesService.bulkRemove(body.ids, userUid);
    }
};
exports.TtsEnginesController = TtsEnginesController;
__decorate([
    (0, common_1.Get)(),
    __param(0, (0, common_1.Req)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", Promise)
], TtsEnginesController.prototype, "findAll", null);
__decorate([
    (0, common_1.Get)(':id'),
    __param(0, (0, common_1.Param)('id', common_1.ParseIntPipe)),
    __param(1, (0, common_1.Req)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Number, Object]),
    __metadata("design:returntype", Promise)
], TtsEnginesController.prototype, "findOne", null);
__decorate([
    (0, common_1.Post)(),
    __param(0, (0, common_1.Body)()),
    __param(1, (0, common_1.Req)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, Object]),
    __metadata("design:returntype", Promise)
], TtsEnginesController.prototype, "create", null);
__decorate([
    (0, common_1.Put)(':id'),
    __param(0, (0, common_1.Param)('id', common_1.ParseIntPipe)),
    __param(1, (0, common_1.Body)()),
    __param(2, (0, common_1.Req)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Number, Object, Object]),
    __metadata("design:returntype", Promise)
], TtsEnginesController.prototype, "update", null);
__decorate([
    (0, common_1.Delete)(':id'),
    __param(0, (0, common_1.Param)('id', common_1.ParseIntPipe)),
    __param(1, (0, common_1.Req)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Number, Object]),
    __metadata("design:returntype", Promise)
], TtsEnginesController.prototype, "remove", null);
__decorate([
    (0, common_1.Post)('bulk/delete'),
    __param(0, (0, common_1.Body)()),
    __param(1, (0, common_1.Req)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, Object]),
    __metadata("design:returntype", Promise)
], TtsEnginesController.prototype, "bulkDelete", null);
exports.TtsEnginesController = TtsEnginesController = __decorate([
    (0, common_1.Controller)('tts-engines'),
    (0, common_1.UseGuards)(jwt_auth_guard_1.JwtAuthGuard),
    __metadata("design:paramtypes", [tts_engines_service_1.TtsEnginesService])
], TtsEnginesController);
//# sourceMappingURL=tts-engines.controller.js.map