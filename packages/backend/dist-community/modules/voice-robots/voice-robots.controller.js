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
exports.VoiceRobotsController = void 0;
const common_1 = require("@nestjs/common");
const voice_robots_service_1 = require("./voice-robots.service");
const jwt_auth_guard_1 = require("../auth/jwt-auth.guard");
const module_access_guard_1 = require("../cloud-admin/module-access.guard");
const requires_module_decorator_1 = require("../cloud-admin/requires-module.decorator");
const action_params_validation_util_1 = require("../../shared/pipes/action-params-validation.util");
/**
 * Voice Robots CRUD Controller.
 *
 * Endpoints:
 *   GET    /voice-robots                           — List all robots (tenant-scoped)
 *   POST   /voice-robots                           — Create robot
 *   PUT    /voice-robots/:uid                      — Update robot
 *   DELETE /voice-robots/:uid                      — Delete robot
 *   GET    /voice-robots/:id/keyword-groups        — Get groups for a robot
 *   POST   /voice-robots/:id/keyword-groups        — Create keyword group
 *   PUT    /voice-robots/keyword-groups/:id        — Update keyword group
 *   DELETE /voice-robots/keyword-groups/:id        — Delete keyword group
 *   GET    /voice-robots/keyword-groups/:id/keywords — Get keywords for group
 *   POST   /voice-robots/keyword-groups/:id/keywords — Create keyword
 *   PUT    /voice-robots/keywords/:uid             — Update keyword
 *   DELETE /voice-robots/keywords/:uid             — Delete keyword
 *   GET    /voice-robots/:id/logs                  — Get logs for a robot
 *   GET    /voice-robots/:id/data-lists            — Get data lists for a robot
 *   POST   /voice-robots/:id/data-lists            — Create data list
 *   PUT    /voice-robots/data-lists/:id            — Update data list
 *   DELETE /voice-robots/data-lists/:id            — Delete data list
 *   POST   /voice-robots/data-lists/:id/test-search — Test search against a data list
 */
