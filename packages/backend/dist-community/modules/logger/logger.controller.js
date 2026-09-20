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
exports.LoggerController = void 0;
const common_1 = require("@nestjs/common");
const logger_service_1 = require("./logger.service");
const jwt_auth_guard_1 = require("../auth/jwt-auth.guard");
const roles_guard_1 = require("../auth/roles.guard");
const roles_decorator_1 = require("../auth/roles.decorator");
const user_model_1 = require("../users/user.model");
let LoggerController = class LoggerController {
    loggerService;
    constructor(loggerService) {
        this.loggerService = loggerService;
    }
    /**
     * GET /api/audit-log
     * Tenant-scoped action log with filters and pagination.
     * Query: page, limit, action, entity_type, status, dateFrom, dateTo
     */
    async getLogs(req, page, limit, action, entity_type, status, dateFrom, dateTo) {
        return this.loggerService.getLogs(req.user.vpbx_user_uid, {
            page: page ? Number(page) : 1,
            limit: limit ? Math.min(Number(limit), 200) : 50,
            action: action || undefined,
            entity_type: entity_type || undefined,
            status: status || undefined,
            dateFrom: dateFrom || undefined,
            dateTo: dateTo || undefined,
        });
    }
    /**
     * GET /api/audit-log/stats
     * Returns KPI: total, today, errors — for the current tenant.
     */
    async getStats(req) {
        return this.loggerService.getStats(req.user.vpbx_user_uid);
    }
};
exports.LoggerController = LoggerController;
__decorate([
    (0, common_1.Get)(),
    __param(0, (0, common_1.Req)()),
    __param(1, (0, common_1.Query)('page')),
    __param(2, (0, common_1.Query)('limit')),
    __param(3, (0, common_1.Query)('action')),
    __param(4, (0, common_1.Query)('entity_type')),
    __param(5, (0, common_1.Query)('status')),
    __param(6, (0, common_1.Query)('dateFrom')),
    __param(7, (0, common_1.Query)('dateTo')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String, String, String, String, String, String, String]),
    __metadata("design:returntype", Promise)
], LoggerController.prototype, "getLogs", null);
__decorate([
    (0, common_1.Get)('stats'),
    __param(0, (0, common_1.Req)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", Promise)
], LoggerController.prototype, "getStats", null);
exports.LoggerController = LoggerController = __decorate([
    (0, common_1.Controller)('audit-log'),
    (0, common_1.UseGuards)(jwt_auth_guard_1.JwtAuthGuard, roles_guard_1.RolesGuard),
    (0, roles_decorator_1.Roles)(user_model_1.UserLevel.ADMIN),
    __metadata("design:paramtypes", [logger_service_1.LoggerService])
], LoggerController);
//# sourceMappingURL=logger.controller.js.map