"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.ProductAccessModule = void 0;
const common_1 = require("@nestjs/common");
const product_access_core_module_1 = require("./product-access-core.module");
const product_access_controller_1 = require("./product-access.controller");
let ProductAccessModule = class ProductAccessModule {
};
exports.ProductAccessModule = ProductAccessModule;
exports.ProductAccessModule = ProductAccessModule = __decorate([
    (0, common_1.Module)({
        imports: [product_access_core_module_1.ProductAccessCoreModule],
        controllers: [product_access_controller_1.InstallationLicenseController, product_access_controller_1.TenantProductActivationController],
        exports: [product_access_core_module_1.ProductAccessCoreModule],
    })
], ProductAccessModule);
//# sourceMappingURL=product-access.module.js.map