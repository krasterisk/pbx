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
var TelegramAiAdapter_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.TelegramAiAdapter = void 0;
const common_1 = require("@nestjs/common");
const telegram_service_1 = require("./telegram.service");
const ai_adapter_registry_service_1 = require("../ai-platform/ai-adapter-registry.service");
const sms_ai_adapter_1 = require("../sms/sms-ai.adapter");
/**
 * TelegramAiAdapter — read-only Telegram channel and delivery tools (D-12, D-15).
 * Token, webhook secret and message bodies stay out of the transcript.
 */
let TelegramAiAdapter = TelegramAiAdapter_1 = class TelegramAiAdapter {
    telegram;
    registry;
    logger = new common_1.Logger(TelegramAiAdapter_1.name);
    domain = 'telegram';
    constructor(telegram, registry) {
        this.telegram = telegram;
        this.registry = registry;
    }
    onModuleInit() {
        this.registry.register(this);
        this.logger.log('TelegramAiAdapter registered');
    }
    getTools() {
        return [this.toolGetChannel(), this.toolListDeliveries()];
    }
    getStateProvider() {
        return { domain: this.domain, buildSummary: (uid) => this.buildSummary(uid) };
    }
    getKnowledgeBlock() {
        return `## Telegram
- Канал: configured/enabled без токена и webhook secret. История — статус и время, без текста.
- Отправить или переотправить сообщение агент не может.`;
    }
    async buildSummary(vpbxUserUid) {
        const status = (0, sms_ai_adapter_1.toChannelStatus)(await this.telegram.getChannelStatus(vpbxUserUid));
        return `Telegram: ${status.configured ? (status.enabled ? 'включён' : 'настроен, выключен') : 'не настроен'}`;
    }
    toolGetChannel() {
        return {
            name: 'get_telegram_channel',
            description: 'Состояние Telegram-канала тенанта: настроен и включён или нет. Токен и webhook secret не возвращаются. Отправка недоступна.',
            inputSchema: {},
            entityType: 'telegram',
            handler: async (_args, uid) => (0, sms_ai_adapter_1.toChannelStatus)(await this.telegram.getChannelStatus(uid)),
        };
    }
    toolListDeliveries() {
        return {
            name: 'list_telegram_deliveries',
            description: 'Недавние попытки доставки Telegram тенанта: статус и время. Текст сообщения не отдаётся. Отправка и повтор недоступны.',
            inputSchema: {},
            entityType: 'telegram',
            handler: async (_args, uid) => ({
                deliveries: (0, sms_ai_adapter_1.toDeliveryViews)(await this.telegram.listDeliveries(uid)),
            }),
        };
    }
};
exports.TelegramAiAdapter = TelegramAiAdapter;
exports.TelegramAiAdapter = TelegramAiAdapter = TelegramAiAdapter_1 = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [telegram_service_1.TelegramService,
        ai_adapter_registry_service_1.AiAdapterRegistryService])
], TelegramAiAdapter);
//# sourceMappingURL=telegram-ai.adapter.js.map