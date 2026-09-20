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
exports.IvrsController = void 0;
const common_1 = require("@nestjs/common");
const jwt_auth_guard_1 = require("../auth/jwt-auth.guard");
const ivrs_service_1 = require("./ivrs.service");
const ivr_tts_service_1 = require("./ivr-tts.service");
const ivr_tts_preview_dto_1 = require("./dto/ivr-tts-preview.dto");
const action_params_validation_util_1 = require("../../shared/pipes/action-params-validation.util");
const USER_LEVEL_ADMIN = 1;
let IvrsController = class IvrsController {
    ivrsService;
    ivrTtsService;
    constructor(ivrsService, ivrTtsService) {
        this.ivrsService = ivrsService;
        this.ivrTtsService = ivrTtsService;
    }
    isAdmin(user) {
        return user?.level === USER_LEVEL_ADMIN;
    }
    async findAll(req) {
        return this.ivrsService.findAll(req.user.vpbx_user_uid);
    }
    async usage(id, req) {
        return this.ivrsService.getUsage(id, req.user.vpbx_user_uid);
    }
    async findOne(id, req) {
        return this.ivrsService.findOne(id, req.user.vpbx_user_uid);
    }
    async create(createDto, req) {
        (0, action_params_validation_util_1.throwIfInvalidActionPayload)(createDto);
        return this.ivrsService.create(createDto, req.user.vpbx_user_uid, this.isAdmin(req.user));
    }
    async update(id, updateDto, req) {
        (0, action_params_validation_util_1.throwIfInvalidActionPayload)(updateDto);
        return this.ivrsService.update(id, updateDto, req.user.vpbx_user_uid, this.isAdmin(req.user));
    }
    async remove(id, req) {
        return this.ivrsService.remove(id, req.user.vpbx_user_uid);
    }
    async bulkDelete(body, req) {
        return this.ivrsService.bulkRemove(body.ids, req.user.vpbx_user_uid);
    }
    async ttsPreview(dto, req, res) {
        const vpbxUserUid = req.user.vpbx_user_uid;
        try {
            const engine = await this.ivrTtsService.loadEngine(dto.engine_uid, vpbxUserUid);
            const wav = await this.ivrTtsService.synthesizeToBuffer(engine, dto.text, dto.settings);
            res.setHeader('Content-Type', 'audio/wav');
            res.setHeader('Content-Length', String(wav.length));
            res.send(wav);
        }
        catch (err) {
            throw new common_1.BadRequestException(err.message || 'TTS preview failed');
        }
    }
};
exports.IvrsController = IvrsController;
__decorate([
    (0, common_1.Get)(),
    __param(0, (0, common_1.Req)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", Promise)
], IvrsController.prototype, "findAll", null);
__decorate([
    (0, common_1.Get)(':id/usage'),
    __param(0, (0, common_1.Param)('id', common_1.ParseIntPipe)),
    __param(1, (0, common_1.Req)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Number, Object]),
    __metadata("design:returntype", Promise)
], IvrsController.prototype, "usage", null);
__decorate([
    (0, common_1.Get)(':id'),
    __param(0, (0, common_1.Param)('id', common_1.ParseIntPipe)),
    __param(1, (0, common_1.Req)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Number, Object]),
    __metadata("design:returntype", Promise)
], IvrsController.prototype, "findOne", null);
__decorate([
    (0, common_1.Post)(),
    __param(0, (0, common_1.Body)()),
    __param(1, (0, common_1.Req)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, Object]),
    __metadata("design:returntype", Promise)
], IvrsController.prototype, "create", null);
__decorate([
    (0, common_1.Put)(':id'),
    __param(0, (0, common_1.Param)('id', common_1.ParseIntPipe)),
    __param(1, (0, common_1.Body)()),
    __param(2, (0, common_1.Req)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Number, Object, Object]),
    __metadata("design:returntype", Promise)
], IvrsController.prototype, "update", null);
__decorate([
    (0, common_1.Delete)(':id'),
    __param(0, (0, common_1.Param)('id', common_1.ParseIntPipe)),
    __param(1, (0, common_1.Req)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Number, Object]),
    __metadata("design:returntype", Promise)
], IvrsController.prototype, "remove", null);
__decorate([
    (0, common_1.Post)('bulk/delete'),
    __param(0, (0, common_1.Body)()),
    __param(1, (0, common_1.Req)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, Object]),
    __metadata("design:returntype", Promise)
], IvrsController.prototype, "bulkDelete", null);
__decorate([
    (0, common_1.Post)('tts-preview'),
    __param(0, (0, common_1.Body)()),
    __param(1, (0, common_1.Req)()),
    __param(2, (0, common_1.Res)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [ivr_tts_preview_dto_1.IvrTtsPreviewDto, Object, Object]),
    __metadata("design:returntype", Promise)
], IvrsController.prototype, "ttsPreview", null);
exports.IvrsController = IvrsController = __decorate([
    (0, common_1.Controller)('ivrs'),
    (0, common_1.UseGuards)(jwt_auth_guard_1.JwtAuthGuard),
    __metadata("design:paramtypes", [ivrs_service_1.IvrsService,
        ivr_tts_service_1.IvrTtsService])
], IvrsController);
//# sourceMappingURL=ivrs.controller.js.map