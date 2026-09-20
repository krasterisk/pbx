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
var KomandorClaimsAiAdapter_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.KomandorClaimsAiAdapter = void 0;
exports.toClaimViews = toClaimViews;
const common_1 = require("@nestjs/common");
const komandor_claims_service_1 = require("./komandor-claims.service");
const ai_adapter_registry_service_1 = require("../ai-platform/ai-adapter-registry.service");
const notifications_ai_adapter_1 = require("../notifications/notifications-ai.adapter");
/**
 * KomandorClaimsAiAdapter — read-only bounded claim listing (D-15).
 * Free text beyond the shared preview is omitted (T-15-90). No create/update.
 */
let KomandorClaimsAiAdapter = KomandorClaimsAiAdapter_1 = class KomandorClaimsAiAdapter {
    claims;
    registry;
    logger = new common_1.Logger(KomandorClaimsAiAdapter_1.name);
    domain = 'komandor-claims';
    constructor(claims, registry) {
        this.claims = claims;
        this.registry = registry;
    }
    onModuleInit() {
        this.registry.register(this);
        this.logger.log('KomandorClaimsAiAdapter registered');
    }
    getTools() {
        return [this.toolListClaims()];
    }
    getStateProvider() {
        return { domain: this.domain, buildSummary: (uid) => this.buildSummary(uid) };
    }
    getKnowledgeBlock() {
        return `## Претензии
- Список: статус, время и усечённая тема. Полный текст клиента не отдаётся.
- Создать или изменить претензию агент не может.`;
    }
    async buildSummary(vpbxUserUid) {
        const listed = await this.claims.findAll(vpbxUserUid, { limit: 5 });
        const rows = listed.rows ?? [];
        if (rows.length === 0)
            return '';
        return `Претензии: ${rows.map((row) => String(row.request_status ?? 'unknown')).join(', ')}`;
    }
    toolListClaims() {
        return {
            name: 'list_claims',
            description: 'Претензии тенанта: статус, время и усечённая тема. Полный текст и контакты не отдаются. Изменение недоступно.',
            inputSchema: {
                date_from: { type: 'string', description: 'Начало диапазона (YYYY-MM-DD)' },
                date_to: { type: 'string', description: 'Конец диапазона (YYYY-MM-DD)' },
                limit: { type: 'number', description: 'Число строк в пределах общего потолка' },
            },
            entityType: 'claim',
            handler: async (args, uid) => {
                const limit = (0, notifications_ai_adapter_1.clampOperationsCount)(args.limit);
                const listed = await this.claims.findAll(uid, {
                    limit,
                    dateFrom: optionalDate(args.date_from),
                    dateTo: optionalDate(args.date_to),
                });
                return { claims: toClaimViews(unwrapRows(listed)).slice(0, limit) };
            },
        };
    }
};
exports.KomandorClaimsAiAdapter = KomandorClaimsAiAdapter;
exports.KomandorClaimsAiAdapter = KomandorClaimsAiAdapter = KomandorClaimsAiAdapter_1 = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [komandor_claims_service_1.KomandorClaimsService,
        ai_adapter_registry_service_1.AiAdapterRegistryService])
], KomandorClaimsAiAdapter);
function toClaimViews(rows) {
    return (rows ?? []).map((row) => ({
        id: String(row.uid ?? row.request_number ?? ''),
        requestNumber: row.request_number ?? null,
        status: String(row.request_status ?? row.status ?? ''),
        timestamp: toIso(row.request_date ?? row.created_at),
        subject: (0, notifications_ai_adapter_1.truncatePreview)(String(row.topic || row.description || '')),
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
//# sourceMappingURL=komandor-claims-ai.adapter.js.map