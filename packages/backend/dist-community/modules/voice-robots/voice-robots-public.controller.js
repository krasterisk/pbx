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
exports.VoiceRobotsPublicController = void 0;
const common_1 = require("@nestjs/common");
const config_1 = require("@nestjs/config");
const voice_robots_service_1 = require("./voice-robots.service");
const voice_robots_public_key_guard_1 = require("./voice-robots-public-key.guard");
/**
 * v3 public Voice Robots URLs. Tenant is still DEFAULT_VPBX_USER_UID;
 * access requires VOICE_ROBOTS_PUBLIC_API_KEY or DIALPLAN_API_KEY.
 */
let VoiceRobotsPublicController = class VoiceRobotsPublicController {
    voiceRobotsService;
    configService;
    userUid;
    constructor(voiceRobotsService, configService) {
        this.voiceRobotsService = voiceRobotsService;
        this.configService = configService;
        this.userUid = Number(this.configService.get('DEFAULT_VPBX_USER_UID', '1'));
    }
    // ─── Robot CRUD ────────────────────────────────────────
    async findAll() {
        return this.voiceRobotsService.findAll(this.userUid);
    }
    // ─── CDR (Call Detail Records) ────────────────────────
    // IMPORTANT: CDR routes MUST be declared before :uid to avoid param collision
    async findAllCdr(limit, offset, robotId, disposition, callerId, dateFrom, dateTo, search, tag) {
        return this.voiceRobotsService.findAllCdr(this.userUid, {
            limit: limit ? parseInt(limit, 10) : undefined,
            offset: offset ? parseInt(offset, 10) : undefined,
            robotId: robotId ? parseInt(robotId, 10) : undefined,
            disposition, callerId, dateFrom, dateTo, search, tag,
        });
    }
    async getCdrStats(robotId) {
        return this.voiceRobotsService.getCdrStats(this.userUid, robotId ? parseInt(robotId, 10) : undefined);
    }
    async getCdrTags() {
        return this.voiceRobotsService.getDistinctTags(this.userUid);
    }
    async exportCdr(disposition, dateFrom, dateTo, search, tag) {
        return this.voiceRobotsService.findAllCdr(this.userUid, {
            limit: 10000,
            offset: 0,
            disposition, dateFrom, dateTo, search, tag,
        });
    }
    async findOneCdr(id) {
        return this.voiceRobotsService.findOneCdr(this.userUid, id);
    }
    async getCdrDetail(id) {
        return this.voiceRobotsService.getCdrWithLogs(this.userUid, id);
    }
    // ─── Robot by ID ───────────────────────────────────────
    async findOne(uid) {
        return this.voiceRobotsService.findOne(this.userUid, uid);
    }
    async create(body) {
        return this.voiceRobotsService.createRobot(this.userUid, body);
    }
    async update(uid, body) {
        return this.voiceRobotsService.updateRobot(this.userUid, uid, body);
    }
    async delete(uid) {
        await this.voiceRobotsService.deleteRobot(this.userUid, uid);
    }
    // ─── Keyword Groups CRUD ──────────────────────────────
    async getKeywordGroups(robotId) {
        return this.voiceRobotsService.getKeywordGroups(this.userUid, robotId);
    }
    async createKeywordGroup(robotId, body) {
        return this.voiceRobotsService.createKeywordGroup(this.userUid, robotId, body);
    }
    async updateKeywordGroup(id, body) {
        return this.voiceRobotsService.updateKeywordGroup(this.userUid, id, body);
    }
    async deleteKeywordGroup(id) {
        await this.voiceRobotsService.deleteKeywordGroup(this.userUid, id);
    }
    // ─── Keywords CRUD ────────────────────────────────────
    async getKeywords(groupId) {
        return this.voiceRobotsService.getKeywords(this.userUid, groupId);
    }
    async createKeyword(groupId, body) {
        return this.voiceRobotsService.createKeyword(this.userUid, groupId, body);
    }
    async updateKeyword(uid, body) {
        return this.voiceRobotsService.updateKeyword(this.userUid, uid, body);
    }
    async deleteKeyword(uid) {
        await this.voiceRobotsService.deleteKeyword(this.userUid, uid);
    }
    // ─── Logs ─────────────────────────────────────────────
    async getLogs(robotId) {
        return this.voiceRobotsService.getLogs(this.userUid, robotId);
    }
    // ─── Data Lists CRUD ──────────────────────────────────
    async getDataLists(robotId) {
        return this.voiceRobotsService.getDataLists(this.userUid, robotId);
    }
    async createDataList(robotId, body) {
        return this.voiceRobotsService.createDataList(this.userUid, robotId, body);
    }
    async updateDataList(id, body) {
        return this.voiceRobotsService.updateDataList(this.userUid, id, body);
    }
    async deleteDataList(id) {
        await this.voiceRobotsService.deleteDataList(this.userUid, id);
    }
    async testDataListSearch(listId, body) {
        return this.voiceRobotsService.testDataListSearch(this.userUid, listId, body.query, body.returnField);
    }
    async testMatch(robotId, body) {
        return this.voiceRobotsService.testMatch(this.userUid, robotId, body.text);
    }
};
exports.VoiceRobotsPublicController = VoiceRobotsPublicController;
__decorate([
    (0, common_1.Get)(),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", Promise)
], VoiceRobotsPublicController.prototype, "findAll", null);
__decorate([
    (0, common_1.Get)('cdr'),
    __param(0, (0, common_1.Query)('limit')),
    __param(1, (0, common_1.Query)('offset')),
    __param(2, (0, common_1.Query)('robotId')),
    __param(3, (0, common_1.Query)('disposition')),
    __param(4, (0, common_1.Query)('callerId')),
    __param(5, (0, common_1.Query)('dateFrom')),
    __param(6, (0, common_1.Query)('dateTo')),
    __param(7, (0, common_1.Query)('search')),
    __param(8, (0, common_1.Query)('tag')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, String, String, String, String, String, String, String, String]),
    __metadata("design:returntype", Promise)
], VoiceRobotsPublicController.prototype, "findAllCdr", null);
__decorate([
    (0, common_1.Get)('cdr/stats'),
    __param(0, (0, common_1.Query)('robotId')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", Promise)
], VoiceRobotsPublicController.prototype, "getCdrStats", null);
__decorate([
    (0, common_1.Get)('cdr/tags'),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", Promise)
], VoiceRobotsPublicController.prototype, "getCdrTags", null);
__decorate([
    (0, common_1.Get)('cdr/export'),
    __param(0, (0, common_1.Query)('disposition')),
    __param(1, (0, common_1.Query)('dateFrom')),
    __param(2, (0, common_1.Query)('dateTo')),
    __param(3, (0, common_1.Query)('search')),
    __param(4, (0, common_1.Query)('tag')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, String, String, String, String]),
    __metadata("design:returntype", Promise)
], VoiceRobotsPublicController.prototype, "exportCdr", null);
__decorate([
    (0, common_1.Get)('cdr/:id'),
    __param(0, (0, common_1.Param)('id', common_1.ParseIntPipe)),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Number]),
    __metadata("design:returntype", Promise)
], VoiceRobotsPublicController.prototype, "findOneCdr", null);
__decorate([
    (0, common_1.Get)('cdr/:id/detail'),
    __param(0, (0, common_1.Param)('id', common_1.ParseIntPipe)),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Number]),
    __metadata("design:returntype", Promise)
], VoiceRobotsPublicController.prototype, "getCdrDetail", null);
__decorate([
    (0, common_1.Get)(':uid'),
    __param(0, (0, common_1.Param)('uid', common_1.ParseIntPipe)),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Number]),
    __metadata("design:returntype", Promise)
], VoiceRobotsPublicController.prototype, "findOne", null);
__decorate([
    (0, common_1.Post)(),
    __param(0, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", Promise)
], VoiceRobotsPublicController.prototype, "create", null);
__decorate([
    (0, common_1.Put)(':uid'),
    __param(0, (0, common_1.Param)('uid', common_1.ParseIntPipe)),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Number, Object]),
    __metadata("design:returntype", Promise)
], VoiceRobotsPublicController.prototype, "update", null);
__decorate([
    (0, common_1.Delete)(':uid'),
    (0, common_1.HttpCode)(204),
    __param(0, (0, common_1.Param)('uid', common_1.ParseIntPipe)),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Number]),
    __metadata("design:returntype", Promise)
], VoiceRobotsPublicController.prototype, "delete", null);
__decorate([
    (0, common_1.Get)(':id/keyword-groups'),
    __param(0, (0, common_1.Param)('id', common_1.ParseIntPipe)),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Number]),
    __metadata("design:returntype", Promise)
], VoiceRobotsPublicController.prototype, "getKeywordGroups", null);
__decorate([
    (0, common_1.Post)(':id/keyword-groups'),
    __param(0, (0, common_1.Param)('id', common_1.ParseIntPipe)),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Number, Object]),
    __metadata("design:returntype", Promise)
], VoiceRobotsPublicController.prototype, "createKeywordGroup", null);
__decorate([
    (0, common_1.Put)('keyword-groups/:id'),
    __param(0, (0, common_1.Param)('id', common_1.ParseIntPipe)),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Number, Object]),
    __metadata("design:returntype", Promise)
], VoiceRobotsPublicController.prototype, "updateKeywordGroup", null);
__decorate([
    (0, common_1.Delete)('keyword-groups/:id'),
    (0, common_1.HttpCode)(204),
    __param(0, (0, common_1.Param)('id', common_1.ParseIntPipe)),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Number]),
    __metadata("design:returntype", Promise)
], VoiceRobotsPublicController.prototype, "deleteKeywordGroup", null);
__decorate([
    (0, common_1.Get)('keyword-groups/:id/keywords'),
    __param(0, (0, common_1.Param)('id', common_1.ParseIntPipe)),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Number]),
    __metadata("design:returntype", Promise)
], VoiceRobotsPublicController.prototype, "getKeywords", null);
__decorate([
    (0, common_1.Post)('keyword-groups/:id/keywords'),
    __param(0, (0, common_1.Param)('id', common_1.ParseIntPipe)),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Number, Object]),
    __metadata("design:returntype", Promise)
], VoiceRobotsPublicController.prototype, "createKeyword", null);
__decorate([
    (0, common_1.Put)('keywords/:uid'),
    __param(0, (0, common_1.Param)('uid', common_1.ParseIntPipe)),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Number, Object]),
    __metadata("design:returntype", Promise)
], VoiceRobotsPublicController.prototype, "updateKeyword", null);
__decorate([
    (0, common_1.Delete)('keywords/:uid'),
    (0, common_1.HttpCode)(204),
    __param(0, (0, common_1.Param)('uid', common_1.ParseIntPipe)),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Number]),
    __metadata("design:returntype", Promise)
], VoiceRobotsPublicController.prototype, "deleteKeyword", null);
__decorate([
    (0, common_1.Get)(':id/logs'),
    __param(0, (0, common_1.Param)('id', common_1.ParseIntPipe)),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Number]),
    __metadata("design:returntype", Promise)
], VoiceRobotsPublicController.prototype, "getLogs", null);
__decorate([
    (0, common_1.Get)(':id/data-lists'),
    __param(0, (0, common_1.Param)('id', common_1.ParseIntPipe)),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Number]),
    __metadata("design:returntype", Promise)
], VoiceRobotsPublicController.prototype, "getDataLists", null);
__decorate([
    (0, common_1.Post)(':id/data-lists'),
    __param(0, (0, common_1.Param)('id', common_1.ParseIntPipe)),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Number, Object]),
    __metadata("design:returntype", Promise)
], VoiceRobotsPublicController.prototype, "createDataList", null);
__decorate([
    (0, common_1.Put)('data-lists/:id'),
    __param(0, (0, common_1.Param)('id', common_1.ParseIntPipe)),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Number, Object]),
    __metadata("design:returntype", Promise)
], VoiceRobotsPublicController.prototype, "updateDataList", null);
__decorate([
    (0, common_1.Delete)('data-lists/:id'),
    (0, common_1.HttpCode)(204),
    __param(0, (0, common_1.Param)('id', common_1.ParseIntPipe)),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Number]),
    __metadata("design:returntype", Promise)
], VoiceRobotsPublicController.prototype, "deleteDataList", null);
__decorate([
    (0, common_1.Post)('data-lists/:id/test-search'),
    __param(0, (0, common_1.Param)('id', common_1.ParseIntPipe)),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Number, Object]),
    __metadata("design:returntype", Promise)
], VoiceRobotsPublicController.prototype, "testDataListSearch", null);
__decorate([
    (0, common_1.Post)(':id/test-match'),
    __param(0, (0, common_1.Param)('id', common_1.ParseIntPipe)),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Number, Object]),
    __metadata("design:returntype", Promise)
], VoiceRobotsPublicController.prototype, "testMatch", null);
exports.VoiceRobotsPublicController = VoiceRobotsPublicController = __decorate([
    (0, common_1.UseGuards)(voice_robots_public_key_guard_1.VoiceRobotsPublicKeyGuard),
    (0, common_1.Controller)('public/voice-robots'),
    __metadata("design:paramtypes", [voice_robots_service_1.VoiceRobotsService,
        config_1.ConfigService])
], VoiceRobotsPublicController);
//# sourceMappingURL=voice-robots-public.controller.js.map