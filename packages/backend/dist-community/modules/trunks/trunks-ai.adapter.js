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
var TrunksAiAdapter_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.TrunksAiAdapter = void 0;
exports.confirmTrunkDelete = confirmTrunkDelete;
exports.collectTrunkRouteRefs = collectTrunkRouteRefs;
const common_1 = require("@nestjs/common");
const zod_1 = require("zod");
const trunks_service_1 = require("./trunks.service");
const routes_service_1 = require("../routes/routes.service");
const ai_adapter_registry_service_1 = require("../ai-platform/ai-adapter-registry.service");
const ai_mutation_contract_1 = require("../ai-platform/ai-mutation.contract");
const SCHEMA_VERSION = 'trunks-1';
const trunkType = zod_1.z.enum(['auth', 'ip']);
/** No `password` key anywhere: a provider secret is set on the trunk screen, not by the model. */
const createTrunkShape = {
    name: zod_1.z.string().min(1).describe('Имя транка ("МТТ", "Ростелеком")'),
    trunkType: trunkType.optional(),
    host: zod_1.z.string().min(1).describe('Адрес SIP-сервера провайдера'),
    port: zod_1.z.number().int().positive().optional(),
    username: zod_1.z.string().optional(),
    context: zod_1.z.string().optional().describe('Контекст для входящих (from-trunk)'),
    codecs: zod_1.z.string().optional(),
    fromDomain: zod_1.z.string().optional(),
};
const createTrunkInput = zod_1.z.strictObject(createTrunkShape);
const createTrunkArgs = zod_1.z.strictObject({
    ...createTrunkShape,
    trunkType: trunkType.default('ip'),
});
const deleteTrunkInput = zod_1.z.strictObject({
    trunkId: zod_1.z.string().min(1).describe('ID транка (t_{name}_{tenantId})'),
});
/**
 * Re-check dependents at confirm time so a still-referenced trunk
 * surfaces route names instead of disappearing silently (T-15-41).
 */
async function confirmTrunkDelete(trunksService, routesService, trunkId, vpbxUserUid) {
    const routes = await routesService.findAll(vpbxUserUid);
    const references = collectTrunkRouteRefs(routes, trunkId);
    if (references.length > 0) {
        return { ok: false, references };
    }
    await trunksService.remove(trunkId, vpbxUserUid);
    return { ok: true };
}
function collectTrunkRouteRefs(routes, trunkId) {
    const hits = [];
    for (const route of routes) {
        if (routeReferencesTrunk(route.actions, trunkId)) {
            hits.push({
                uid: Number(route.uid ?? 0),
                name: String(route.name || `#${route.uid ?? '?'}`),
            });
        }
    }
    return hits;
}
function routeReferencesTrunk(actions, trunkId) {
    if (!Array.isArray(actions))
        return false;
    for (const action of actions) {
        if (!action || typeof action !== 'object')
            continue;
        const rec = action;
        const params = (rec.params ?? {});
        if (matchesTrunk(params.trunk, trunkId) || matchesTrunk(params.trunkId, trunkId)) {
            return true;
        }
        if (Array.isArray(params.trunks)) {
            for (const item of params.trunks) {
                const row = item;
                if (matchesTrunk(row?.trunkId, trunkId) || matchesTrunk(row?.trunk, trunkId)) {
                    return true;
                }
            }
        }
        if (JSON.stringify(rec).includes(trunkId))
            return true;
    }
    return false;
}
function matchesTrunk(value, trunkId) {
    if (value == null)
        return false;
    const text = String(value);
    return text === trunkId || text.endsWith(`/${trunkId}`) || text.includes(trunkId);
}
/** findAll exposes host; findOne nests it under registration / identify. */
function resolveTrunkHost(current) {
    if (typeof current.host === 'string' && current.host)
        return current.host;
    const fromReg = current.registration?.server_uri?.replace(/^sip:/i, '').split('@').pop();
    if (fromReg)
        return fromReg;
    return current.identify?.match ?? '';
}
/**
 * TrunksAiAdapter — trunk mutations as proposals plus a read listing (D-15).
 */
