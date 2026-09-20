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
var NotificationDispatcherService_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.NotificationDispatcherService = void 0;
const common_1 = require("@nestjs/common");
const notifications_service_1 = require("./notifications.service");
const telegram_provider_1 = require("./providers/telegram.provider");
const email_provider_1 = require("./providers/email.provider");
const whatsapp_provider_1 = require("./providers/whatsapp.provider");
const webhook_provider_1 = require("./providers/webhook.provider");
const max_provider_1 = require("./providers/max.provider");
const vk_provider_1 = require("./providers/vk.provider");
/**
 * Async fan-out from dialplan notify → per-channel providers.
 * Decrypts credentials via findByUidInternal; never throws to the caller.
 */
let NotificationDispatcherService = NotificationDispatcherService_1 = class NotificationDispatcherService {
    notificationsService;
    telegram;
    email;
    whatsapp;
    webhook;
    max;
    vk;
    logger = new common_1.Logger(NotificationDispatcherService_1.name);
    constructor(notificationsService, telegram, email, whatsapp, webhook, max, vk) {
        this.notificationsService = notificationsService;
        this.telegram = telegram;
        this.email = email;
        this.whatsapp = whatsapp;
        this.webhook = webhook;
        this.max = max;
        this.vk = vk;
    }
    async dispatch(body) {
        try {
            if (!body.integration_uid) {
                this.logger.warn('notify dispatch skipped: no integration_uid');
                return;
            }
            const integ = await this.notificationsService.findByUidInternal(Number(body.integration_uid));
            const msg = body.message ?? '';
            const target = body.target;
            const options = {
                extraVars: {
                    clid: body.clid ?? '',
                    exten: body.exten ?? '',
                    uniqueid: body.uniqueid ?? '',
                },
                ...(body.attach ? { attach: body.attach } : {}),
            };
            switch (integ.channel) {
                case 'telegram':
                    return await this.telegram.send(integ, target, msg, options);
                case 'email':
                    return await this.email.send(integ, target, msg, options);
                case 'whatsapp':
                    return await this.whatsapp.send(integ, target, msg, options);
                case 'webhook':
                    return await this.webhook.send(integ, target, msg, options);
                case 'max':
                    return await this.max.send(integ, target, msg, options);
                case 'vk':
                    return await this.vk.send(integ, target, msg, options);
                default:
                    this.logger.warn(`Unknown notification channel: ${String(integ.channel)}`);
            }
        }
        catch (e) {
            this.logger.error(`notify dispatch failed: ${e?.message ?? e}`);
        }
    }
};
exports.NotificationDispatcherService = NotificationDispatcherService;
exports.NotificationDispatcherService = NotificationDispatcherService = NotificationDispatcherService_1 = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [notifications_service_1.NotificationsService,
        telegram_provider_1.TelegramProvider,
        email_provider_1.EmailProvider,
        whatsapp_provider_1.WhatsAppProvider,
        webhook_provider_1.WebhookProvider,
        max_provider_1.MaxProvider,
        vk_provider_1.VkProvider])
], NotificationDispatcherService);
//# sourceMappingURL=notification-dispatcher.service.js.map