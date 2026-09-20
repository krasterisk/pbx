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
exports.KomandorClaimsController = void 0;
const common_1 = require("@nestjs/common");
const komandor_claims_service_1 = require("./komandor-claims.service");
const jwt_auth_guard_1 = require("../auth/jwt-auth.guard");
const module_access_guard_1 = require("../cloud-admin/module-access.guard");
const requires_module_decorator_1 = require("../cloud-admin/requires-module.decorator");
let KomandorClaimsController = class KomandorClaimsController {
    service;
    constructor(service) {
        this.service = service;
    }
    async getStores(req, q) {
        return this.service.listStores(req.user.vpbx_user_uid, q);
    }
    async getDict(kind) {
        return this.service.listDict(kind);
    }
    async findAll(req, limit, offset, status, topic, store, search, dateFrom, dateTo) {
        return this.service.findAll(req.user.vpbx_user_uid, {
            limit: limit ? parseInt(limit, 10) : undefined,
            offset: offset ? parseInt(offset, 10) : undefined,
            status, topic, store, search, dateFrom, dateTo,
        });
    }
    async getStats(req) {
        return this.service.getStatusStats(req.user.vpbx_user_uid);
    }
    async findOne(req, id) {
        return this.service.findOne(req.user.vpbx_user_uid, parseInt(id, 10));
    }
    async create(req, body) {
        body.operator_id = req.user.uid || req.user.id;
        body.operator_name = req.user.name || req.user.username || '';
        return this.service.create(req.user.vpbx_user_uid, body);
    }
    async update(req, id, body) {
        body.operator_name = body.operator_name || req.user.name || req.user.username || '';
        return this.service.update(req.user.vpbx_user_uid, parseInt(id, 10), body);
    }
    async remove(req, id) {
        return this.service.remove(req.user.vpbx_user_uid, parseInt(id, 10));
    }
};
exports.KomandorClaimsController = KomandorClaimsController;
__decorate([
    (0, common_1.Get)('dictionaries/stores'),
    __param(0, (0, common_1.Request)()),
    __param(1, (0, common_1.Query)('q')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String]),
    __metadata("design:returntype", Promise)
], KomandorClaimsController.prototype, "getStores", null);
__decorate([
    (0, common_1.Get)('dictionaries/dict'),
    __param(0, (0, common_1.Query)('kind')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", Promise)
], KomandorClaimsController.prototype, "getDict", null);
__decorate([
    (0, common_1.Get)(),
    __param(0, (0, common_1.Request)()),
    __param(1, (0, common_1.Query)('limit')),
    __param(2, (0, common_1.Query)('offset')),
    __param(3, (0, common_1.Query)('status')),
    __param(4, (0, common_1.Query)('topic')),
    __param(5, (0, common_1.Query)('store')),
    __param(6, (0, common_1.Query)('search')),
    __param(7, (0, common_1.Query)('dateFrom')),
    __param(8, (0, common_1.Query)('dateTo')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String, String, Object, Object, String, String, String, String]),
    __metadata("design:returntype", Promise)
], KomandorClaimsController.prototype, "findAll", null);
__decorate([
    (0, common_1.Get)('stats'),
    __param(0, (0, common_1.Request)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", Promise)
], KomandorClaimsController.prototype, "getStats", null);
__decorate([
    (0, common_1.Get)(':id'),
    __param(0, (0, common_1.Request)()),
    __param(1, (0, common_1.Param)('id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String]),
    __metadata("design:returntype", Promise)
], KomandorClaimsController.prototype, "findOne", null);
__decorate([
    (0, common_1.Post)(),
    __param(0, (0, common_1.Request)()),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, Object]),
    __metadata("design:returntype", Promise)
], KomandorClaimsController.prototype, "create", null);
__decorate([
    (0, common_1.Put)(':id'),
    __param(0, (0, common_1.Request)()),
    __param(1, (0, common_1.Param)('id')),
    __param(2, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String, Object]),
    __metadata("design:returntype", Promise)
], KomandorClaimsController.prototype, "update", null);
__decorate([
    (0, common_1.Delete)(':id'),
    __param(0, (0, common_1.Request)()),
    __param(1, (0, common_1.Param)('id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String]),
    __metadata("design:returntype", Promise)
], KomandorClaimsController.prototype, "remove", null);
exports.KomandorClaimsController = KomandorClaimsController = __decorate([
    (0, common_1.Controller)('komandor-claims'),
    (0, common_1.UseGuards)(jwt_auth_guard_1.JwtAuthGuard, module_access_guard_1.ModuleAccessGuard),
    (0, requires_module_decorator_1.RequiresModule)('komandor_claims'),
    __metadata("design:paramtypes", [komandor_claims_service_1.KomandorClaimsService])
], KomandorClaimsController);
//# sourceMappingURL=komandor-claims.controller.js.map