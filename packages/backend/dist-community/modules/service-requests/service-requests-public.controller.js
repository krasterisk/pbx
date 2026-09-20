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
exports.ServiceRequestsPublicController = void 0;
const common_1 = require("@nestjs/common");
const config_1 = require("@nestjs/config");
const sequelize_1 = require("@nestjs/sequelize");
const service_requests_service_1 = require("./service-requests.service");
const cc_subject_model_1 = require("./cc-subject.model");
const cc_district_model_1 = require("./cc-district.model");
/**
 * Public (no-auth) Service Requests controller for standalone v3 integration.
 * Uses a fixed tenant ID from env: DEFAULT_VPBX_USER_UID.
 *
 * All endpoints mirror the JWT-protected ServiceRequestsController,
 * but without @UseGuards(JwtAuthGuard) and with a fixed user_uid.
 */
let ServiceRequestsPublicController = class ServiceRequestsPublicController {
    service;
    configService;
    ccSubjectModel;
    ccDistrictModel;
    userUid;
    constructor(service, configService, ccSubjectModel, ccDistrictModel) {
        this.service = service;
        this.configService = configService;
        this.ccSubjectModel = ccSubjectModel;
        this.ccDistrictModel = ccDistrictModel;
        this.userUid = Number(this.configService.get('DEFAULT_VPBX_USER_UID', '1'));
    }
    async getSubjects() {
        return this.ccSubjectModel.findAll({ where: { is_active: true }, order: [['sort_order', 'ASC']] });
    }
    async getDistricts() {
        return this.ccDistrictModel.findAll({ where: { is_active: true }, order: [['sort_order', 'ASC']] });
    }
    async findAll(limit, offset, status, district, topic, search, territorial_zone, dateFrom, dateTo) {
        return this.service.findAll(this.userUid, {
            limit: limit ? parseInt(limit, 10) : undefined,
            offset: offset ? parseInt(offset, 10) : undefined,
            status, district, topic, search,
            territorial_zone,
            dateFrom,
            dateTo,
        });
    }
    async getStats() {
        return this.service.getStatusStats(this.userUid);
    }
    async findOne(id) {
        return this.service.findOne(this.userUid, parseInt(id, 10));
    }
    async create(body) {
        return this.service.create(this.userUid, body);
    }
    async update(id, body) {
        return this.service.update(this.userUid, parseInt(id, 10), body);
    }
    async remove(id) {
        return this.service.remove(this.userUid, parseInt(id, 10));
    }
};
exports.ServiceRequestsPublicController = ServiceRequestsPublicController;
__decorate([
    (0, common_1.Get)('dictionaries/subjects'),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", Promise)
], ServiceRequestsPublicController.prototype, "getSubjects", null);
__decorate([
    (0, common_1.Get)('dictionaries/districts'),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", Promise)
], ServiceRequestsPublicController.prototype, "getDistricts", null);
__decorate([
    (0, common_1.Get)(),
    __param(0, (0, common_1.Query)('limit')),
    __param(1, (0, common_1.Query)('offset')),
    __param(2, (0, common_1.Query)('status')),
    __param(3, (0, common_1.Query)('district')),
    __param(4, (0, common_1.Query)('topic')),
    __param(5, (0, common_1.Query)('search')),
    __param(6, (0, common_1.Query)('territorial_zone')),
    __param(7, (0, common_1.Query)('dateFrom')),
    __param(8, (0, common_1.Query)('dateTo')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, String, Object, Object, Object, String, Object, String, String]),
    __metadata("design:returntype", Promise)
], ServiceRequestsPublicController.prototype, "findAll", null);
__decorate([
    (0, common_1.Get)('stats'),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", Promise)
], ServiceRequestsPublicController.prototype, "getStats", null);
__decorate([
    (0, common_1.Get)(':id'),
    __param(0, (0, common_1.Param)('id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", Promise)
], ServiceRequestsPublicController.prototype, "findOne", null);
__decorate([
    (0, common_1.Post)(),
    __param(0, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", Promise)
], ServiceRequestsPublicController.prototype, "create", null);
__decorate([
    (0, common_1.Put)(':id'),
    __param(0, (0, common_1.Param)('id')),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, Object]),
    __metadata("design:returntype", Promise)
], ServiceRequestsPublicController.prototype, "update", null);
__decorate([
    (0, common_1.Delete)(':id'),
    __param(0, (0, common_1.Param)('id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", Promise)
], ServiceRequestsPublicController.prototype, "remove", null);
exports.ServiceRequestsPublicController = ServiceRequestsPublicController = __decorate([
    (0, common_1.Controller)('public/service-requests'),
    __param(2, (0, sequelize_1.InjectModel)(cc_subject_model_1.CcSubject)),
    __param(3, (0, sequelize_1.InjectModel)(cc_district_model_1.CcDistrict)),
    __metadata("design:paramtypes", [service_requests_service_1.ServiceRequestsService,
        config_1.ConfigService, Object, Object])
], ServiceRequestsPublicController);
//# sourceMappingURL=service-requests-public.controller.js.map