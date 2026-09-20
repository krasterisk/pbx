"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.IntegrationDeliveryModule = void 0;
const common_1 = require("@nestjs/common");
const sequelize_1 = require("@nestjs/sequelize");
const integration_credentials_module_1 = require("../integration-credentials/integration-credentials.module");
const webhook_models_1 = require("./webhook.models");
const integration_delivery_controller_1 = require("./integration-delivery.controller");
let IntegrationDeliveryModule = class IntegrationDeliveryModule {
};
exports.IntegrationDeliveryModule = IntegrationDeliveryModule;
exports.IntegrationDeliveryModule = IntegrationDeliveryModule = __decorate([
    (0, common_1.Module)({
        imports: [
            integration_credentials_module_1.IntegrationCredentialsModule,
            sequelize_1.SequelizeModule.forFeature([webhook_models_1.AiWebhookEndpoint, webhook_models_1.AiWebhookDelivery, webhook_models_1.AiWebhookAttempt]),
        ],
        controllers: [integration_delivery_controller_1.IntegrationDeliveryController],
        exports: [sequelize_1.SequelizeModule],
    })
], IntegrationDeliveryModule);
//# sourceMappingURL=integration-delivery.module.js.map