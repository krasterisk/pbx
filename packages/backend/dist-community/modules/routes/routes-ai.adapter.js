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
var RoutesAiAdapter_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.RoutesAiAdapter = void 0;
const common_1 = require("@nestjs/common");
const zod_1 = require("zod");
const routes_service_1 = require("./routes.service");
const contexts_service_1 = require("../contexts/contexts.service");
const queues_service_1 = require("../queues/queues.service");
const endpoints_service_1 = require("../endpoints/endpoints.service");
const trunks_service_1 = require("../trunks/trunks.service");
const ivrs_service_1 = require("../ivrs/ivrs.service");
const directories_service_1 = require("../directories/directories.service");
const call_groups_service_1 = require("../call-groups/call-groups.service");
const ai_adapter_registry_service_1 = require("../ai-platform/ai-adapter-registry.service");
const ai_mutation_contract_1 = require("../ai-platform/ai-mutation.contract");
const route_chain_draft_util_1 = require("./route-chain-draft.util");
const route_precedence_util_1 = require("../ai-chat/route-precedence.util");
const dialplan_app_catalog_1 = require("./dialplan-app-catalog");
const SCHEMA_VERSION = 'routes-1';
/** Dialplan action params stay open; nested tenant aliases are rejected recursively at parse. */
const actionSchema = zod_1.z.record(zod_1.z.string(), zod_1.z.unknown());
const createInput = zod_1.z.strictObject({
    context_uid: zod_1.z.number().int().positive().describe('UID контекста из list_contexts'),
    pattern: zod_1.z.string().min(1).optional().describe('Один шаблон, например _2XX или 7495…'),
    extensions: zod_1.z.array(zod_1.z.string().min(1)).optional().describe('Список шаблонов (альтернатива pattern)'),
    name: zod_1.z.string().optional().describe('Имя маршрута'),
    actions: zod_1.z.array(actionSchema).min(1).describe('Типизированная цепочка [{type, params, condition}]'),
});
const createArgs = zod_1.z.strictObject({
    context_uid: zod_1.z.number().int().positive(),
    name: zod_1.z.string().min(1),
    extensions: zod_1.z.array(zod_1.z.string().min(1)).min(1),
    actions: zod_1.z.array(actionSchema).min(1),
});
const deleteInput = zod_1.z.strictObject({
    id: zod_1.z.number().int().positive().describe('UID маршрута из list_routes'),
});
const deleteArgs = zod_1.z.strictObject({
    id: zod_1.z.number().int().positive(),
    context_uid: zod_1.z.number().int().positive(),
});
/**
 * RoutesAiAdapter — typed action-chain proposals (D-15, D-18, D-20).
 * Confirmation reloads the dialplan through the adapter-owned reload policy;
 * there is no standalone apply_dialplan tool.
 */
