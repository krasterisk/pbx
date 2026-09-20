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
var MaxProvider_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.MaxProvider = void 0;
const common_1 = require("@nestjs/common");
const axios_1 = __importDefault(require("axios"));
const notification_provider_interface_1 = require("./notification-provider.interface");
const AXIOS_TIMEOUT_MS = 10_000;
let MaxProvider = MaxProvider_1 = class MaxProvider {
    logger = new common_1.Logger(MaxProvider_1.name);
    async send(integration, target, message, _options) {
        const accessToken = integration.credentials?.access_token ?? integration.credentials?.token;
        const useChatId = !target && !!integration.config?.chat_id && !integration.config?.user_id;
        const id = target ||
            integration.config?.user_id ||
            integration.config?.chat_id ||
            integration.credentials?.user_id ||
            integration.credentials?.chat_id;
        const queryKey = useChatId ? 'chat_id' : 'user_id';
        if (!accessToken || !id) {
            this.logger.warn('MAX send skipped: missing access_token or user_id');
            return { success: false, error: 'missing_credentials' };
        }
        const text = (0, notification_provider_interface_1.trimNotificationMessage)(message);
        try {
            await axios_1.default.post(`https://platform-api2.max.ru/messages?${queryKey}=${encodeURIComponent(String(id))}`, { text }, {
                headers: { Authorization: String(accessToken) },
                timeout: AXIOS_TIMEOUT_MS,
            });
            return { success: true };
        }
        catch (e) {
            this.logger.error(`MAX send failed: ${e?.message ?? e}`);
            return { success: false, error: e?.message };
        }
    }
};
exports.MaxProvider = MaxProvider;
exports.MaxProvider = MaxProvider = MaxProvider_1 = __decorate([
    (0, common_1.Injectable)()
], MaxProvider);
//# sourceMappingURL=max.provider.js.map