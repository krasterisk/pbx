"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.RouteReferencesModule = void 0;
const common_1 = require("@nestjs/common");
const sequelize_1 = require("@nestjs/sequelize");
const route_model_1 = require("../routes/route.model");
const route_directory_binding_model_1 = require("../directories/route-directory-binding.model");
const ivr_model_1 = require("../ivrs/ivr.model");
const route_references_controller_1 = require("./route-references.controller");
const route_references_service_1 = require("./route-references.service");
let RouteReferencesModule = class RouteReferencesModule {
};
exports.RouteReferencesModule = RouteReferencesModule;
exports.RouteReferencesModule = RouteReferencesModule = __decorate([
    (0, common_1.Module)({
        imports: [sequelize_1.SequelizeModule.forFeature([route_model_1.Route, route_directory_binding_model_1.RouteDirectoryBinding, ivr_model_1.Ivr])],
        controllers: [route_references_controller_1.RouteReferencesController],
        providers: [route_references_service_1.RouteReferencesService],
        exports: [route_references_service_1.RouteReferencesService],
    })
], RouteReferencesModule);
//# sourceMappingURL=route-references.module.js.map