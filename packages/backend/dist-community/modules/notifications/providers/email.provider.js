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
var EmailProvider_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.EmailProvider = void 0;
const common_1 = require("@nestjs/common");
const mailer_service_1 = require("../../mailer/mailer.service");
const notification_provider_interface_1 = require("./notification-provider.interface");
let EmailProvider = EmailProvider_1 = class EmailProvider {
    mailer;
    logger = new common_1.Logger(EmailProvider_1.name);
    constructor(mailer) {
        this.mailer = mailer;
    }
    async send(integration, target, message, options) {
        const to = target || integration.config?.to;
        if (!to) {
            this.logger.warn('Email send skipped: missing to address');
            return { success: false, error: 'missing_target' };
        }
        try {
            const result = await this.mailer.sendNotification({
                to,
                subject: integration.config?.subject,
                text: (0, notification_provider_interface_1.trimNotificationMessage)(message),
                ...(options?.attach
                    ? {
                        attachments: [
                            {
                                filename: options.attach.filename,
                                content: options.attach.content,
                                contentType: options.attach.contentType,
                            },
                        ],
                    }
                    : {}),
            });
            return { success: !!result?.success };
        }
        catch (e) {
            this.logger.error(`Email send failed: ${e?.message ?? e}`);
            return { success: false, error: e?.message };
        }
    }
};
exports.EmailProvider = EmailProvider;
exports.EmailProvider = EmailProvider = EmailProvider_1 = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [mailer_service_1.MailerService])
], EmailProvider);
//# sourceMappingURL=email.provider.js.map