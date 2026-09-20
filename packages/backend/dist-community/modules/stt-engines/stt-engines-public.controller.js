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
exports.SttEnginesPublicController = void 0;
const common_1 = require("@nestjs/common");
const config_1 = require("@nestjs/config");
const stt_engines_service_1 = require("./stt-engines.service");
/**
 * Public (no-auth) STT Engines controller for standalone v3 integration.
 * Uses a fixed tenant ID from env: DEFAULT_VPBX_USER_UID.
 */
let SttEnginesPublicController = class SttEnginesPublicController {
    sttEnginesService;
    configService;
    userUid;
    constructor(sttEnginesService, configService) {
        this.sttEnginesService = sttEnginesService;
        this.configService = configService;
        this.userUid = Number(this.configService.get('DEFAULT_VPBX_USER_UID', '1'));
    }
    async findAll() {
        const engines = await this.sttEnginesService.findAll(this.userUid);
        return engines.map(e => this.sttEnginesService.maskToken(e));
    }
    async findOne(id) {
        const engine = await this.sttEnginesService.findOne(id, this.userUid);
        return this.sttEnginesService.maskToken(engine);
    }
    async create(body) {
        return this.sttEnginesService.create(body, this.userUid);
    }
    async update(id, body) {
        return this.sttEnginesService.update(id, body, this.userUid);
    }
    async remove(id) {
        await this.sttEnginesService.remove(id, this.userUid);
        return { message: 'STT Engine deleted' };
    }
    async bulkDelete(body) {
        return this.sttEnginesService.bulkRemove(body.ids, this.userUid);
    }
};
exports.SttEnginesPublicController = SttEnginesPublicController;
__decorate([
    (0, common_1.Get)(),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", Promise)
], SttEnginesPublicController.prototype, "findAll", null);
__decorate([
    (0, common_1.Get)(':id'),
    __param(0, (0, common_1.Param)('id', common_1.ParseIntPipe)),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Number]),
    __metadata("design:returntype", Promise)
], SttEnginesPublicController.prototype, "findOne", null);
__decorate([
    (0, common_1.Post)(),
    __param(0, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", Promise)
], SttEnginesPublicController.prototype, "create", null);
__decorate([
    (0, common_1.Put)(':id'),
    __param(0, (0, common_1.Param)('id', common_1.ParseIntPipe)),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Number, Object]),
    __metadata("design:returntype", Promise)
], SttEnginesPublicController.prototype, "update", null);
__decorate([
    (0, common_1.Delete)(':id'),
    __param(0, (0, common_1.Param)('id', common_1.ParseIntPipe)),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Number]),
    __metadata("design:returntype", Promise)
], SttEnginesPublicController.prototype, "remove", null);
__decorate([
    (0, common_1.Post)('bulk/delete'),
    __param(0, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", Promise)
], SttEnginesPublicController.prototype, "bulkDelete", null);
exports.SttEnginesPublicController = SttEnginesPublicController = __decorate([
    (0, common_1.Controller)('public/stt-engines'),
    __metadata("design:paramtypes", [stt_engines_service_1.SttEnginesService,
        config_1.ConfigService])
], SttEnginesPublicController);
//# sourceMappingURL=stt-engines-public.controller.js.map