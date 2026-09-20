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
exports.KomandorClaimsPublicController = void 0;
const common_1 = require("@nestjs/common");
const config_1 = require("@nestjs/config");
const komandor_claims_service_1 = require("./komandor-claims.service");
let KomandorClaimsPublicController = class KomandorClaimsPublicController {
    service;
    userUid;
    constructor(service, config) {
        this.service = service;
        this.userUid = Number(config.get('DEFAULT_VPBX_USER_UID', '1'));
    }
    async getStores(q) {
        return this.service.listStores(this.userUid, q);
    }
    async getDict(kind) {
        return this.service.listDict(kind);
    }
    async findAll(limit, offset, status, topic, store, search, dateFrom, dateTo) {
        return this.service.findAll(this.userUid, {
            limit: limit ? parseInt(limit, 10) : undefined,
            offset: offset ? parseInt(offset, 10) : undefined,
            status, topic, store, search, dateFrom, dateTo,
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
exports.KomandorClaimsPublicController = KomandorClaimsPublicController;
__decorate([
    (0, common_1.Get)('dictionaries/stores'),
    __param(0, (0, common_1.Query)('q')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", Promise)
], KomandorClaimsPublicController.prototype, "getStores", null);
__decorate([
    (0, common_1.Get)('dictionaries/dict'),
    __param(0, (0, common_1.Query)('kind')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", Promise)
], KomandorClaimsPublicController.prototype, "getDict", null);
__decorate([
    (0, common_1.Get)(),
    __param(0, (0, common_1.Query)('limit')),
    __param(1, (0, common_1.Query)('offset')),
    __param(2, (0, common_1.Query)('status')),
    __param(3, (0, common_1.Query)('topic')),
    __param(4, (0, common_1.Query)('store')),
    __param(5, (0, common_1.Query)('search')),
    __param(6, (0, common_1.Query)('dateFrom')),
    __param(7, (0, common_1.Query)('dateTo')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, String, Object, Object, String, String, String, String]),
    __metadata("design:returntype", Promise)
], KomandorClaimsPublicController.prototype, "findAll", null);
__decorate([
    (0, common_1.Get)('stats'),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", Promise)
], KomandorClaimsPublicController.prototype, "getStats", null);
__decorate([
    (0, common_1.Get)(':id'),
    __param(0, (0, common_1.Param)('id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", Promise)
], KomandorClaimsPublicController.prototype, "findOne", null);
__decorate([
    (0, common_1.Post)(),
    __param(0, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", Promise)
], KomandorClaimsPublicController.prototype, "create", null);
__decorate([
    (0, common_1.Put)(':id'),
    __param(0, (0, common_1.Param)('id')),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, Object]),
    __metadata("design:returntype", Promise)
], KomandorClaimsPublicController.prototype, "update", null);
__decorate([
    (0, common_1.Delete)(':id'),
    __param(0, (0, common_1.Param)('id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", Promise)
], KomandorClaimsPublicController.prototype, "remove", null);
exports.KomandorClaimsPublicController = KomandorClaimsPublicController = __decorate([
    (0, common_1.Controller)('public/komandor-claims'),
    __metadata("design:paramtypes", [komandor_claims_service_1.KomandorClaimsService,
        config_1.ConfigService])
], KomandorClaimsPublicController);
//# sourceMappingURL=komandor-claims-public.controller.js.map