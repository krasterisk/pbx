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
var VkProvider_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.VkProvider = void 0;
const common_1 = require("@nestjs/common");
const axios_1 = __importDefault(require("axios"));
const notification_provider_interface_1 = require("./notification-provider.interface");
const AXIOS_TIMEOUT_MS = 10_000;
let VkProvider = VkProvider_1 = class VkProvider {
    logger = new common_1.Logger(VkProvider_1.name);
    async send(integration, target, message, _options) {
        const accessToken = integration.credentials?.access_token ?? integration.credentials?.token;
        const peerId = target ||
            integration.config?.peer_id ||
            integration.credentials?.peer_id;
        if (!accessToken || peerId === undefined || peerId === null || peerId === '') {
            this.logger.warn('VK send skipped: missing access_token or peer_id');
            return { success: false, error: 'missing_credentials' };
        }
        const text = (0, notification_provider_interface_1.trimNotificationMessage)(message);
        const body = new URLSearchParams({
            peer_id: String(peerId),
            message: text,
            random_id: String(Math.floor(Math.random() * 2_147_483_647)),
        }).toString();
        try {
            await axios_1.default.post(`https://api.vk.com/method/messages.send?access_token=${encodeURIComponent(String(accessToken))}&v=5.199`, body, {
                headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
                timeout: AXIOS_TIMEOUT_MS,
            });
            return { success: true };
        }
        catch (e) {
            this.logger.error(`VK send failed: ${e?.message ?? e}`);
            return { success: false, error: e?.message };
        }
    }
};
exports.VkProvider = VkProvider;
exports.VkProvider = VkProvider = VkProvider_1 = __decorate([
    (0, common_1.Injectable)()
], VkProvider);
//# sourceMappingURL=vk.provider.js.map