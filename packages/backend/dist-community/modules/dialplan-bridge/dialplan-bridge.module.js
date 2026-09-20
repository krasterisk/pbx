"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.DialplanBridgeModule = void 0;
const common_1 = require("@nestjs/common");
const axios_1 = require("@nestjs/axios");
const config_1 = require("@nestjs/config");
const sequelize_1 = require("@nestjs/sequelize");
const dialplan_bridge_controller_1 = require("./dialplan-bridge.controller");
const dialplan_bridge_service_1 = require("./dialplan-bridge.service");
const numbers_module_1 = require("../numbers/numbers.module");
const mailer_module_1 = require("../mailer/mailer.module");
const telegram_module_1 = require("../telegram/telegram.module");
const tts_engines_module_1 = require("../tts-engines/tts-engines.module");
const ivrs_module_1 = require("../ivrs/ivrs.module");
const route_model_1 = require("../routes/route.model");
let DialplanBridgeModule = class DialplanBridgeModule {
};
exports.DialplanBridgeModule = DialplanBridgeModule;
exports.DialplanBridgeModule = DialplanBridgeModule = __decorate([
    (0, common_1.Module)({
        imports: [
            config_1.ConfigModule,
            axios_1.HttpModule.register({ timeout: 5_000 }),
            sequelize_1.SequelizeModule.forFeature([route_model_1.Route]),
            numbers_module_1.NumbersModule,
            mailer_module_1.MailerModule,
            telegram_module_1.TelegramModule,
            tts_engines_module_1.TtsEnginesModule,
            ivrs_module_1.IvrsModule,
        ],
        controllers: [dialplan_bridge_controller_1.DialplanBridgeController],
        providers: [dialplan_bridge_service_1.DialplanBridgeService],
        exports: [dialplan_bridge_service_1.DialplanBridgeService],
    })
], DialplanBridgeModule);
//# sourceMappingURL=dialplan-bridge.module.js.map