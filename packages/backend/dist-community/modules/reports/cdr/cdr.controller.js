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
exports.CdrController = void 0;
const common_1 = require("@nestjs/common");
const cdr_service_1 = require("./cdr.service");
const cdr_query_dto_1 = require("./dto/cdr-query.dto");
const jwt_auth_guard_1 = require("../../auth/jwt-auth.guard");
const module_access_guard_1 = require("../../cloud-admin/module-access.guard");
const requires_module_decorator_1 = require("../../cloud-admin/requires-module.decorator");
let CdrController = class CdrController {
    cdrService;
    constructor(cdrService) {
        this.cdrService = cdrService;
    }
    viewer(req) {
        return {
            tenantId: req.user.vpbx_user_uid,
            userId: req.user.sub,
        };
    }
    findAll(req, query) {
        const { tenantId, userId } = this.viewer(req);
        return this.cdrService.findCalls(tenantId, query, userId);
    }
    getStats(req, query) {
        const { tenantId, userId } = this.viewer(req);
        return this.cdrService.getStats(tenantId, query, userId);
    }
    getByHour(req, query) {
        const { tenantId, userId } = this.viewer(req);
        return this.cdrService.getByHour(tenantId, query, userId);
    }
    getByDay(req, query) {
        const { tenantId, userId } = this.viewer(req);
        return this.cdrService.getByDay(tenantId, query, userId);
    }
    getByExtension(req, query) {
        const { tenantId, userId } = this.viewer(req);
        return this.cdrService.getByExtension(tenantId, query, userId);
    }
    getByTrunk(req, query) {
        const { tenantId, userId } = this.viewer(req);
        return this.cdrService.getByTrunk(tenantId, query, userId);
    }
    getByDisposition(req, query) {
        const { tenantId, userId } = this.viewer(req);
        return this.cdrService.getByDisposition(tenantId, query, userId);
    }
    getHeatmap(req, query) {
        const { tenantId, userId } = this.viewer(req);
        return this.cdrService.getHeatmap(tenantId, query, userId);
    }
    async exportCsv(req, query, res) {
        const { tenantId, userId } = this.viewer(req);
        const rows = await this.cdrService.exportCalls(tenantId, query, userId);
        const delimiter = ';';
        const esc = (v) => `"${String(v ?? '').replace(/"/g, '""')}"`;
        const header = [
            'Дата',
            'Кто звонил',
            'Куда',
            'Линия',
            'Статус',
            'Длительность',
            'Биллинг',
            'Направление',
        ].map(esc).join(delimiter);
        const lines = rows.map((r) => [
            r.calldate,
            r.srcDisplay,
            r.dstDisplay,
            r.dialednum || '',
            r.disposition,
            r.duration,
            r.billsec,
            r.direction,
        ].map(esc).join(delimiter));
        const body = '\uFEFF' + [header, ...lines].join('\n');
        res.setHeader('Content-Type', 'text/csv; charset=utf-8');
        res.setHeader('Content-Disposition', `attachment; filename="cdr_export_${new Date().toISOString().slice(0, 10)}.csv"`);
        res.send(body);
    }
    findByUniqueid(req, uniqueid) {
        const { tenantId, userId } = this.viewer(req);
        return this.cdrService.findByUniqueid(tenantId, uniqueid, userId);
    }
    /** HTML player popup (v3 play.php); audio uses absolute …/:uniqueid/play URL. */
    playRecordingPage(uniqueid, token, res) {
        let streamSrc = this.cdrService.recordingPlayStreamPath(uniqueid, 'auth');
        if (token) {
            streamSrc += `?token=${encodeURIComponent(token)}`;
        }
        res.send(this.cdrService.renderRecordingPlayerHtml(streamSrc));
    }
    /** Stream MP3 from records_base_path (same-origin, v3 play.php behaviour). */
    playRecording(req, uniqueid, res) {
        return this.cdrService.streamRecording(req.user.vpbx_user_uid, uniqueid, res, req);
    }
    findLegs(req, linkedid) {
        const { tenantId, userId } = this.viewer(req);
        return this.cdrService.findLegs(tenantId, linkedid, userId);
    }
};
exports.CdrController = CdrController;
__decorate([
    (0, common_1.Get)(),
    __param(0, (0, common_1.Request)()),
    __param(1, (0, common_1.Query)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, cdr_query_dto_1.CdrQueryDto]),
    __metadata("design:returntype", void 0)
], CdrController.prototype, "findAll", null);
__decorate([
    (0, common_1.Get)('stats'),
    __param(0, (0, common_1.Request)()),
    __param(1, (0, common_1.Query)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, cdr_query_dto_1.CdrQueryDto]),
    __metadata("design:returntype", void 0)
], CdrController.prototype, "getStats", null);
__decorate([
    (0, common_1.Get)('charts/by-hour'),
    __param(0, (0, common_1.Request)()),
    __param(1, (0, common_1.Query)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, cdr_query_dto_1.CdrQueryDto]),
    __metadata("design:returntype", void 0)
], CdrController.prototype, "getByHour", null);
__decorate([
    (0, common_1.Get)('charts/by-day'),
    __param(0, (0, common_1.Request)()),
    __param(1, (0, common_1.Query)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, cdr_query_dto_1.CdrQueryDto]),
    __metadata("design:returntype", void 0)
], CdrController.prototype, "getByDay", null);
__decorate([
    (0, common_1.Get)('charts/by-extension'),
    __param(0, (0, common_1.Request)()),
    __param(1, (0, common_1.Query)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, cdr_query_dto_1.CdrQueryDto]),
    __metadata("design:returntype", void 0)
], CdrController.prototype, "getByExtension", null);
__decorate([
    (0, common_1.Get)('charts/by-trunk'),
    __param(0, (0, common_1.Request)()),
    __param(1, (0, common_1.Query)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, cdr_query_dto_1.CdrQueryDto]),
    __metadata("design:returntype", void 0)
], CdrController.prototype, "getByTrunk", null);
__decorate([
    (0, common_1.Get)('charts/by-disposition'),
    __param(0, (0, common_1.Request)()),
    __param(1, (0, common_1.Query)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, cdr_query_dto_1.CdrQueryDto]),
    __metadata("design:returntype", void 0)
], CdrController.prototype, "getByDisposition", null);
__decorate([
    (0, common_1.Get)('charts/heatmap'),
    __param(0, (0, common_1.Request)()),
    __param(1, (0, common_1.Query)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, cdr_query_dto_1.CdrQueryDto]),
    __metadata("design:returntype", void 0)
], CdrController.prototype, "getHeatmap", null);
__decorate([
    (0, common_1.Get)('export'),
    __param(0, (0, common_1.Request)()),
    __param(1, (0, common_1.Query)()),
    __param(2, (0, common_1.Res)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, cdr_query_dto_1.CdrQueryDto, Object]),
    __metadata("design:returntype", Promise)
], CdrController.prototype, "exportCsv", null);
__decorate([
    (0, common_1.Get)('by-uniqueid/:uniqueid'),
    __param(0, (0, common_1.Request)()),
    __param(1, (0, common_1.Param)('uniqueid')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String]),
    __metadata("design:returntype", void 0)
], CdrController.prototype, "findByUniqueid", null);
__decorate([
    (0, common_1.Get)('recording/:uniqueid'),
    (0, common_1.Header)('Content-Type', 'text/html; charset=utf-8'),
    __param(0, (0, common_1.Param)('uniqueid')),
    __param(1, (0, common_1.Query)('token')),
    __param(2, (0, common_1.Res)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, Object, Object]),
    __metadata("design:returntype", void 0)
], CdrController.prototype, "playRecordingPage", null);
__decorate([
    (0, common_1.Get)('recording/:uniqueid/play'),
    __param(0, (0, common_1.Request)()),
    __param(1, (0, common_1.Param)('uniqueid')),
    __param(2, (0, common_1.Res)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String, Object]),
    __metadata("design:returntype", void 0)
], CdrController.prototype, "playRecording", null);
__decorate([
    (0, common_1.Get)(':linkedid/legs'),
    __param(0, (0, common_1.Request)()),
    __param(1, (0, common_1.Param)('linkedid')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String]),
    __metadata("design:returntype", void 0)
], CdrController.prototype, "findLegs", null);
exports.CdrController = CdrController = __decorate([
    (0, common_1.Controller)('reports/cdr'),
    (0, common_1.UseGuards)(jwt_auth_guard_1.JwtAuthGuard, module_access_guard_1.ModuleAccessGuard),
    (0, requires_module_decorator_1.RequiresModule)('cdr'),
    __metadata("design:paramtypes", [cdr_service_1.CdrService])
], CdrController);
//# sourceMappingURL=cdr.controller.js.map