let VoiceRobotsController = class VoiceRobotsController {
    voiceRobotsService;
    constructor(voiceRobotsService) {
        this.voiceRobotsService = voiceRobotsService;
    }
    // ─── Robot CRUD ────────────────────────────────────────
    async findAll(req) {
        return this.voiceRobotsService.findAll(req.user.vpbx_user_uid);
    }
    // ─── CDR (Call Detail Records) ────────────────────────
    // IMPORTANT: CDR routes MUST be declared before :uid to avoid param collision
    /** GET /voice-robots/cdr — список CDR с пагинацией и фильтрами */
    async findAllCdr(req, limit, offset, robotId, disposition, callerId, dateFrom, dateTo, search, tag) {
        return this.voiceRobotsService.findAllCdr(req.user.vpbx_user_uid, {
            limit: limit ? parseInt(limit, 10) : undefined,
            offset: offset ? parseInt(offset, 10) : undefined,
            robotId: robotId ? parseInt(robotId, 10) : undefined,
            disposition,
            callerId,
            dateFrom,
            dateTo,
            search,
            tag,
        });
    }
    /** GET /voice-robots/cdr/stats — статистика CDR */
    async getCdrStats(req, robotId) {
        return this.voiceRobotsService.getCdrStats(req.user.vpbx_user_uid, robotId ? parseInt(robotId, 10) : undefined);
    }
    /** GET /voice-robots/cdr/tags — unique tags for filter dropdown */
    async getCdrTags(req) {
        return this.voiceRobotsService.getDistinctTags(req.user.vpbx_user_uid);
    }
    /** GET /voice-robots/cdr/export — all matching CDR records for CSV export (no pagination) */
    async exportCdr(req, disposition, dateFrom, dateTo, search, tag) {
        return this.voiceRobotsService.findAllCdr(req.user.vpbx_user_uid, {
            limit: 10000, // safety cap
            offset: 0,
            disposition,
            dateFrom,
            dateTo,
            search,
            tag,
        });
    }
    /** GET /voice-robots/cdr/:id — одна CDR запись */
    async findOneCdr(req, id) {
        return this.voiceRobotsService.findOneCdr(req.user.vpbx_user_uid, id);
    }
    /** GET /voice-robots/cdr/:id/detail — CDR + пошаговые логи */
    async getCdrDetail(req, id) {
        return this.voiceRobotsService.getCdrWithLogs(req.user.vpbx_user_uid, id);
    }
    // ─── Robot by ID ───────────────────────────────────────
    async findOne(req, uid) {
        return this.voiceRobotsService.findOne(req.user.vpbx_user_uid, uid);
    }
    async create(req, body) {
        (0, action_params_validation_util_1.throwIfInvalidActionPayload)(body);
        return this.voiceRobotsService.createRobot(req.user.vpbx_user_uid, body);
    }
    async update(req, uid, body) {
        (0, action_params_validation_util_1.throwIfInvalidActionPayload)(body);
        return this.voiceRobotsService.updateRobot(req.user.vpbx_user_uid, uid, body);
    }
    async delete(req, uid) {
        await this.voiceRobotsService.deleteRobot(req.user.vpbx_user_uid, uid);
    }
    // ─── Keyword Groups CRUD ──────────────────────────────
    async getKeywordGroups(req, robotId) {
        return this.voiceRobotsService.getKeywordGroups(req.user.vpbx_user_uid, robotId);
    }
    async createKeywordGroup(req, robotId, body) {
        return this.voiceRobotsService.createKeywordGroup(req.user.vpbx_user_uid, robotId, body);
    }
    async updateKeywordGroup(req, id, body) {
        return this.voiceRobotsService.updateKeywordGroup(req.user.vpbx_user_uid, id, body);
    }
    async deleteKeywordGroup(req, id) {
        await this.voiceRobotsService.deleteKeywordGroup(req.user.vpbx_user_uid, id);
    }
    // ─── Keywords CRUD ────────────────────────────────────
    async getKeywords(req, groupId) {
        return this.voiceRobotsService.getKeywords(req.user.vpbx_user_uid, groupId);
    }
    async createKeyword(req, groupId, body) {
        (0, action_params_validation_util_1.throwIfInvalidActionPayload)(body);
        return this.voiceRobotsService.createKeyword(req.user.vpbx_user_uid, groupId, body);
    }
    async updateKeyword(req, uid, body) {
        (0, action_params_validation_util_1.throwIfInvalidActionPayload)(body);
        return this.voiceRobotsService.updateKeyword(req.user.vpbx_user_uid, uid, body);
    }
    async deleteKeyword(req, uid) {
        await this.voiceRobotsService.deleteKeyword(req.user.vpbx_user_uid, uid);
    }
    // ─── Logs ─────────────────────────────────────────────
    async getLogs(req, robotId) {
        return this.voiceRobotsService.getLogs(req.user.vpbx_user_uid, robotId);
    }
    // ─── Data Lists CRUD ──────────────────────────────────
    async getDataLists(req, robotId) {
        return this.voiceRobotsService.getDataLists(req.user.vpbx_user_uid, robotId);
    }
    async createDataList(req, robotId, body) {
        return this.voiceRobotsService.createDataList(req.user.vpbx_user_uid, robotId, body);
    }
    async updateDataList(req, id, body) {
        return this.voiceRobotsService.updateDataList(req.user.vpbx_user_uid, id, body);
    }
    async deleteDataList(req, id) {
        await this.voiceRobotsService.deleteDataList(req.user.vpbx_user_uid, id);
    }
    /** POST /voice-robots/data-lists/:id/test-search */
    async testDataListSearch(req, listId, body) {
        return this.voiceRobotsService.testDataListSearch(req.user.vpbx_user_uid, listId, body.query, body.returnField);
    }
    // ─── Test Match (debugging) ────────────────────────────
    /**
     * POST /voice-robots/:id/test-match
     *
     * Test keyword matching against a robot's keywords without making a real call.
     * Useful for debugging and testing from the UI.
     *
     * Body: { text: string }
     * Returns: { match: MatchResult | null, allKeywords: number, elapsed_ms: number }
     */
    async testMatch(req, robotId, body) {
        return this.voiceRobotsService.testMatch(req.user.vpbx_user_uid, robotId, body.text);
    }
};
exports.VoiceRobotsController = VoiceRobotsController;
__decorate([
    (0, common_1.Get)(),
    __param(0, (0, common_1.Request)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", Promise)
], VoiceRobotsController.prototype, "findAll", null);
__decorate([
    (0, common_1.Get)('cdr'),
    __param(0, (0, common_1.Request)()),
    __param(1, (0, common_1.Query)('limit')),
    __param(2, (0, common_1.Query)('offset')),
    __param(3, (0, common_1.Query)('robotId')),
    __param(4, (0, common_1.Query)('disposition')),
    __param(5, (0, common_1.Query)('callerId')),
    __param(6, (0, common_1.Query)('dateFrom')),
    __param(7, (0, common_1.Query)('dateTo')),
    __param(8, (0, common_1.Query)('search')),
    __param(9, (0, common_1.Query)('tag')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String, String, String, String, String, String, String, String, String]),
    __metadata("design:returntype", Promise)
], VoiceRobotsController.prototype, "findAllCdr", null);
__decorate([
    (0, common_1.Get)('cdr/stats'),
    __param(0, (0, common_1.Request)()),
    __param(1, (0, common_1.Query)('robotId')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String]),
    __metadata("design:returntype", Promise)
], VoiceRobotsController.prototype, "getCdrStats", null);
__decorate([
    (0, common_1.Get)('cdr/tags'),
    __param(0, (0, common_1.Request)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", Promise)
], VoiceRobotsController.prototype, "getCdrTags", null);
__decorate([
    (0, common_1.Get)('cdr/export'),
    __param(0, (0, common_1.Request)()),
    __param(1, (0, common_1.Query)('disposition')),
    __param(2, (0, common_1.Query)('dateFrom')),
    __param(3, (0, common_1.Query)('dateTo')),
    __param(4, (0, common_1.Query)('search')),
    __param(5, (0, common_1.Query)('tag')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String, String, String, String, String]),
    __metadata("design:returntype", Promise)
], VoiceRobotsController.prototype, "exportCdr", null);
__decorate([
    (0, common_1.Get)('cdr/:id'),
    __param(0, (0, common_1.Request)()),
    __param(1, (0, common_1.Param)('id', common_1.ParseIntPipe)),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, Number]),
    __metadata("design:returntype", Promise)
], VoiceRobotsController.prototype, "findOneCdr", null);
__decorate([
    (0, common_1.Get)('cdr/:id/detail'),
    __param(0, (0, common_1.Request)()),
    __param(1, (0, common_1.Param)('id', common_1.ParseIntPipe)),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, Number]),
    __metadata("design:returntype", Promise)
], VoiceRobotsController.prototype, "getCdrDetail", null);
__decorate([
    (0, common_1.Get)(':uid'),
    __param(0, (0, common_1.Request)()),
    __param(1, (0, common_1.Param)('uid', common_1.ParseIntPipe)),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, Number]),
    __metadata("design:returntype", Promise)
], VoiceRobotsController.prototype, "findOne", null);
__decorate([
    (0, common_1.Post)(),
    __param(0, (0, common_1.Request)()),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, Object]),
    __metadata("design:returntype", Promise)
], VoiceRobotsController.prototype, "create", null);
__decorate([
    (0, common_1.Put)(':uid'),
    __param(0, (0, common_1.Request)()),
    __param(1, (0, common_1.Param)('uid', common_1.ParseIntPipe)),
    __param(2, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, Number, Object]),
    __metadata("design:returntype", Promise)
], VoiceRobotsController.prototype, "update", null);
__decorate([
    (0, common_1.Delete)(':uid'),
    (0, common_1.HttpCode)(204),
    __param(0, (0, common_1.Request)()),
    __param(1, (0, common_1.Param)('uid', common_1.ParseIntPipe)),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, Number]),
    __metadata("design:returntype", Promise)
], VoiceRobotsController.prototype, "delete", null);
__decorate([
    (0, common_1.Get)(':id/keyword-groups'),
    __param(0, (0, common_1.Request)()),
    __param(1, (0, common_1.Param)('id', common_1.ParseIntPipe)),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, Number]),
    __metadata("design:returntype", Promise)
], VoiceRobotsController.prototype, "getKeywordGroups", null);
__decorate([
    (0, common_1.Post)(':id/keyword-groups'),
    __param(0, (0, common_1.Request)()),
    __param(1, (0, common_1.Param)('id', common_1.ParseIntPipe)),
    __param(2, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, Number, Object]),
    __metadata("design:returntype", Promise)
], VoiceRobotsController.prototype, "createKeywordGroup", null);
__decorate([
    (0, common_1.Put)('keyword-groups/:id'),
    __param(0, (0, common_1.Request)()),
    __param(1, (0, common_1.Param)('id', common_1.ParseIntPipe)),
    __param(2, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, Number, Object]),
    __metadata("design:returntype", Promise)
], VoiceRobotsController.prototype, "updateKeywordGroup", null);
__decorate([
    (0, common_1.Delete)('keyword-groups/:id'),
    (0, common_1.HttpCode)(204),
    __param(0, (0, common_1.Request)()),
    __param(1, (0, common_1.Param)('id', common_1.ParseIntPipe)),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, Number]),
    __metadata("design:returntype", Promise)
], VoiceRobotsController.prototype, "deleteKeywordGroup", null);
__decorate([
    (0, common_1.Get)('keyword-groups/:id/keywords'),
    __param(0, (0, common_1.Request)()),
    __param(1, (0, common_1.Param)('id', common_1.ParseIntPipe)),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, Number]),
    __metadata("design:returntype", Promise)
], VoiceRobotsController.prototype, "getKeywords", null);
__decorate([
    (0, common_1.Post)('keyword-groups/:id/keywords'),
    __param(0, (0, common_1.Request)()),
    __param(1, (0, common_1.Param)('id', common_1.ParseIntPipe)),
    __param(2, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, Number, Object]),
    __metadata("design:returntype", Promise)
], VoiceRobotsController.prototype, "createKeyword", null);
__decorate([
    (0, common_1.Put)('keywords/:uid'),
    __param(0, (0, common_1.Request)()),
    __param(1, (0, common_1.Param)('uid', common_1.ParseIntPipe)),
    __param(2, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, Number, Object]),
    __metadata("design:returntype", Promise)
], VoiceRobotsController.prototype, "updateKeyword", null);
__decorate([
    (0, common_1.Delete)('keywords/:uid'),
    (0, common_1.HttpCode)(204),
    __param(0, (0, common_1.Request)()),
    __param(1, (0, common_1.Param)('uid', common_1.ParseIntPipe)),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, Number]),
    __metadata("design:returntype", Promise)
], VoiceRobotsController.prototype, "deleteKeyword", null);
__decorate([
    (0, common_1.Get)(':id/logs'),
    __param(0, (0, common_1.Request)()),
    __param(1, (0, common_1.Param)('id', common_1.ParseIntPipe)),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, Number]),
    __metadata("design:returntype", Promise)
], VoiceRobotsController.prototype, "getLogs", null);
__decorate([
    (0, common_1.Get)(':id/data-lists'),
    __param(0, (0, common_1.Request)()),
    __param(1, (0, common_1.Param)('id', common_1.ParseIntPipe)),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, Number]),
    __metadata("design:returntype", Promise)
], VoiceRobotsController.prototype, "getDataLists", null);
__decorate([
    (0, common_1.Post)(':id/data-lists'),
    __param(0, (0, common_1.Request)()),
    __param(1, (0, common_1.Param)('id', common_1.ParseIntPipe)),
    __param(2, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, Number, Object]),
    __metadata("design:returntype", Promise)
], VoiceRobotsController.prototype, "createDataList", null);
__decorate([
    (0, common_1.Put)('data-lists/:id'),
    __param(0, (0, common_1.Request)()),
    __param(1, (0, common_1.Param)('id', common_1.ParseIntPipe)),
    __param(2, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, Number, Object]),
    __metadata("design:returntype", Promise)
], VoiceRobotsController.prototype, "updateDataList", null);
__decorate([
    (0, common_1.Delete)('data-lists/:id'),
    (0, common_1.HttpCode)(204),
    __param(0, (0, common_1.Request)()),
    __param(1, (0, common_1.Param)('id', common_1.ParseIntPipe)),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, Number]),
    __metadata("design:returntype", Promise)
], VoiceRobotsController.prototype, "deleteDataList", null);
__decorate([
    (0, common_1.Post)('data-lists/:id/test-search'),
    __param(0, (0, common_1.Request)()),
    __param(1, (0, common_1.Param)('id', common_1.ParseIntPipe)),
    __param(2, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, Number, Object]),
    __metadata("design:returntype", Promise)
], VoiceRobotsController.prototype, "testDataListSearch", null);
__decorate([
    (0, common_1.Post)(':id/test-match'),
    __param(0, (0, common_1.Request)()),
    __param(1, (0, common_1.Param)('id', common_1.ParseIntPipe)),
    __param(2, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, Number, Object]),
    __metadata("design:returntype", Promise)
], VoiceRobotsController.prototype, "testMatch", null);
exports.VoiceRobotsController = VoiceRobotsController = __decorate([
    (0, common_1.Controller)('voice-robots'),
    (0, common_1.UseGuards)(jwt_auth_guard_1.JwtAuthGuard, module_access_guard_1.ModuleAccessGuard),
    (0, requires_module_decorator_1.RequiresModule)('voice_robot'),
    __metadata("design:paramtypes", [voice_robots_service_1.VoiceRobotsService])
], VoiceRobotsController);
//# sourceMappingURL=voice-robots.controller.js.map