let RoutesAiAdapter = RoutesAiAdapter_1 = class RoutesAiAdapter {
    routesService;
    contextsService;
    queuesService;
    endpointsService;
    trunksService;
    ivrsService;
    directoriesService;
    callGroupsService;
    registry;
    logger = new common_1.Logger(RoutesAiAdapter_1.name);
    domain = 'routes';
    constructor(routesService, contextsService, queuesService, endpointsService, trunksService, ivrsService, directoriesService, callGroupsService, registry) {
        this.routesService = routesService;
        this.contextsService = contextsService;
        this.queuesService = queuesService;
        this.endpointsService = endpointsService;
        this.trunksService = trunksService;
        this.ivrsService = ivrsService;
        this.directoriesService = directoriesService;
        this.callGroupsService = callGroupsService;
        this.registry = registry;
    }
    onModuleInit() {
        this.registry.register(this);
        this.logger.log('RoutesAiAdapter registered');
    }
    getTools() {
        return [
            this.toolListRoutes(),
            this.toolListDialplanApps(),
            this.toolDescribeChain(),
            this.toolCreateRoute(),
            this.toolDeleteRoute(),
        ];
    }
    getStateProvider() {
        return { domain: this.domain, buildSummary: (uid) => this.buildSummary(uid) };
    }
    getKnowledgeBlock() {
        return `## Маршруты
- Маршрут = шаблон в контексте + типизированная цепочка действий, не сырое имя приложения Asterisk.
- Пункты IVR — тот же редактор. Перед цепочкой вызови list_dialplan_apps (host=ivr|route): там типы, зачем шаг и что уже есть у тенанта. Не выдумывай приложения Asterisk.
- Календарь рабочих часов — create_time_group, на действии condition.time_group_uid. schedule в actions — только inline intervals[], не tool плана.
- Сначала list_routes / describe_route_chain / list_contexts, затем proposal. Применение диалплана — шаг подтверждения, не отдельный инструмент.`;
    }
    async buildSummary(vpbxUserUid) {
        const routes = await this.routesService.findAll(vpbxUserUid);
        if (routes.length === 0)
            return '';
        const labels = routes
            .slice(0, 8)
            .map((route) => `${route.name || `#${route.uid}`} [${(route.extensions ?? []).join(',')}]`);
        return `Маршруты: ${labels.join('; ')}`;
    }
    toolListRoutes() {
        return {
            name: 'list_routes',
            description: 'Список маршрутов тенанта: контекст, шаблоны и краткая цепочка. Без изменений.',
            inputSchema: {
                context_uid: { type: 'number', description: 'Опционально ограничить одним контекстом' },
            },
            entityType: 'route',
            handler: async (args, uid) => {
                const contextUid = args.context_uid != null ? Number(args.context_uid) : null;
                const rows = contextUid != null
                    ? await this.routesService.findAllByContext(contextUid, uid)
                    : await this.routesService.findAll(uid);
                return {
                    routes: rows.map((row) => compactRoute(row)),
                };
            },
        };
    }
    toolListDialplanApps() {
        return {
            name: 'list_dialplan_apps',
            description: 'Каталог приложений редактора маршрутов/IVR: тип, зачем, обязательные поля, сколько раз уже есть у тенанта. Не сырые приложения Asterisk.',
            inputSchema: {
                types: { type: 'array', items: { type: 'string' }, description: 'Необязательно: до 3 типов из краткого каталога для подробного описания, например ["confbridge"].' },
                host: {
                    type: 'string',
                    enum: ['route', 'ivr', 'directory_policy'],
                    description: 'Где собирается цепочка. ivr — пункт меню, route — маршрут.',
                },
                include_usage: {
                    type: 'boolean',
                    description: 'Счётчики usedIn.routes / usedIn.ivrs. По умолчанию true.',
                },
            },
            entityType: 'route',
            handler: async (args, uid) => {
                const host = parseDialplanHost(args.host);
                const includeUsage = args.include_usage !== false;
                const selectedTypes = Array.isArray(args.types) ? args.types.map(String).slice(0, 3) : [];
                const apps = (0, dialplan_app_catalog_1.listDialplanAppCatalog)(host).filter(app => !selectedTypes.length || selectedTypes.includes(app.type));
                const [routes, ivrs] = includeUsage
                    ? await Promise.all([
                        this.routesService.findAll(uid).catch(() => []),
                        this.ivrsService.findAll(uid).catch(() => []),
                    ])
                    : [[], []];
                const usage = includeUsage ? (0, dialplan_app_catalog_1.countDialplanAppUsage)(routes, ivrs) : {};
                return {
                    host: host ?? 'all',
                    apps: apps.map((app) => ({
                        ...(selectedTypes.length ? app : { type: app.type, title: app.title, need: app.need }),
                        ...(includeUsage ? { usedIn: usage[app.type] ?? { routes: 0, ivrs: 0 } } : {}),
                    })),
                };
            },
        };
    }
    toolDescribeChain() {
        return {
            name: 'describe_route_chain',
            description: 'Собранная цепочка действий всех маршрутов контекста по приоритету. Без изменений.',
            inputSchema: {
                context_uid: { type: 'number', description: 'UID контекста из list_contexts' },
            },
            entityType: 'route',
            handler: async (args, uid) => {
                const contextUid = Number(args.context_uid);
                const context = await this.findTenantContext(contextUid, uid);
                if (!context) {
                    return this.refuseContext(contextUid);
                }
                const rows = await this.routesService.findAllByContext(contextUid, uid);
                return {
                    context_uid: contextUid,
                    context_name: context.name,
                    routes: rows.map((row) => ({
                        uid: row.uid,
                        name: row.name,
                        extensions: row.extensions ?? [],
                        priority: row.priority,
                        actions: row.actions ?? [],
                    })),
                };
            },
        };
    }
    toolCreateRoute() {
        return (0, ai_mutation_contract_1.defineMutationTool)({
            name: 'create_route',
            description: 'Предлагает создать маршрут как типизированную цепочку действий. Не принимает сырое приложение Asterisk и аргументы.',
            entityType: 'route',
            schemaVersion: SCHEMA_VERSION,
            input: createInput,
            args: createArgs,
            reload: {
                kind: 'dialplan-context',
                contextUid: (args) => args.context_uid,
            },
            propose: async (input, ctx) => this.proposeCreate(input, ctx),
            revalidate: async (args, ctx) => this.revalidateCreate(args, ctx),
            apply: async (args, ctx) => {
                await this.routesService.create({
                    context_uid: args.context_uid,
                    name: args.name,
                    extensions: args.extensions,
                    actions: args.actions,
                }, ctx.vpbxUserUid);
            },
        });
    }
    toolDeleteRoute() {
        return (0, ai_mutation_contract_1.defineMutationTool)({
            name: 'delete_route',
            description: 'Предлагает удалить маршрут по UID. Деструктивно, только внутри тенанта.',
            entityType: 'route',
            destructive: true,
            schemaVersion: SCHEMA_VERSION,
            input: deleteInput,
            args: deleteArgs,
            reload: {
                kind: 'dialplan-context',
                contextUid: (args) => args.context_uid,
            },
            propose: async (input, ctx) => {
                const current = await this.routesService.findOne(input.id, ctx.vpbxUserUid);
                const extensions = current.extensions ?? [];
                const destination = destinationOf(current.actions);
                const siblings = await this.routesService.findAllByContext(current.context_uid, ctx.vpbxUserUid);
                const remaining = siblings
                    .filter((row) => row.uid !== current.uid)
                    .slice()
                    .sort((a, b) => (a.priority ?? 0) - (b.priority ?? 0))
                    .flatMap((row) => row.extensions ?? []);
                const summary = [
                    `Удалить маршрут ${extensions.join(', ') || input.id} → ${destination}; назначение перестанет работать`,
                ];
                const impact = impactNote(extensions, [...remaining, ...extensions]);
                if (impact)
                    summary.push(impact);
                return this.proposal('delete_route', String(current.name || extensions[0] || input.id), { id: input.id, context_uid: current.context_uid }, {
                    uid: current.uid,
                    name: current.name,
                    extensions,
                    destination,
                }, { patterns: remaining }, summary);
            },
            revalidate: async (args, ctx) => {
                try {
                    await this.routesService.findOne(args.id, ctx.vpbxUserUid);
                    return { ok: true, args };
                }
                catch {
                    return { ok: false, reason: `Маршрут ${args.id} не найден у тенанта` };
                }
            },
            apply: async (args, ctx) => {
                await this.routesService.remove(args.id, ctx.vpbxUserUid);
            },
        });
    }
    async proposeCreate(input, ctx) {
        const context = await this.findTenantContext(input.context_uid, ctx.vpbxUserUid);
        if (!context) {
            return this.refuseContext(input.context_uid);
        }
        const extensions = this.readExtensions(input);
        if (!extensions.length) {
            return {
                refused: true,
                message: 'Нужен pattern или непустой extensions',
            };
        }
        const refs = await this.loadRefs(ctx.vpbxUserUid);
        const draft = (0, route_chain_draft_util_1.validateRouteChainDraft)(input.actions, refs);
        if (!draft.ok) {
            return {
                refused: true,
                stepIndex: draft.stepIndex,
                reason: draft.reason,
                message: `Шаг ${draft.stepIndex}: ${draft.reason}`,
            };
        }
        const existing = await this.routesService.findAllByContext(input.context_uid, ctx.vpbxUserUid);
        const resulting = [
            ...existing
                .slice()
                .sort((a, b) => (a.priority ?? 0) - (b.priority ?? 0))
                .flatMap((row) => row.extensions ?? []),
            ...extensions,
        ];
        const precedence = (0, route_precedence_util_1.checkRoutePrecedence)(resulting);
        if (!precedence.safe) {
            return {
                refused: true,
                catchAll: precedence.catchAll,
                shadowed: precedence.shadowed,
                message: `Порядок шаблонов небезопасен: catch-all ${precedence.catchAll} окажется выше ${precedence.shadowed}`,
            };
        }
        const name = String(input.name || extensions[0] || 'route');
        const applyArgs = {
            context_uid: input.context_uid,
            name,
            extensions,
            actions: draft.chain,
        };
        return this.proposal('create_route', name, applyArgs, null, { context_uid: input.context_uid, pattern: extensions[0], patterns: resulting, actions: draft.chain }, this.createSummary(extensions, draft.chain, resulting));
    }
    async revalidateCreate(args, ctx) {
        const context = await this.findTenantContext(args.context_uid, ctx.vpbxUserUid);
        if (!context) {
            return { ok: false, reason: `Контекст ${args.context_uid} не принадлежит этому тенанту` };
        }
        const refs = await this.loadRefs(ctx.vpbxUserUid);
        const draft = (0, route_chain_draft_util_1.validateRouteChainDraft)(args.actions, refs);
        if (!draft.ok) {
            return { ok: false, reason: `Шаг ${draft.stepIndex}: ${draft.reason}` };
        }
        const existing = await this.routesService.findAllByContext(args.context_uid, ctx.vpbxUserUid);
        const resulting = [
            ...existing
                .slice()
                .sort((a, b) => (a.priority ?? 0) - (b.priority ?? 0))
                .flatMap((row) => row.extensions ?? []),
            ...args.extensions,
        ];
        const precedence = (0, route_precedence_util_1.checkRoutePrecedence)(resulting);
        if (!precedence.safe) {
            return {
                ok: false,
                reason: `Порядок шаблонов небезопасен: catch-all ${precedence.catchAll} окажется выше ${precedence.shadowed}`,
            };
        }
        return {
            ok: true,
            args: {
                ...args,
                actions: draft.chain,
            },
        };
    }
    createSummary(extensions, chain, resulting) {
        const steps = chain.map((action, index) => {
            const dest = destinationOf([action]);
            return `${index + 1}. ${action.type}${dest !== action.type ? ` → ${dest}` : ''}`;
        });
        const lines = [
            `Создать маршрут ${extensions.join(', ')}`,
            ...steps,
            'После подтверждения диалплан будет перезагружен',
        ];
        const impact = impactNote(extensions, resulting);
        if (impact)
            lines.push(impact);
        return lines;
    }
    readExtensions(input) {
        if (Array.isArray(input.extensions) && input.extensions.length > 0) {
            return input.extensions.map(String);
        }
        if (input.pattern != null && String(input.pattern)) {
            return [String(input.pattern)];
        }
        return [];
    }
    async findTenantContext(contextUid, uid) {
        const contexts = await this.contextsService.findAll(uid);
        return contexts.find((row) => Number(row.uid) === contextUid) ?? null;
    }
    refuseContext(contextUid) {
        return {
            refused: true,
            context_uid: contextUid,
            message: `Контекст ${contextUid} не принадлежит этому тенанту`,
        };
    }
    async loadRefs(uid) {
        const [queues, endpoints, trunks, ivrs, routes, contexts, directories, groups] = await Promise.all([
            this.queuesService.findAll(uid),
            this.endpointsService.findAll(uid),
            this.trunksService.findAll(uid),
            this.ivrsService.findAll(uid),
            this.routesService.findAll(uid),
            this.contextsService.findAll(uid),
            this.directoriesService.findAll(uid),
            this.callGroupsService.findAll(uid),
        ]);
        return {
            queues,
            extensions: endpoints,
            trunks,
            ivrs,
            routes,
            contexts,
            directories,
            groups,
        };
    }
    proposal(tool, label, args, before, after, summary) {
        return {
            entityType: 'route',
            entityLabel: label,
            summary,
            before,
            after,
            applyPayload: { tool, args },
            includesDialplanReload: true,
        };
    }
};
exports.RoutesAiAdapter = RoutesAiAdapter;
exports.RoutesAiAdapter = RoutesAiAdapter = RoutesAiAdapter_1 = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [routes_service_1.RoutesService,
        contexts_service_1.ContextsService,
        queues_service_1.QueuesService,
        endpoints_service_1.EndpointsService,
        trunks_service_1.TrunksService,
        ivrs_service_1.IvrsService,
        directories_service_1.DirectoriesService,
        call_groups_service_1.CallGroupsService,
        ai_adapter_registry_service_1.AiAdapterRegistryService])
], RoutesAiAdapter);
function compactRoute(row) {
    return {
        uid: row.uid,
        context_uid: row.context_uid,
        name: row.name,
        extensions: row.extensions ?? [],
        priority: row.priority,
        destination: destinationOf(row.actions),
    };
}
function parseDialplanHost(value) {
    if (value === 'route' || value === 'ivr' || value === 'directory_policy')
        return value;
    return undefined;
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
    if (typeof params.group === 'string')
        return params.group;
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
function impactNote(proposed, resulting) {
    const touchesSensitive = proposed.some((pattern) => (0, route_precedence_util_1.isCatchAllPattern)(pattern) || (0, route_precedence_util_1.isEmergencyPattern)(pattern) || isInboundPattern(pattern));
    if (!touchesSensitive)
        return null;
    const inbound = resulting.filter((pattern) => isInboundPattern(pattern) || (0, route_precedence_util_1.isSpecificNumericPattern)(pattern));
    const emergency = resulting.filter((pattern) => (0, route_precedence_util_1.isEmergencyPattern)(pattern));
    const parts = ['Влияние: входящий или catch-all шаблон.'];
    if (inbound.length)
        parts.push(`Входящие: ${inbound.join(', ')}.`);
    if (emergency.length)
        parts.push(`Аварийные: ${emergency.join(', ')}.`);
    return parts.join(' ');
}
function isInboundPattern(pattern) {
    if ((0, route_precedence_util_1.isCatchAllPattern)(pattern) || (0, route_precedence_util_1.isEmergencyPattern)(pattern))
        return false;
    if (!(0, route_precedence_util_1.isSpecificNumericPattern)(pattern))
        return false;
    const digits = pattern.replace(/\D/g, '');
    return digits.length >= 7;
}
//# sourceMappingURL=routes-ai.adapter.js.map