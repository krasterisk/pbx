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
var WhatsAppProvider_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.WhatsAppProvider = void 0;
const common_1 = require("@nestjs/common");
const axios_1 = __importDefault(require("axios"));
const notification_provider_interface_1 = require("./notification-provider.interface");
const AXIOS_TIMEOUT_MS = 10_000;
let WhatsAppProvider = WhatsAppProvider_1 = class WhatsAppProvider {
    logger = new common_1.Logger(WhatsAppProvider_1.name);
    async send(integration, target, message, _options) {
        const accessToken = integration.credentials?.access_token ?? integration.credentials?.token;
        const phoneNumberId = integration.credentials?.phone_number_id ??
            integration.config?.phone_number_id;
        const to = target || integration.config?.to || integration.credentials?.to;
        if (!accessToken || !phoneNumberId || !to) {
            this.logger.warn('WhatsApp send skipped: missing token, phone_number_id, or to');
            return { success: false, error: 'missing_credentials' };
        }
        const text = (0, notification_provider_interface_1.trimNotificationMessage)(message);
        try {
            await axios_1.default.post(`https://graph.facebook.com/v22.0/${phoneNumberId}/messages`, {
                messaging_product: 'whatsapp',
                to,
                type: 'text',
                text: { body: text },
            }, {
                headers: { Authorization: `Bearer ${accessToken}` },
                timeout: AXIOS_TIMEOUT_MS,
            });
            return { success: true };
        }
        catch (e) {
            this.logger.error(`WhatsApp send failed: ${e?.message ?? e}`);
            return { success: false, error: e?.message };
        }
    }
};
exports.WhatsAppProvider = WhatsAppProvider;
exports.WhatsAppProvider = WhatsAppProvider = WhatsAppProvider_1 = __decorate([
    (0, common_1.Injectable)()
], WhatsAppProvider);
//# sourceMappingURL=whatsapp.provider.js.map