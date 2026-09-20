"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.NumbersModule = void 0;
const common_1 = require("@nestjs/common");
const sequelize_1 = require("@nestjs/sequelize");
const number_list_model_1 = require("./number-list.model");
const numbers_service_1 = require("./numbers.service");
const numbers_controller_1 = require("./numbers.controller");
const numbers_ai_adapter_1 = require("./numbers-ai.adapter");
const logger_module_1 = require("../logger/logger.module");
const ai_platform_module_1 = require("../ai-platform/ai-platform.module");
const routes_module_1 = require("../routes/routes.module");
let NumbersModule = class NumbersModule {
};
exports.NumbersModule = NumbersModule;
exports.NumbersModule = NumbersModule = __decorate([
    (0, common_1.Module)({
        imports: [sequelize_1.SequelizeModule.forFeature([number_list_model_1.NumberList]), logger_module_1.LoggerModule, ai_platform_module_1.AiPlatformModule, routes_module_1.RoutesModule],
        providers: [numbers_service_1.NumbersService, numbers_ai_adapter_1.NumbersAiAdapter],
        controllers: [numbers_controller_1.NumbersController],
        exports: [numbers_service_1.NumbersService],
    })
], NumbersModule);
//# sourceMappingURL=numbers.module.js.map