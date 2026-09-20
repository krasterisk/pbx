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
exports.ServiceRequestsController = void 0;
const common_1 = require("@nestjs/common");
const service_requests_service_1 = require("./service-requests.service");
const jwt_auth_guard_1 = require("../auth/jwt-auth.guard");
const module_access_guard_1 = require("../cloud-admin/module-access.guard");
const requires_module_decorator_1 = require("../cloud-admin/requires-module.decorator");
const sequelize_1 = require("@nestjs/sequelize");
const cc_subject_model_1 = require("./cc-subject.model");
const cc_district_model_1 = require("./cc-district.model");
/**
 * ServiceRequestsController — REST API для обращений клиентов.
 *
 * Все эндпоинты защищены JWT и фильтруются по tenant (user_uid из токена).
 */
let ServiceRequestsController = class ServiceRequestsController {
    service;
    ccSubjectModel;
    ccDistrictModel;
    constructor(service, ccSubjectModel, ccDistrictModel) {
        this.service = service;
        this.ccSubjectModel = ccSubjectModel;
        this.ccDistrictModel = ccDistrictModel;
    }
    // ─── Справочники ───────────────────────────────────────────
    /** GET /service-requests/dictionaries/subjects — темы обращений */
    async getSubjects() {
        return this.ccSubjectModel.findAll({
            where: { is_active: true },
            order: [['sort_order', 'ASC']],
        });
    }
    /** GET /service-requests/dictionaries/districts — территориальные зоны и районы */
    async getDistricts() {
        return this.ccDistrictModel.findAll({
            where: { is_active: true },
            order: [['sort_order', 'ASC']],
        });
    }
    // ─── CRUD заявок ───────────────────────────────────────────
    /** GET /service-requests — список обращений (с фильтрами и пагинацией) */
    async findAll(req, limit, offset, status, district, topic, search, territorial_zone, dateFrom, dateTo) {
        return this.service.findAll(req.user.vpbx_user_uid, {
            limit: limit ? parseInt(limit, 10) : undefined,
            offset: offset ? parseInt(offset, 10) : undefined,
            status,
            district,
            topic,
            search,
            territorial_zone,
            dateFrom,
            dateTo,
        });
    }
    /** GET /service-requests/stats — статистика по статусам */
    async getStats(req) {
        return this.service.getStatusStats(req.user.vpbx_user_uid);
    }
    /** GET /service-requests/:id — одно обращение */
    async findOne(req, id) {
        return this.service.findOne(req.user.vpbx_user_uid, parseInt(id, 10));
    }
    /** POST /service-requests — создать обращение */
    async create(req, body) {
        // Автоматически заполняем оператора из JWT
        body.operator_id = req.user.uid || req.user.id;
        body.operator_name = req.user.name || req.user.username || '';
        return this.service.create(req.user.vpbx_user_uid, body);
    }
    /** PUT /service-requests/:id — обновить обращение */
    async update(req, id, body) {
        return this.service.update(req.user.vpbx_user_uid, parseInt(id, 10), body);
    }
    /** DELETE /service-requests/:id — удалить обращение */
    async remove(req, id) {
        return this.service.remove(req.user.vpbx_user_uid, parseInt(id, 10));
    }
};
exports.ServiceRequestsController = ServiceRequestsController;
__decorate([
    (0, common_1.Get)('dictionaries/subjects'),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", Promise)
], ServiceRequestsController.prototype, "getSubjects", null);
__decorate([
    (0, common_1.Get)('dictionaries/districts'),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", Promise)
], ServiceRequestsController.prototype, "getDistricts", null);
__decorate([
    (0, common_1.Get)(),
    __param(0, (0, common_1.Request)()),
    __param(1, (0, common_1.Query)('limit')),
    __param(2, (0, common_1.Query)('offset')),
    __param(3, (0, common_1.Query)('status')),
    __param(4, (0, common_1.Query)('district')),
    __param(5, (0, common_1.Query)('topic')),
    __param(6, (0, common_1.Query)('search')),
    __param(7, (0, common_1.Query)('territorial_zone')),
    __param(8, (0, common_1.Query)('dateFrom')),
    __param(9, (0, common_1.Query)('dateTo')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String, String, Object, Object, Object, String, Object, String, String]),
    __metadata("design:returntype", Promise)
], ServiceRequestsController.prototype, "findAll", null);
__decorate([
    (0, common_1.Get)('stats'),
    __param(0, (0, common_1.Request)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", Promise)
], ServiceRequestsController.prototype, "getStats", null);
__decorate([
    (0, common_1.Get)(':id'),
    __param(0, (0, common_1.Request)()),
    __param(1, (0, common_1.Param)('id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String]),
    __metadata("design:returntype", Promise)
], ServiceRequestsController.prototype, "findOne", null);
__decorate([
    (0, common_1.Post)(),
    __param(0, (0, common_1.Request)()),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, Object]),
    __metadata("design:returntype", Promise)
], ServiceRequestsController.prototype, "create", null);
__decorate([
    (0, common_1.Put)(':id'),
    __param(0, (0, common_1.Request)()),
    __param(1, (0, common_1.Param)('id')),
    __param(2, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String, Object]),
    __metadata("design:returntype", Promise)
], ServiceRequestsController.prototype, "update", null);
__decorate([
    (0, common_1.Delete)(':id'),
    __param(0, (0, common_1.Request)()),
    __param(1, (0, common_1.Param)('id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String]),
    __metadata("design:returntype", Promise)
], ServiceRequestsController.prototype, "remove", null);
exports.ServiceRequestsController = ServiceRequestsController = __decorate([
    (0, common_1.Controller)('service-requests'),
    (0, common_1.UseGuards)(jwt_auth_guard_1.JwtAuthGuard, module_access_guard_1.ModuleAccessGuard),
    (0, requires_module_decorator_1.RequiresModule)('service_requests'),
    __param(1, (0, sequelize_1.InjectModel)(cc_subject_model_1.CcSubject)),
    __param(2, (0, sequelize_1.InjectModel)(cc_district_model_1.CcDistrict)),
    __metadata("design:paramtypes", [service_requests_service_1.ServiceRequestsService, Object, Object])
], ServiceRequestsController);
//# sourceMappingURL=service-requests.controller.js.map