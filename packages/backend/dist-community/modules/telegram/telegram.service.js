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
var TelegramService_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.TelegramService = void 0;
const common_1 = require("@nestjs/common");
const TelegramBot = require("node-telegram-bot-api");
const config_1 = require("@nestjs/config");
let TelegramService = TelegramService_1 = class TelegramService {
    configService;
    bot = null;
    logger = new common_1.Logger(TelegramService_1.name);
    chatId;
    constructor(configService) {
        this.configService = configService;
        const token = this.configService.get('TELEGRAM_BOT_TOKEN');
        this.chatId = this.configService.get('TELEGRAM_CHAT_ID');
        if (token) {
            try {
                this.bot = new TelegramBot(token, { polling: false });
                this.logger.log('Telegram bot instantiated');
            }
            catch (e) {
                this.logger.error('Failed to initialize Telegram bot', e);
            }
        }
        else {
            this.logger.warn('TELEGRAM_BOT_TOKEN is not set. Telegram features will be disabled.');
        }
    }
    /**
     * Read-only channel presence for the AI adapter. Never returns the token (T-15-77).
     */
    async getChannelStatus(_vpbxUserUid) {
        const configured = this.bot !== null;
        return { configured, enabled: configured && Boolean(this.chatId) };
    }
    /**
     * Tenant-scoped delivery history. No store exists yet — empty until a log is added.
     */
    async listDeliveries(_vpbxUserUid) {
        return [];
    }
    async sendMessage(message, options) {
        if (!this.bot) {
            return;
        }
        if (!this.chatId) {
            this.logger.warn('TELEGRAM_CHAT_ID is not set. Cannot send message to admin group.');
            return;
        }
        try {
            await this.bot.sendMessage(this.chatId, message, options);
        }
        catch (e) {
            this.logger.error('Failed to send telegram message', e);
        }
    }
};
exports.TelegramService = TelegramService;
exports.TelegramService = TelegramService = TelegramService_1 = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [config_1.ConfigService])
], TelegramService);
//# sourceMappingURL=telegram.service.js.map