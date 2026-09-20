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
exports.CloudSettingsController = void 0;
const common_1 = require("@nestjs/common");
const swagger_1 = require("@nestjs/swagger");
const jwt_auth_guard_1 = require("../auth/jwt-auth.guard");
const superadmin_guard_1 = require("../auth/superadmin.guard");
const cloud_settings_service_1 = require("./cloud-settings.service");
let CloudSettingsController = class CloudSettingsController {
    settingsService;
    constructor(settingsService) {
        this.settingsService = settingsService;
    }
    /** GET /cloud-admin/settings/seller — Реквизиты поставщика */
    getSellerInfo() {
        return this.settingsService.getSellerInfo();
    }
    /** PATCH /cloud-admin/settings/seller — Обновить реквизиты поставщика */
    updateSellerInfo(body) {
        return this.settingsService.updateSellerInfo(body);
    }
};
exports.CloudSettingsController = CloudSettingsController;
__decorate([
    (0, common_1.Get)('seller'),
    (0, swagger_1.ApiOperation)({ summary: 'Получить реквизиты поставщика для PDF документов' }),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", void 0)
], CloudSettingsController.prototype, "getSellerInfo", null);
__decorate([
    (0, common_1.Patch)('seller'),
    (0, swagger_1.ApiOperation)({ summary: 'Обновить реквизиты поставщика' }),
    __param(0, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", void 0)
], CloudSettingsController.prototype, "updateSellerInfo", null);
exports.CloudSettingsController = CloudSettingsController = __decorate([
    (0, swagger_1.ApiTags)('Cloud Admin — Settings'),
    (0, swagger_1.ApiBearerAuth)(),
    (0, common_1.UseGuards)(jwt_auth_guard_1.JwtAuthGuard, superadmin_guard_1.SuperAdminGuard),
    (0, common_1.Controller)('cloud-admin/settings'),
    __metadata("design:paramtypes", [cloud_settings_service_1.CloudSettingsService])
], CloudSettingsController);
//# sourceMappingURL=cloud-settings.controller.js.map