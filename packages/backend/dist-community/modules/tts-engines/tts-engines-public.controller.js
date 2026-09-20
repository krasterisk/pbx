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
exports.TtsEnginesPublicController = void 0;
const common_1 = require("@nestjs/common");
const config_1 = require("@nestjs/config");
const tts_engines_service_1 = require("./tts-engines.service");
/**
 * Public (no-auth) TTS Engines controller for standalone v3 integration.
 * Uses a fixed tenant ID from env: DEFAULT_VPBX_USER_UID.
 */
let TtsEnginesPublicController = class TtsEnginesPublicController {
    ttsEnginesService;
    configService;
    userUid;
    constructor(ttsEnginesService, configService) {
        this.ttsEnginesService = ttsEnginesService;
        this.configService = configService;
        this.userUid = Number(this.configService.get('DEFAULT_VPBX_USER_UID', '1'));
    }
    async findAll() {
        const engines = await this.ttsEnginesService.findAll(this.userUid);
        return engines.map(e => this.ttsEnginesService.maskToken(e));
    }
    async findOne(id) {
        const engine = await this.ttsEnginesService.findOne(id, this.userUid);
        return this.ttsEnginesService.maskToken(engine);
    }
    async create(body) {
        return this.ttsEnginesService.create(body, this.userUid);
    }
    async update(id, body) {
        return this.ttsEnginesService.update(id, body, this.userUid);
    }
    async remove(id) {
        await this.ttsEnginesService.remove(id, this.userUid);
        return { message: 'TTS Engine deleted' };
    }
    async bulkDelete(body) {
        return this.ttsEnginesService.bulkRemove(body.ids, this.userUid);
    }
};
exports.TtsEnginesPublicController = TtsEnginesPublicController;
__decorate([
    (0, common_1.Get)(),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", Promise)
], TtsEnginesPublicController.prototype, "findAll", null);
__decorate([
    (0, common_1.Get)(':id'),
    __param(0, (0, common_1.Param)('id', common_1.ParseIntPipe)),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Number]),
    __metadata("design:returntype", Promise)
], TtsEnginesPublicController.prototype, "findOne", null);
__decorate([
    (0, common_1.Post)(),
    __param(0, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", Promise)
], TtsEnginesPublicController.prototype, "create", null);
__decorate([
    (0, common_1.Put)(':id'),
    __param(0, (0, common_1.Param)('id', common_1.ParseIntPipe)),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Number, Object]),
    __metadata("design:returntype", Promise)
], TtsEnginesPublicController.prototype, "update", null);
__decorate([
    (0, common_1.Delete)(':id'),
    __param(0, (0, common_1.Param)('id', common_1.ParseIntPipe)),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Number]),
    __metadata("design:returntype", Promise)
], TtsEnginesPublicController.prototype, "remove", null);
__decorate([
    (0, common_1.Post)('bulk/delete'),
    __param(0, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", Promise)
], TtsEnginesPublicController.prototype, "bulkDelete", null);
exports.TtsEnginesPublicController = TtsEnginesPublicController = __decorate([
    (0, common_1.Controller)('public/tts-engines'),
    __metadata("design:paramtypes", [tts_engines_service_1.TtsEnginesService,
        config_1.ConfigService])
], TtsEnginesPublicController);
//# sourceMappingURL=tts-engines-public.controller.js.map