"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.DirectoriesModule = void 0;
const common_1 = require("@nestjs/common");
const sequelize_1 = require("@nestjs/sequelize");
const directory_model_1 = require("./directory.model");
const directory_field_model_1 = require("./directory-field.model");
const directory_record_model_1 = require("./directory-record.model");
const route_directory_binding_model_1 = require("./route-directory-binding.model");
const route_model_1 = require("../routes/route.model");
const directories_controller_1 = require("./directories.controller");
const directory_lookup_controller_1 = require("./directory-lookup.controller");
const directories_service_1 = require("./directories.service");
const directories_ai_adapter_1 = require("./directories-ai.adapter");
const ai_platform_module_1 = require("../ai-platform/ai-platform.module");
let DirectoriesModule = class DirectoriesModule {
};
exports.DirectoriesModule = DirectoriesModule;
exports.DirectoriesModule = DirectoriesModule = __decorate([
    (0, common_1.Module)({
        imports: [
            sequelize_1.SequelizeModule.forFeature([
                directory_model_1.Directory,
                directory_field_model_1.DirectoryField,
                directory_record_model_1.DirectoryRecord,
                route_directory_binding_model_1.RouteDirectoryBinding,
                route_model_1.Route,
            ]),
            ai_platform_module_1.AiPlatformModule,
        ],
        controllers: [directories_controller_1.DirectoriesController, directory_lookup_controller_1.DirectoryLookupController],
        providers: [directories_service_1.DirectoriesService, directories_ai_adapter_1.DirectoriesAiAdapter],
        exports: [directories_service_1.DirectoriesService],
    })
], DirectoriesModule);
//# sourceMappingURL=directories.module.js.map