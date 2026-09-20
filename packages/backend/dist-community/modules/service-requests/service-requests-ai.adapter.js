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
var ServiceRequestsAiAdapter_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.ServiceRequestsAiAdapter = void 0;
exports.toRequestViews = toRequestViews;
const common_1 = require("@nestjs/common");
const service_requests_service_1 = require("./service-requests.service");
const ai_adapter_registry_service_1 = require("../ai-platform/ai-adapter-registry.service");
const notifications_ai_adapter_1 = require("../notifications/notifications-ai.adapter");
/**
 * ServiceRequestsAiAdapter — read-only bounded request listing (D-15).
 * Free text beyond the shared preview is omitted (T-15-90). No create/update.
 */
let ServiceRequestsAiAdapter = ServiceRequestsAiAdapter_1 = class ServiceRequestsAiAdapter {
    serviceRequests;
    registry;
    logger = new common_1.Logger(ServiceRequestsAiAdapter_1.name);
    domain = 'service-requests';
    constructor(serviceRequests, registry) {
        this.serviceRequests = serviceRequests;
        this.registry = registry;
    }
    onModuleInit() {
        this.registry.register(this);
        this.logger.log('ServiceRequestsAiAdapter registered');
    }
    getTools() {
        return [this.toolListRequests()];
    }
    getStateProvider() {
        return { domain: this.domain, buildSummary: (uid) => this.buildSummary(uid) };
    }
    getKnowledgeBlock() {
        return `## Обращения
- Список: статус, время и усечённая тема. Полный текст клиента не отдаётся.
- Создать или изменить обращение агент не может.`;
    }
    async buildSummary(vpbxUserUid) {
        const listed = await this.serviceRequests.findAll(vpbxUserUid, { limit: 5 });
        const rows = listed.rows ?? [];
        if (rows.length === 0)
            return '';
        return `Обращения: ${rows.map((row) => String(row.request_status ?? 'unknown')).join(', ')}`;
    }
    toolListRequests() {
        return {
            name: 'list_service_requests',
            description: 'Обращения тенанта: статус, время и усечённая тема. Полный текст и контакты не отдаются. Создание недоступно.',
            inputSchema: {
                date_from: { type: 'string', description: 'Начало диапазона (YYYY-MM-DD)' },
                date_to: { type: 'string', description: 'Конец диапазона (YYYY-MM-DD)' },
                limit: { type: 'number', description: 'Число строк в пределах общего потолка' },
            },
            entityType: 'service-request',
            handler: async (args, uid) => {
                const limit = (0, notifications_ai_adapter_1.clampOperationsCount)(args.limit);
                const listed = await this.serviceRequests.findAll(uid, {
                    limit,
                    dateFrom: optionalDate(args.date_from),
                    dateTo: optionalDate(args.date_to),
                });
                return { requests: toRequestViews(unwrapRows(listed)).slice(0, limit) };
            },
        };
    }
};
exports.ServiceRequestsAiAdapter = ServiceRequestsAiAdapter;
exports.ServiceRequestsAiAdapter = ServiceRequestsAiAdapter = ServiceRequestsAiAdapter_1 = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [service_requests_service_1.ServiceRequestsService,
        ai_adapter_registry_service_1.AiAdapterRegistryService])
], ServiceRequestsAiAdapter);
function toRequestViews(rows) {
    return (rows ?? []).map((row) => ({
        id: String(row.uid ?? row.request_number ?? ''),
        requestNumber: row.request_number ?? null,
        status: String(row.request_status ?? row.status ?? ''),
        timestamp: toIso(row.call_received_at ?? row.created_at),
        subject: (0, notifications_ai_adapter_1.truncatePreview)(String(row.topic || row.comment || '')),
    }));
}
function unwrapRows(listed) {
    if (Array.isArray(listed))
        return listed;
    return listed?.rows ?? [];
}
function optionalDate(value) {
    if (value == null)
        return undefined;
    const text = String(value).trim();
    return text || undefined;
}
function toIso(value) {
    if (value instanceof Date)
        return value.toISOString();
    return value ? String(value) : '';
}
//# sourceMappingURL=service-requests-ai.adapter.js.map