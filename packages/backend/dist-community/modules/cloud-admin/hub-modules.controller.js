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
exports.HubModulesController = void 0;
const common_1 = require("@nestjs/common");
const swagger_1 = require("@nestjs/swagger");
const jwt_auth_guard_1 = require("../auth/jwt-auth.guard");
const superadmin_guard_1 = require("../auth/superadmin.guard");
const modules_registry_service_1 = require("./modules-registry.service");
const hub_module_dto_1 = require("./dto/hub-module.dto");
/**
 * Platform Hub catalog CRUD — SuperAdmin only (D-21 / T-08-03).
 * Tenant APIs must not mutate membership.
 */
let HubModulesController = class HubModulesController {
    modulesService;
    constructor(modulesService) {
        this.modulesService = modulesService;
    }
    list() {
        return this.modulesService.listHubModules();
    }
    create(dto) {
        return this.modulesService.createHubModule(dto);
    }
    reorder(dto) {
        return this.modulesService.reorderHubModules(dto.codes);
    }
    replacePages(code, dto) {
        return this.modulesService.replaceHubModulePages(code, dto.pages);
    }
    async update(code, dto) {
        const row = await this.modulesService.updateHubModule(code, dto);
        if (!row)
            throw new common_1.NotFoundException(`Hub module ${code} not found`);
        return row;
    }
    async remove(code) {
        await this.modulesService.deleteHubModule(code);
        return { success: true };
    }
};
exports.HubModulesController = HubModulesController;
__decorate([
    (0, common_1.Get)(),
    (0, swagger_1.ApiOperation)({ summary: 'List Hub modules with page membership' }),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", void 0)
], HubModulesController.prototype, "list", null);
__decorate([
    (0, common_1.Post)(),
    (0, swagger_1.ApiOperation)({ summary: 'Create Hub module' }),
    __param(0, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [hub_module_dto_1.CreateHubModuleDto]),
    __metadata("design:returntype", void 0)
], HubModulesController.prototype, "create", null);
__decorate([
    (0, common_1.Patch)('reorder'),
    (0, swagger_1.ApiOperation)({ summary: 'Reorder Hub modules by code list' }),
    __param(0, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [hub_module_dto_1.ReorderHubModulesDto]),
    __metadata("design:returntype", void 0)
], HubModulesController.prototype, "reorder", null);
__decorate([
    (0, common_1.Put)(':code/pages'),
    (0, swagger_1.ApiOperation)({ summary: 'Replace page membership for a Hub module (D-21)' }),
    __param(0, (0, common_1.Param)('code')),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, hub_module_dto_1.ReplaceHubModulePagesDto]),
    __metadata("design:returntype", void 0)
], HubModulesController.prototype, "replacePages", null);
__decorate([
    (0, common_1.Put)(':code'),
    (0, swagger_1.ApiOperation)({ summary: 'Update Hub module metadata' }),
    __param(0, (0, common_1.Param)('code')),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, hub_module_dto_1.UpdateHubModuleDto]),
    __metadata("design:returntype", Promise)
], HubModulesController.prototype, "update", null);
__decorate([
    (0, common_1.Delete)(':code'),
    (0, swagger_1.ApiOperation)({ summary: 'Delete Hub module (and its page membership)' }),
    __param(0, (0, common_1.Param)('code')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", Promise)
], HubModulesController.prototype, "remove", null);
exports.HubModulesController = HubModulesController = __decorate([
    (0, swagger_1.ApiTags)('Cloud Admin — Hub Modules'),
    (0, swagger_1.ApiBearerAuth)(),
    (0, common_1.UseGuards)(jwt_auth_guard_1.JwtAuthGuard, superadmin_guard_1.SuperAdminGuard),
    (0, common_1.Controller)('cloud-admin/hub-modules'),
    __metadata("design:paramtypes", [modules_registry_service_1.ModulesRegistryService])
], HubModulesController);
//# sourceMappingURL=hub-modules.controller.js.map