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
var NumbersAiAdapter_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.NumbersAiAdapter = void 0;
const common_1 = require("@nestjs/common");
const numbers_service_1 = require("./numbers.service");
const routes_service_1 = require("../routes/routes.service");
const directory_pattern_util_1 = require("../directories/directory-pattern.util");
const ai_adapter_registry_service_1 = require("../ai-platform/ai-adapter-registry.service");
/**
 * NumbersAiAdapter — read-only DID tools (D-15).
 * List returns status and assignment; describe resolves the current destination
 * through the tenant's route lookup so the model does not match patterns by hand.
 */
let NumbersAiAdapter = NumbersAiAdapter_1 = class NumbersAiAdapter {
    numbersService;
    registry;
    routesService;
    logger = new common_1.Logger(NumbersAiAdapter_1.name);
    domain = 'numbers';
    constructor(numbersService, registry, routesService) {
        this.numbersService = numbersService;
        this.registry = registry;
        this.routesService = routesService;
    }
    onModuleInit() {
        this.registry.register(this);
        this.logger.log('NumbersAiAdapter registered');
    }
    getTools() {
        return [this.toolListNumbers(), this.toolDescribeNumber()];
    }
    getStateProvider() {
        return { domain: this.domain, buildSummary: (uid) => this.buildSummary(uid) };
    }
    getKnowledgeBlock() {
        return `## Номера
- Номер тенанта — DID или маска, не список доступа оператора.
- describe_number уже решает, какой маршрут ловит номер и куда он ведёт. Не сопоставляй шаблоны сам.
- Номер без маршрута возвращается как unrouted, а не как «номера нет».`;
    }
    async buildSummary(vpbxUserUid) {
        const rows = await this.numbersService.findAll(vpbxUserUid);
        if (rows.length === 0)
            return '';
        const labels = rows.map((row) => numberOf(row)).filter(Boolean);
        return labels.length ? `Номера: ${labels.join(', ')}` : '';
    }
    toolListNumbers() {
        return {
            name: 'list_numbers',
            description: 'Список номеров тенанта со статусом и назначенным маршрутом. Куда ведёт номер — describe_number.',
            inputSchema: {},
            entityType: 'number',
            handler: async (_args, uid) => {
                const [rows, routes] = await Promise.all([
                    this.numbersService.findAll(uid),
                    this.routesService.findAll(uid),
                ]);
                return {
                    numbers: rows.map((row) => {
                        const value = numberOf(row);
                        const match = matchRoute(routes, value);
                        return {
                            id: row.id,
                            name: row.name ?? null,
                            number: value,
                            status: row.status ?? 'active',
                            assignment: match?.name ?? null,
                        };
                    }),
                };
            },
        };
    }
    toolDescribeNumber() {
        return {
            name: 'describe_number',
            description: 'Один номер: статус, маршрут и текущее назначение. Если маршрута нет — unrouted, не пропуск.',
            inputSchema: {
                number: { type: 'string', description: 'Номер или маска из list_numbers' },
                id: { type: 'number', description: 'UID записи номера' },
            },
            entityType: 'number',
            handler: async (args, uid) => {
                const rows = await this.numbersService.findAll(uid);
                const wanted = args.number != null ? String(args.number).trim() : '';
                const wantedId = args.id != null ? Number(args.id) : NaN;
                const row = rows.find((entry) => {
                    if (Number.isFinite(wantedId) && entry.id === wantedId)
                        return true;
                    return wanted && numberOf(entry) === wanted;
                });
                const value = wanted || (row ? numberOf(row) : '');
                const routes = await this.routesService.findAll(uid);
                const match = matchRoute(routes, value);
                if (!match) {
                    return {
                        id: row?.id ?? null,
                        name: row?.name ?? null,
                        number: value,
                        status: row?.status ?? 'unknown',
                        routed: false,
                        route: null,
                        destination: 'unrouted',
                    };
                }
                return {
                    id: row?.id ?? null,
                    name: row?.name ?? null,
                    number: value,
                    status: row?.status ?? 'active',
                    routed: true,
                    route: { uid: match.uid ?? null, name: match.name ?? null },
                    destination: destinationOf(match.actions),
                };
            },
        };
    }
};
exports.NumbersAiAdapter = NumbersAiAdapter;
exports.NumbersAiAdapter = NumbersAiAdapter = NumbersAiAdapter_1 = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [numbers_service_1.NumbersService,
        ai_adapter_registry_service_1.AiAdapterRegistryService,
        routes_service_1.RoutesService])
], NumbersAiAdapter);
function numberOf(row) {
    if (typeof row.number === 'string' && row.number.trim())
        return row.number.trim();
    if (typeof row.name === 'string' && /^\d+$/.test(row.name.trim()))
        return row.name.trim();
    return String(row.name ?? '').trim();
}
function matchRoute(routes, value) {
    if (!value)
        return undefined;
    const candidates = routes.flatMap((route) => (route.extensions ?? []).map((pattern) => ({ route, pattern })));
    return (0, directory_pattern_util_1.pickBestAsteriskMatch)(candidates, (entry) => entry.pattern, value)?.route;
}
function destinationOf(actions) {
    if (!Array.isArray(actions) || actions.length === 0)
        return 'нет';
    const first = actions[0];
    if (!first || typeof first !== 'object')
        return 'нет';
    const rec = first;
    const type = String(rec.type || '');
    const params = (rec.params && typeof rec.params === 'object' ? rec.params : {});
    const target = readTarget(params);
    return target ? `${type} ${target}` : type || 'нет';
}
function readTarget(params) {
    if (params.ivr_uid != null)
        return String(params.ivr_uid);
    if (typeof params.queue === 'string')
        return params.queue;
    if (typeof params.trunk === 'string')
        return params.trunk;
    if (typeof params.exten === 'string')
        return params.exten;
    const target = params.target;
    if (typeof target === 'string')
        return target;
    if (target && typeof target === 'object' && !Array.isArray(target)) {
        const rec = target;
        if (rec.value != null)
            return String(rec.value);
    }
    return null;
}
//# sourceMappingURL=numbers-ai.adapter.js.map