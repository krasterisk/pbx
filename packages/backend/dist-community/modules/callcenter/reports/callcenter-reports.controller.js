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
exports.CallCenterReportsController = void 0;
/**
 * Call Center reports REST API (D-33 / D-34 backend).
 *
 * Supervisor-gated. Tenant from JWT (`req.user.vpbx_user_uid`), never query/body.
 * PDF export is client-side (07-18) — format=pdf → 400.
 */
const common_1 = require("@nestjs/common");
const jwt_auth_guard_1 = require("../../auth/jwt-auth.guard");
const callcenter_reports_service_1 = require("./callcenter-reports.service");
const report_query_dto_1 = require("./dto/report-query.dto");
const callcenter_reports_types_1 = require("./callcenter-reports.types");
const csv_exporter_1 = require("./exporters/csv-exporter");
const xlsx_exporter_1 = require("./exporters/xlsx-exporter");
const callcenter_rbac_util_1 = require("../callcenter-rbac.util");
let CallCenterReportsController = class CallCenterReportsController {
    reportsService;
    constructor(reportsService) {
        this.reportsService = reportsService;
    }
    async getReport(req, reportId, query) {
        (0, callcenter_rbac_util_1.assertSupervisor)(req.user);
        if (!(0, callcenter_reports_types_1.isCcReportId)(reportId)) {
            throw new common_1.BadRequestException(`Unknown reportId "${reportId}"`);
        }
        return this.reportsService.runReport(reportId, req.user.vpbx_user_uid, query);
    }
    async exportReport(req, reportId, query, format, res) {
        (0, callcenter_rbac_util_1.assertSupervisor)(req.user);
        if (!(0, callcenter_reports_types_1.isCcReportId)(reportId)) {
            throw new common_1.BadRequestException(`Unknown reportId "${reportId}"`);
        }
        const fmt = (format || '').toLowerCase();
        if (fmt === 'pdf') {
            throw new common_1.BadRequestException('PDF генерируется на клиенте (07-18). Используйте format=csv или format=xlsx.');
        }
        if (fmt !== 'csv' && fmt !== 'xlsx') {
            throw new common_1.BadRequestException('format must be csv or xlsx');
        }
        const result = await this.reportsService.runReport(reportId, req.user.vpbx_user_uid, query);
        const dateStamp = new Date().toISOString().slice(0, 10);
        const baseName = `cc_${reportId}_${dateStamp}`;
        // Flatten nested segment rows for export (agent-timeline)
        const exportRows = result.rows.map((row) => {
            if (row &&
                typeof row === 'object' &&
                'segments' in row &&
                Array.isArray(row.segments)) {
                const r = row;
                return {
                    agentInterface: r.agentInterface ?? '',
                    segments: r.segments,
                };
            }
            return row;
        });
        if (fmt === 'csv') {
            const body = (0, csv_exporter_1.buildReportCsv)(result.columns, exportRows);
            res.setHeader('Content-Type', 'text/csv; charset=utf-8');
            res.setHeader('Content-Disposition', `attachment; filename="${baseName}.csv"`);
            return res.send(body);
        }
        const buffer = await (0, xlsx_exporter_1.buildReportXlsx)(reportId, result.columns, exportRows);
        res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
        res.setHeader('Content-Disposition', `attachment; filename="${baseName}.xlsx"`);
        return res.send(buffer);
    }
};
exports.CallCenterReportsController = CallCenterReportsController;
__decorate([
    (0, common_1.Get)(':reportId'),
    __param(0, (0, common_1.Req)()),
    __param(1, (0, common_1.Param)('reportId')),
    __param(2, (0, common_1.Query)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String, report_query_dto_1.ReportQueryDto]),
    __metadata("design:returntype", Promise)
], CallCenterReportsController.prototype, "getReport", null);
__decorate([
    (0, common_1.Get)(':reportId/export'),
    __param(0, (0, common_1.Req)()),
    __param(1, (0, common_1.Param)('reportId')),
    __param(2, (0, common_1.Query)()),
    __param(3, (0, common_1.Query)('format')),
    __param(4, (0, common_1.Res)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String, report_query_dto_1.ReportQueryDto, String, Object]),
    __metadata("design:returntype", Promise)
], CallCenterReportsController.prototype, "exportReport", null);
exports.CallCenterReportsController = CallCenterReportsController = __decorate([
    (0, common_1.UseGuards)(jwt_auth_guard_1.JwtAuthGuard),
    (0, common_1.Controller)('callcenter/reports'),
    __metadata("design:paramtypes", [callcenter_reports_service_1.CallCenterReportsService])
], CallCenterReportsController);
//# sourceMappingURL=callcenter-reports.controller.js.map