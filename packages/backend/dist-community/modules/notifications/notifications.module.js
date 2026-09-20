"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.NotificationsModule = void 0;
const common_1 = require("@nestjs/common");
const axios_1 = require("@nestjs/axios");
const sequelize_1 = require("@nestjs/sequelize");
const mailer_module_1 = require("../mailer/mailer.module");
const route_references_module_1 = require("../route-references/route-references.module");
const ai_platform_module_1 = require("../ai-platform/ai-platform.module");
const notification_integration_model_1 = require("./notification-integration.model");
const notifications_ai_adapter_1 = require("./notifications-ai.adapter");
const notifications_controller_1 = require("./notifications.controller");
const notifications_service_1 = require("./notifications.service");
const dialplan_notify_controller_1 = require("./dialplan-notify.controller");
const notification_dispatcher_service_1 = require("./notification-dispatcher.service");
const telegram_provider_1 = require("./providers/telegram.provider");
const email_provider_1 = require("./providers/email.provider");
const whatsapp_provider_1 = require("./providers/whatsapp.provider");
const webhook_provider_1 = require("./providers/webhook.provider");
const max_provider_1 = require("./providers/max.provider");
const vk_provider_1 = require("./providers/vk.provider");
let NotificationsModule = class NotificationsModule {
};
exports.NotificationsModule = NotificationsModule;
exports.NotificationsModule = NotificationsModule = __decorate([
    (0, common_1.Module)({
        imports: [
            sequelize_1.SequelizeModule.forFeature([notification_integration_model_1.NotificationIntegration]),
            axios_1.HttpModule.register({ timeout: 10_000 }),
            mailer_module_1.MailerModule,
            route_references_module_1.RouteReferencesModule,
            ai_platform_module_1.AiPlatformModule,
        ],
        controllers: [notifications_controller_1.NotificationsController, dialplan_notify_controller_1.DialplanNotifyController],
        providers: [
            notifications_service_1.NotificationsService,
            notifications_ai_adapter_1.NotificationsAiAdapter,
            notification_dispatcher_service_1.NotificationDispatcherService,
            telegram_provider_1.TelegramProvider,
            email_provider_1.EmailProvider,
            whatsapp_provider_1.WhatsAppProvider,
            webhook_provider_1.WebhookProvider,
            max_provider_1.MaxProvider,
            vk_provider_1.VkProvider,
        ],
        exports: [notifications_service_1.NotificationsService, notification_dispatcher_service_1.NotificationDispatcherService, webhook_provider_1.WebhookProvider],
    })
], NotificationsModule);
//# sourceMappingURL=notifications.module.js.map