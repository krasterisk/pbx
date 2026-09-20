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
var ReportsAiAdapter_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.ReportsAiAdapter = void 0;
const common_1 = require("@nestjs/common");
const cdr_service_1 = require("./cdr/cdr.service");
const ai_adapter_registry_service_1 = require("../ai-platform/ai-adapter-registry.service");
const CDR_SEARCH_DEFAULT_LIMIT = 20;
const CDR_SEARCH_MAX_LIMIT = 50;
/**
 * ReportsAiAdapter — read-only call-record tools over CdrService.
 *
 * Every handler receives `vpbxUserUid` as a call parameter — never closed over (D-22).
 * find_cdr_calls keeps the handwritten result-count clamp (D-12).
 */
let ReportsAiAdapter = ReportsAiAdapter_1 = class ReportsAiAdapter {
    cdrService;
    registry;
    logger = new common_1.Logger(ReportsAiAdapter_1.name);
    domain = 'reports';
    constructor(cdrService, registry) {
        this.cdrService = cdrService;
        this.registry = registry;
    }
    onModuleInit() {
        this.registry.register(this);
        this.logger.log('ReportsAiAdapter registered');
    }
    getTools() {
        return [this.toolGetCdrSummary(), this.toolFindCdrCalls()];
    }
    getStateProvider() {
        return { domain: this.domain, buildSummary: async () => '' };
    }
    getKnowledgeBlock() {
        return `## Журнал звонков (CDR)
- Одна запись поиска — один звонок (GROUP BY linkedid), не нога канала.
- Сводка (get_cdr_summary) отдаёт totalCalls, ASR, среднюю длительность и разбивку по disposition.
- Поиск (find_cdr_calls) ограничен ${CDR_SEARCH_MAX_LIMIT} строками; без limit используется ${CDR_SEARCH_DEFAULT_LIMIT}. Сужай период или номер, а не листай вслепую.`;
    }
    toolGetCdrSummary() {
        return {
            name: 'get_cdr_summary',
            description: 'Сводка CDR за период: количество звонков, ASR, средняя длительность. Параметры dateFrom/dateTo в формате YYYY-MM-DD.',
            inputSchema: {
                dateFrom: { type: 'string', description: 'Начало периода YYYY-MM-DD' },
                dateTo: { type: 'string', description: 'Конец периода YYYY-MM-DD' },
            },
            entityType: 'cdr',
            handler: async (args, uid) => {
                return this.cdrService.getStats(uid, {
                    dateFrom: args.dateFrom,
                    dateTo: args.dateTo,
                });
            },
        };
    }
    toolFindCdrCalls() {
        return {
            name: 'find_cdr_calls',
            description: 'Поиск звонков CDR (одна запись на звонок, GROUP BY linkedid). Лимит до 50.',
            inputSchema: {
                dateFrom: { type: 'string' },
                dateTo: { type: 'string' },
                search: { type: 'string', description: 'Поиск по номеру' },
                direction: { type: 'string', enum: ['in', 'out', 'int', 'external'] },
                limit: { type: 'number', default: CDR_SEARCH_DEFAULT_LIMIT },
            },
            entityType: 'cdr',
            handler: async (args, uid) => {
                return this.cdrService.findCalls(uid, {
                    dateFrom: args.dateFrom,
                    dateTo: args.dateTo,
                    search: args.search,
                    direction: args.direction,
                    limit: Math.min(args.limit || CDR_SEARCH_DEFAULT_LIMIT, CDR_SEARCH_MAX_LIMIT),
                    offset: 0,
                });
            },
        };
    }
};
exports.ReportsAiAdapter = ReportsAiAdapter;
exports.ReportsAiAdapter = ReportsAiAdapter = ReportsAiAdapter_1 = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [cdr_service_1.CdrService,
        ai_adapter_registry_service_1.AiAdapterRegistryService])
], ReportsAiAdapter);
//# sourceMappingURL=reports-ai.adapter.js.map