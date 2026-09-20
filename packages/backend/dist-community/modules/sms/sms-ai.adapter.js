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
var SmsAiAdapter_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.SmsAiAdapter = exports.DELIVERY_BODY_PREVIEW_LENGTH = void 0;
exports.toChannelStatus = toChannelStatus;
exports.toDeliveryViews = toDeliveryViews;
const common_1 = require("@nestjs/common");
const sms_service_1 = require("./sms.service");
const ai_adapter_registry_service_1 = require("../ai-platform/ai-adapter-registry.service");
/** Bodies are excluded by default; a non-zero value would allow a documented preview only (T-15-79). */
exports.DELIVERY_BODY_PREVIEW_LENGTH = 0;
/**
 * SmsAiAdapter — read-only SMS channel and delivery tools (D-12, D-15).
 * Sending is an outward action with no undo and is not declared.
 */
let SmsAiAdapter = SmsAiAdapter_1 = class SmsAiAdapter {
    sms;
    registry;
    logger = new common_1.Logger(SmsAiAdapter_1.name);
    domain = 'sms';
    constructor(sms, registry) {
        this.sms = sms;
        this.registry = registry;
    }
    onModuleInit() {
        this.registry.register(this);
        this.logger.log('SmsAiAdapter registered');
    }
    getTools() {
        return [this.toolGetChannel(), this.toolListDeliveries()];
    }
    getStateProvider() {
        return { domain: this.domain, buildSummary: (uid) => this.buildSummary(uid) };
    }
    getKnowledgeBlock() {
        return `## SMS
- Канал: configured/enabled без токена. История доставки — статус и время, без текста.
- Отправить или переотправить SMS агент не может.`;
    }
    async buildSummary(vpbxUserUid) {
        const status = toChannelStatus(await this.sms.getChannelStatus(vpbxUserUid));
        return `SMS: ${status.configured ? (status.enabled ? 'включён' : 'настроен, выключен') : 'не настроен'}`;
    }
    toolGetChannel() {
        return {
            name: 'get_sms_channel',
            description: 'Состояние SMS-канала тенанта: настроен и включён или нет. Токен и секреты не возвращаются. Отправка недоступна.',
            inputSchema: {},
            entityType: 'sms',
            handler: async (_args, uid) => toChannelStatus(await this.sms.getChannelStatus(uid)),
        };
    }
    toolListDeliveries() {
        return {
            name: 'list_sms_deliveries',
            description: 'Недавние попытки доставки SMS тенанта: статус и время. Тело сообщения не отдаётся. Отправка и повтор недоступны.',
            inputSchema: {},
            entityType: 'sms',
            handler: async (_args, uid) => ({
                deliveries: toDeliveryViews(await this.sms.listDeliveries(uid)),
            }),
        };
    }
};
exports.SmsAiAdapter = SmsAiAdapter;
exports.SmsAiAdapter = SmsAiAdapter = SmsAiAdapter_1 = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [sms_service_1.SmsService,
        ai_adapter_registry_service_1.AiAdapterRegistryService])
], SmsAiAdapter);
function toChannelStatus(raw) {
    return {
        configured: Boolean(raw?.configured),
        enabled: Boolean(raw?.enabled),
    };
}
function toDeliveryViews(rows) {
    return (rows ?? []).map((row) => {
        const timestamp = row.timestamp
            ?? (row.created_at instanceof Date ? row.created_at.toISOString() : row.created_at)
            ?? '';
        return {
            id: String(row.id ?? ''),
            status: String(row.status ?? ''),
            timestamp: String(timestamp),
        };
    });
}
//# sourceMappingURL=sms-ai.adapter.js.map