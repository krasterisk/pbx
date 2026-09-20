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
exports.AutodialReportsController = void 0;
const common_1 = require("@nestjs/common");
const jwt_auth_guard_1 = require("../auth/jwt-auth.guard");
const module_access_guard_1 = require("../cloud-admin/module-access.guard");
const requires_module_decorator_1 = require("../cloud-admin/requires-module.decorator");
const autodial_reports_service_1 = require("./autodial-reports.service");
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
let AutodialReportsController = class AutodialReportsController {
    reports;
    constructor(reports) {
        this.reports = reports;
    }
    monitor(req) {
        return this.reports.liveStats(req.user.vpbx_user_uid);
    }
    summary(req, from, to, campaigns) {
        return this.reports.summary(req.user.vpbx_user_uid, this.range(from, to, campaigns));
    }
    daily(req, from, to, campaigns) {
        return this.reports.daily(req.user.vpbx_user_uid, this.range(from, to, campaigns));
    }
    detail(req, from, to, campaigns) {
        return this.reports.detail(req.user.vpbx_user_uid, this.range(from, to, campaigns));
    }
    async export(req, res, from, to, kind, format, campaigns) {
        const range = this.range(from, to, campaigns);
        const fmt = format === 'xlsx' ? 'xlsx' : 'csv';
        const result = kind === 'detail'
            ? await this.reports.exportDetail(req.user.vpbx_user_uid, range, fmt)
            : await this.reports.exportSummary(req.user.vpbx_user_uid, range, fmt);
        res.setHeader('Content-Type', result.contentType);
        res.setHeader('Content-Disposition', `attachment; filename="${result.filename}"`);
        res.send(result.body);
    }
    range(from, to, campaigns) {
        if (!DATE_RE.test(from ?? '') || !DATE_RE.test(to ?? '')) {
            throw new common_1.BadRequestException({
                code: 'AC_REPORT_RANGE',
                message: 'from/to must be YYYY-MM-DD',
            });
        }
        if (from > to) {
            throw new common_1.BadRequestException({
                code: 'AC_REPORT_RANGE',
                message: 'from must not be later than to',
            });
        }
        const campaignUids = (campaigns ?? '')
            .split(',')
            .map((v) => Number(v.trim()))
            .filter((n) => Number.isInteger(n) && n > 0);
        return { from, to, campaignUids: campaignUids.length ? campaignUids : undefined };
    }
};
exports.AutodialReportsController = AutodialReportsController;
__decorate([
    (0, common_1.Get)('monitor'),
    __param(0, (0, common_1.Req)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", void 0)
], AutodialReportsController.prototype, "monitor", null);
__decorate([
    (0, common_1.Get)('reports/summary'),
    __param(0, (0, common_1.Req)()),
    __param(1, (0, common_1.Query)('from')),
    __param(2, (0, common_1.Query)('to')),
    __param(3, (0, common_1.Query)('campaigns')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String, String, String]),
    __metadata("design:returntype", void 0)
], AutodialReportsController.prototype, "summary", null);
__decorate([
    (0, common_1.Get)('reports/daily'),
    __param(0, (0, common_1.Req)()),
    __param(1, (0, common_1.Query)('from')),
    __param(2, (0, common_1.Query)('to')),
    __param(3, (0, common_1.Query)('campaigns')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String, String, String]),
    __metadata("design:returntype", void 0)
], AutodialReportsController.prototype, "daily", null);
__decorate([
    (0, common_1.Get)('reports/detail'),
    __param(0, (0, common_1.Req)()),
    __param(1, (0, common_1.Query)('from')),
    __param(2, (0, common_1.Query)('to')),
    __param(3, (0, common_1.Query)('campaigns')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String, String, String]),
    __metadata("design:returntype", void 0)
], AutodialReportsController.prototype, "detail", null);
__decorate([
    (0, common_1.Get)('reports/export'),
    __param(0, (0, common_1.Req)()),
    __param(1, (0, common_1.Res)()),
    __param(2, (0, common_1.Query)('from')),
    __param(3, (0, common_1.Query)('to')),
    __param(4, (0, common_1.Query)('kind')),
    __param(5, (0, common_1.Query)('format')),
    __param(6, (0, common_1.Query)('campaigns')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, Object, String, String, String, String, String]),
    __metadata("design:returntype", Promise)
], AutodialReportsController.prototype, "export", null);
exports.AutodialReportsController = AutodialReportsController = __decorate([
    (0, common_1.UseGuards)(jwt_auth_guard_1.JwtAuthGuard, module_access_guard_1.ModuleAccessGuard),
    (0, requires_module_decorator_1.RequiresModule)('autodial'),
    (0, common_1.Controller)('autodial'),
    __metadata("design:paramtypes", [autodial_reports_service_1.AutodialReportsService])
], AutodialReportsController);
//# sourceMappingURL=autodial-reports.controller.js.map