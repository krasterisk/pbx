"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
var TelegramProvider_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.TelegramProvider = void 0;
const common_1 = require("@nestjs/common");
const axios_1 = __importDefault(require("axios"));
const notification_provider_interface_1 = require("./notification-provider.interface");
const AXIOS_TIMEOUT_MS = 10_000;
function telegramStatus(err) {
    const status = err?.response?.status;
    return typeof status === 'number' ? status : undefined;
}
let TelegramProvider = TelegramProvider_1 = class TelegramProvider {
    logger = new common_1.Logger(TelegramProvider_1.name);
    async send(integration, target, message, options) {
        const token = integration.credentials?.bot_token ?? integration.credentials?.token;
        const chatId = target ||
            integration.config?.chat_id ||
            integration.credentials?.chat_id;
        if (!token || !chatId) {
            this.logger.warn('Telegram send skipped: missing token or chat_id');
            return { success: false, error: 'missing_credentials' };
        }
        const text = (0, notification_provider_interface_1.trimNotificationMessage)(message);
        try {
            if (options?.attach) {
                const form = new FormData();
                form.append('chat_id', String(chatId));
                if (text)
                    form.append('caption', text);
                const blob = new Blob([options.attach.content], {
                    type: options.attach.contentType,
                });
                form.append('document', blob, options.attach.filename);
                await axios_1.default.post(`https://api.telegram.org/bot${token}/sendDocument`, form, { timeout: AXIOS_TIMEOUT_MS });
                return { success: true };
            }
            await axios_1.default.post(`https://api.telegram.org/bot${token}/sendMessage`, { chat_id: chatId, text }, { timeout: AXIOS_TIMEOUT_MS });
            return { success: true };
        }
        catch (e) {
            const status = telegramStatus(e);
            if (options?.attach && status !== undefined && status >= 400 && status < 500) {
                this.logger.error(`Telegram attach rejected: ${e?.message ?? e}`);
                return { success: false, error: notification_provider_interface_1.ATTACHMENT_REJECTED };
            }
            this.logger.error(`Telegram send failed: ${e?.message ?? e}`);
            return { success: false, error: e?.message };
        }
    }
};
exports.TelegramProvider = TelegramProvider;
exports.TelegramProvider = TelegramProvider = TelegramProvider_1 = __decorate([
    (0, common_1.Injectable)()
], TelegramProvider);
//# sourceMappingURL=telegram.provider.js.map