let TrunksAiAdapter = TrunksAiAdapter_1 = class TrunksAiAdapter {
    trunksService;
    routesService;
    registry;
    logger = new common_1.Logger(TrunksAiAdapter_1.name);
    domain = 'trunks';
    constructor(trunksService, routesService, registry) {
        this.trunksService = trunksService;
        this.routesService = routesService;
        this.registry = registry;
    }
    onModuleInit() {
        this.registry.register(this);
        this.logger.log('TrunksAiAdapter registered');
    }
    getTools() {
        return [this.toolListTrunks(), this.toolCreateTrunk(), this.toolDeleteTrunk()];
    }
    getStateProvider() {
        return { domain: this.domain, buildSummary: (uid) => this.buildSummary(uid) };
    }
    getKnowledgeBlock() {
        return `## Транки
- auth — регистрация у провайдера (логин/пароль). ip — пиринг по адресу, без регистрации.
- Хост и тип задаёт провайдер; агент не выдумывает их. Смена транка бьёт по живым звонкам.
- Удаление называет маршруты, которые ссылаются на транк.`;
    }
    async buildSummary(vpbxUserUid) {
        const trunks = await this.trunksService.findAll(vpbxUserUid);
        if (trunks.length === 0)
            return '';
        return `Транки: ${trunks.map((trunk) => trunk.name).join(', ')}`;
    }
    toolListTrunks() {
        return {
            name: 'list_trunks',
            description: 'Список транков тенанта: id, имя, хост, тип (auth|ip). Без паролей.',
            inputSchema: {},
            entityType: 'trunk',
            handler: async (_args, uid) => {
                const trunks = await this.trunksService.findAll(uid);
                return {
                    trunks: trunks.map((trunk) => ({
                        id: trunk.id,
                        name: trunk.name,
                        host: trunk.host,
                        trunkType: trunk.trunkType,
                    })),
                };
            },
        };
    }
    toolCreateTrunk() {
        return (0, ai_mutation_contract_1.defineMutationTool)({
            name: 'create_trunk',
            description: 'Предлагает создать исходящий SIP-транк. Тип auth — регистрация, ip — пиринг.',
            entityType: 'trunk',
            schemaVersion: SCHEMA_VERSION,
            input: createTrunkInput,
            args: createTrunkArgs,
            reload: { kind: 'none' },
            propose: async (input) => {
                const kind = input.trunkType ?? 'ip';
                return this.proposal('create_trunk', input.name, { ...input, trunkType: kind }, null, { name: input.name, host: input.host, trunkType: kind }, [`Создать транк «${input.name}» на хосте ${input.host} (${kind})`]);
            },
            revalidate: async (args, ctx) => {
                const existing = await this.trunksService.findAll(ctx.vpbxUserUid);
                if (existing.some((trunk) => trunk.name === args.name)) {
                    return { ok: false, reason: `Транк «${args.name}» уже есть у тенанта` };
                }
                return { ok: true, args };
            },
            apply: async (args, ctx) => {
                await this.trunksService.create(args, ctx.vpbxUserUid);
            },
        });
    }
    toolDeleteTrunk() {
        return (0, ai_mutation_contract_1.defineMutationTool)({
            name: 'delete_trunk',
            description: 'Предлагает удалить транк. В карточке — маршруты, которые на него ссылаются. Деструктивно.',
            entityType: 'trunk',
            destructive: true,
            schemaVersion: SCHEMA_VERSION,
            input: deleteTrunkInput,
            args: deleteTrunkInput,
            reload: { kind: 'none' },
            propose: async (input, ctx) => {
                const current = await this.trunksService.findOne(input.trunkId, ctx.vpbxUserUid);
                const routes = await this.routesService.findAll(ctx.vpbxUserUid);
                const references = collectTrunkRouteRefs(routes, input.trunkId);
                const refNames = references.map((row) => row.name).join(', ') || 'нет ссылающихся маршрутов';
                return this.proposal('delete_trunk', current.name, { trunkId: input.trunkId }, { id: current.id, name: current.name, host: resolveTrunkHost(current) }, { referencedRoutes: references }, [`Удалить транк «${current.name}» (${input.trunkId})`, `Маршруты, которые ссылаются: ${refNames}`]);
            },
            revalidate: async (args, ctx) => {
                try {
                    await this.trunksService.findOne(args.trunkId, ctx.vpbxUserUid);
                }
                catch {
                    return { ok: false, reason: `Транк ${args.trunkId} не найден у тенанта` };
                }
                const routes = await this.routesService.findAll(ctx.vpbxUserUid);
                const references = collectTrunkRouteRefs(routes, args.trunkId);
                if (references.length) {
                    return {
                        ok: false,
                        reason: `На транк ссылаются маршруты: ${references.map((row) => row.name).join(', ')}`,
                    };
                }
                return { ok: true, args };
            },
            apply: async (args, ctx) => {
                const result = await confirmTrunkDelete(this.trunksService, this.routesService, args.trunkId, ctx.vpbxUserUid);
                if (!result.ok) {
                    const names = (result.references ?? []).map((row) => row.name).join(', ');
                    throw new Error(`Trunk is referenced by routes: ${names}`);
                }
            },
        });
    }
    proposal(tool, label, args, before, after, summary) {
        return {
            entityType: 'trunk',
            entityLabel: label,
            summary,
            before,
            after,
            applyPayload: { tool, args },
            includesDialplanReload: false,
        };
    }
};
exports.TrunksAiAdapter = TrunksAiAdapter;
exports.TrunksAiAdapter = TrunksAiAdapter = TrunksAiAdapter_1 = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [trunks_service_1.TrunksService,
        routes_service_1.RoutesService,
        ai_adapter_registry_service_1.AiAdapterRegistryService])
], TrunksAiAdapter);
//# sourceMappingURL=trunks-ai.adapter.js.map