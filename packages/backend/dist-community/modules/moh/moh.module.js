"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.MohModule = void 0;
const common_1 = require("@nestjs/common");
const sequelize_1 = require("@nestjs/sequelize");
const moh_class_model_1 = require("./moh-class.model");
const moh_entry_model_1 = require("./moh-entry.model");
const moh_controller_1 = require("./moh.controller");
const moh_service_1 = require("./moh.service");
const ami_module_1 = require("../ami/ami.module");
const ai_platform_module_1 = require("../ai-platform/ai-platform.module");
const queues_module_1 = require("../queues/queues.module");
const routes_module_1 = require("../routes/routes.module");
const moh_ai_adapter_1 = require("./moh-ai.adapter");
let MohModule = class MohModule {
};
exports.MohModule = MohModule;
exports.MohModule = MohModule = __decorate([
    (0, common_1.Module)({
        imports: [
            sequelize_1.SequelizeModule.forFeature([moh_class_model_1.MohClass, moh_entry_model_1.MohEntry]),
            ami_module_1.AmiModule,
            ai_platform_module_1.AiPlatformModule,
            queues_module_1.QueuesModule,
            routes_module_1.RoutesModule,
        ],
        controllers: [moh_controller_1.MohController],
        providers: [moh_service_1.MohService, moh_ai_adapter_1.MohAiAdapter],
        exports: [moh_service_1.MohService],
    })
], MohModule);
//# sourceMappingURL=moh.module.js.map