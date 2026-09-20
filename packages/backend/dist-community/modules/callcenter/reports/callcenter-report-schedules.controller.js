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
exports.CallCenterReportSchedulesController = void 0;
/**
 * Call Center report schedules REST API (D-35).
 * Supervisor-gated (D-38). Tenant from JWT only.
 */
const common_1 = require("@nestjs/common");
const jwt_auth_guard_1 = require("../../auth/jwt-auth.guard");
const callcenter_report_schedules_service_1 = require("./callcenter-report-schedules.service");
const callcenter_report_delivery_service_1 = require("./callcenter-report-delivery.service");
const report_schedule_dto_1 = require("./dto/report-schedule.dto");
const callcenter_rbac_util_1 = require("../callcenter-rbac.util");
let CallCenterReportSchedulesController = class CallCenterReportSchedulesController {
    schedulesService;
    deliveryService;
    constructor(schedulesService, deliveryService) {
        this.schedulesService = schedulesService;
        this.deliveryService = deliveryService;
    }
    findAll(req) {
        (0, callcenter_rbac_util_1.assertSupervisor)(req.user);
        return this.schedulesService.findAll(req.user.vpbx_user_uid);
    }
    findOne(uid, req) {
        (0, callcenter_rbac_util_1.assertSupervisor)(req.user);
        return this.schedulesService.findOne(uid, req.user.vpbx_user_uid);
    }
    create(dto, req) {
        (0, callcenter_rbac_util_1.assertSupervisor)(req.user);
        return this.schedulesService.create(dto, req.user.vpbx_user_uid);
    }
    update(uid, dto, req) {
        (0, callcenter_rbac_util_1.assertSupervisor)(req.user);
        return this.schedulesService.update(uid, dto, req.user.vpbx_user_uid);
    }
    remove(uid, req) {
        (0, callcenter_rbac_util_1.assertSupervisor)(req.user);
        return this.schedulesService.remove(uid, req.user.vpbx_user_uid);
    }
    runNow(uid, req) {
        (0, callcenter_rbac_util_1.assertSupervisor)(req.user);
        return this.schedulesService.runNow(uid, req.user.vpbx_user_uid, this.deliveryService);
    }
};
exports.CallCenterReportSchedulesController = CallCenterReportSchedulesController;
__decorate([
    (0, common_1.Get)(),
    __param(0, (0, common_1.Req)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", void 0)
], CallCenterReportSchedulesController.prototype, "findAll", null);
__decorate([
    (0, common_1.Get)(':uid'),
    __param(0, (0, common_1.Param)('uid', common_1.ParseIntPipe)),
    __param(1, (0, common_1.Req)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Number, Object]),
    __metadata("design:returntype", void 0)
], CallCenterReportSchedulesController.prototype, "findOne", null);
__decorate([
    (0, common_1.Post)(),
    __param(0, (0, common_1.Body)()),
    __param(1, (0, common_1.Req)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [report_schedule_dto_1.CreateReportScheduleDto, Object]),
    __metadata("design:returntype", void 0)
], CallCenterReportSchedulesController.prototype, "create", null);
__decorate([
    (0, common_1.Put)(':uid'),
    __param(0, (0, common_1.Param)('uid', common_1.ParseIntPipe)),
    __param(1, (0, common_1.Body)()),
    __param(2, (0, common_1.Req)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Number, report_schedule_dto_1.UpdateReportScheduleDto, Object]),
    __metadata("design:returntype", void 0)
], CallCenterReportSchedulesController.prototype, "update", null);
__decorate([
    (0, common_1.Delete)(':uid'),
    __param(0, (0, common_1.Param)('uid', common_1.ParseIntPipe)),
    __param(1, (0, common_1.Req)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Number, Object]),
    __metadata("design:returntype", void 0)
], CallCenterReportSchedulesController.prototype, "remove", null);
__decorate([
    (0, common_1.Post)(':uid/run-now'),
    __param(0, (0, common_1.Param)('uid', common_1.ParseIntPipe)),
    __param(1, (0, common_1.Req)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Number, Object]),
    __metadata("design:returntype", void 0)
], CallCenterReportSchedulesController.prototype, "runNow", null);
exports.CallCenterReportSchedulesController = CallCenterReportSchedulesController = __decorate([
    (0, common_1.UseGuards)(jwt_auth_guard_1.JwtAuthGuard),
    (0, common_1.Controller)('callcenter/report-schedules'),
    __metadata("design:paramtypes", [callcenter_report_schedules_service_1.CallCenterReportSchedulesService,
        callcenter_report_delivery_service_1.CallCenterReportDeliveryService])
], CallCenterReportSchedulesController);
//# sourceMappingURL=callcenter-report-schedules.controller.js.map