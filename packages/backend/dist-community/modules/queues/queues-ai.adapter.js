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
var QueuesAiAdapter_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.QueuesAiAdapter = void 0;
const common_1 = require("@nestjs/common");
const zod_1 = require("zod");
const tenant_public_id_util_1 = require("../../shared/utils/tenant-public-id.util");
const queues_service_1 = require("./queues.service");
const contexts_service_1 = require("../contexts/contexts.service");
const endpoints_service_1 = require("../endpoints/endpoints.service");
const route_references_service_1 = require("../route-references/route-references.service");
const ai_adapter_registry_service_1 = require("../ai-platform/ai-adapter-registry.service");
const ai_mutation_contract_1 = require("../ai-platform/ai-mutation.contract");
const STRATEGIES = ['ringall', 'leastrecent', 'fewestcalls', 'random', 'rrmemory'];
const SCHEMA_VERSION = 'queues-1';
const memberSchema = zod_1.z.strictObject({
    interface: zod_1.z.string().min(1).describe('Интерфейс агента, например PJSIP/201'),
    membername: zod_1.z.string().optional(),
    penalty: zod_1.z.number().int().min(0).optional(),
});
const createInput = zod_1.z.strictObject({
    name: zod_1.z.string().min(1).describe('Отображаемое имя'),
    exten: zod_1.z.string().min(1).describe('Номер очереди, 2–8 цифр'),
    strategy: zod_1.z.enum(STRATEGIES).optional().describe(STRATEGIES.join(', ')),
    timeout: zod_1.z.number().int().positive().optional().describe('Секунды звонка одному оператору; не общее ожидание'),
    overflow: zod_1.z.string().optional().describe('Контекст overflow / Queue.context'),
    context: zod_1.z.string().optional(),
    members: zod_1.z.array(memberSchema).optional().describe('[{interface, membername, penalty}]'),
});
const createArgs = zod_1.z.strictObject({
    exten: zod_1.z.string().min(1),
    display_name: zod_1.z.string().min(1),
    strategy: zod_1.z.enum(STRATEGIES).default('ringall'),
    timeout: zod_1.z.number().int().positive().optional().describe('Секунды звонка одному оператору; не общее ожидание'),
    context: zod_1.z.string().optional(),
    members: zod_1.z.array(memberSchema).optional(),
});
const updateInput = zod_1.z.strictObject({
    name: zod_1.z.string().optional().describe('Отображаемое имя или номер очереди'),
    exten: zod_1.z.string().optional().describe('Номер очереди, 2–8 цифр'),
    strategy: zod_1.z.enum(STRATEGIES).optional(),
    timeout: zod_1.z.number().int().positive().optional().describe('Секунды звонка одному оператору; не общее ожидание'),
    overflow: zod_1.z.string().optional().describe('Новый overflow-контекст'),
    context: zod_1.z.string().optional(),
    members: zod_1.z.array(memberSchema).optional(),
});
const updateArgs = zod_1.z.strictObject({
    name: zod_1.z.string().min(1),
    strategy: zod_1.z.enum(STRATEGIES).optional(),
    timeout: zod_1.z.number().int().positive().optional().describe('Секунды звонка одному оператору; не общее ожидание'),
    context: zod_1.z.string().optional(),
    members: zod_1.z.array(memberSchema).optional(),
});
const deleteInput = zod_1.z.strictObject({
    name: zod_1.z.string().optional().describe('Отображаемое имя или номер очереди'),
    exten: zod_1.z.string().optional().describe('Номер очереди, 2–8 цифр'),
});
const deleteArgs = zod_1.z.strictObject({ name: zod_1.z.string().min(1) });
/**
 * QueuesAiAdapter — queue mutations as proposals (D-15, D-18, D-27).
 * Name and tenant are passed separately; a name from one tenant never addresses another.
 * The canonical args store the resolved queue name, so a confirmation cannot be
 * re-pointed by renaming a queue after the card was built.
 */
let QueuesAiAdapter = QueuesAiAdapter_1 = class QueuesAiAdapter {
    queuesService;
    registry;
    contextsService;
    endpointsService;
    routeReferencesService;
    logger = new common_1.Logger(QueuesAiAdapter_1.name);
    domain = 'queues';
    constructor(queuesService, registry, contextsService, endpointsService, routeReferencesService) {
        this.queuesService = queuesService;
        this.registry = registry;
        this.contextsService = contextsService;
        this.endpointsService = endpointsService;
        this.routeReferencesService = routeReferencesService;
    }
    onModuleInit() {
        this.registry.register(this);
        this.logger.log('QueuesAiAdapter registered');
    }
    getTools() {
        return [
            this.toolListQueues(),
            this.toolCreateQueue(),
            this.toolUpdateQueue(),
            this.toolDeleteQueue(),
        ];
    }
    getStateProvider() {
        return { domain: this.domain, buildSummary: (uid) => this.buildSummary(uid) };
    }
    getKnowledgeBlock() {
        return `## Очереди
- Стратегии: ${STRATEGIES.join(', ')}. timeout — длительность дозвона одному агенту, не общее ожидание в очереди; overflow (context) — контекст DTMF-выхода. Общее ожидание и действие после него задаются в маршруте. Overflow очереди не заменяет цепочку пункта IVR после группы (totrunk / hangup).
- Членство — interface абонента тенанта. Перед выводом о проблеме очереди читай live-состояние (get_pbx_state), не только конфиг.`;
    }
    async buildSummary(vpbxUserUid) {
        const queues = await this.queuesService.findAll(vpbxUserUid);
        if (queues.length === 0)
            return '';
        const names = queues.map((queue) => queue.display_name || queue.name).join(', ');
        return `Очереди: ${names}`;
    }
    toolListQueues() {
        return {
            name: 'list_queues',
            description: 'Список очередей тенанта: стратегия, timeout, overflow и состав. Без изменений.',
            inputSchema: {},
            entityType: 'queue',
            handler: async (_args, uid) => {
                const rows = await this.queuesService.findAll(uid);
                const queues = [];
                for (const row of rows) {
                    const detail = await this.safeFindOne(row.name, uid, row);
                    queues.push(this.toListRow(detail));
                }
                return { queues };
            },
        };
    }
    toolCreateQueue() {
        return (0, ai_mutation_contract_1.defineMutationTool)({
            name: 'create_queue',
            description: 'Предлагает создать очередь. overflow и члены проверяются по сущностям тенанта.',
            entityType: 'queue',
            schemaVersion: SCHEMA_VERSION,
            input: createInput,
            args: createArgs,
            reload: { kind: 'none' },
            propose: async (input, ctx) => {
                const overflow = overflowOf(input);
                const members = this.publicMembers(input.members, ctx.vpbxUserUid);
                const refused = await this.refuseBadRefs(overflow, members, ctx.vpbxUserUid);
                if (refused)
                    return refused;
                const applyArgs = {
                    exten: (0, tenant_public_id_util_1.toPublicExten)(input.exten, ctx.vpbxUserUid),
                    display_name: input.name,
                    strategy: input.strategy ?? 'ringall',
                };
                if (input.timeout != null)
                    applyArgs.timeout = input.timeout;
                if (overflow)
                    applyArgs.context = overflow;
                if (members.length)
                    applyArgs.members = members;
                return this.proposal('create_queue', input.name || applyArgs.exten, applyArgs, null, { ...applyArgs, overflow: overflow ?? null }, [`Создать очередь ${applyArgs.display_name || applyArgs.exten}`]);
            },
            revalidate: (args, ctx) => this.revalidateRefs(args, args.context ?? null, args.members, ctx),
            apply: async (args, ctx) => {
                await this.queuesService.create({
                    ...args,
                    exten: (0, tenant_public_id_util_1.toPublicExten)(args.exten, ctx.vpbxUserUid),
                    members: this.publicMembers(args.members, ctx.vpbxUserUid),
                }, ctx.vpbxUserUid);
            },
        });
    }
    toolUpdateQueue() {
        return (0, ai_mutation_contract_1.defineMutationTool)({
            name: 'update_queue',
            description: 'Предлагает изменить очередь. Смена стратегии, состава или overflow — маршрутизация, не безопасная правка.',
            entityType: 'queue',
            schemaVersion: SCHEMA_VERSION,
            input: updateInput,
            args: updateArgs,
            reload: { kind: 'none' },
            propose: async (input, ctx) => {
                const name = await this.resolveQueueName(input, ctx.vpbxUserUid);
                const current = await this.queuesService.findOne(name, ctx.vpbxUserUid);
                const overflow = overflowOf(input);
                const members = input.members !== undefined
                    ? this.publicMembers(input.members, ctx.vpbxUserUid)
                    : undefined;
                const refused = await this.refuseBadRefs(overflow, members, ctx.vpbxUserUid);
                if (refused)
                    return refused;
                const applyArgs = { name };
                if (input.strategy != null)
                    applyArgs.strategy = input.strategy;
                if (input.timeout != null)
                    applyArgs.timeout = input.timeout;
                if (overflow)
                    applyArgs.context = overflow;
                if (members)
                    applyArgs.members = members;
                return this.proposal('update_queue', String(current.display_name || current.name), applyArgs, this.snapshot(current), this.snapshot({ ...current, ...applyArgs, context: overflow ?? current.context }), this.updateSummary(current, applyArgs));
            },
            revalidate: async (args, ctx) => {
                const owned = await this.requireQueue(args, args.name, ctx);
                if (!owned.ok)
                    return owned;
                return this.revalidateRefs(args, args.context ?? null, args.members, ctx);
            },
            apply: async (args, ctx) => {
                const { name, ...rest } = args;
                const dto = rest.members
                    ? { ...rest, members: this.publicMembers(rest.members, ctx.vpbxUserUid) }
                    : rest;
                await this.queuesService.update(name, dto, ctx.vpbxUserUid);
            },
        });
    }
    toolDeleteQueue() {
        return (0, ai_mutation_contract_1.defineMutationTool)({
            name: 'delete_queue',
            description: 'Предлагает удалить очередь по имени. В карточке — маршруты и меню, которые на неё шлют.',
            entityType: 'queue',
            destructive: true,
            schemaVersion: SCHEMA_VERSION,
            input: deleteInput,
            args: deleteArgs,
            reload: { kind: 'none' },
            propose: async (input, ctx) => {
                const name = await this.resolveQueueName(input, ctx.vpbxUserUid);
                const current = await this.queuesService.findOne(name, ctx.vpbxUserUid);
                const feeders = await this.feederNames(name, current.exten, ctx.vpbxUserUid);
                const summary = [
                    `Удалить очередь ${current.display_name || name}`,
                    ...feeders.routes.map((route) => `Маршрут: ${route}`),
                    ...feeders.menus.map((menu) => `Меню: ${menu}`),
                ];
                return this.proposal('delete_queue', String(current.display_name || name), { name }, this.snapshot(current), null, summary);
            },
            revalidate: (args, ctx) => this.requireQueue(args, args.name, ctx),
            apply: async (args, ctx) => {
                await this.queuesService.remove(args.name, ctx.vpbxUserUid);
            },
        });
    }
    publicMembers(members, uid) {
        return (members ?? []).map((member) => ({
            ...member,
            interface: (0, tenant_public_id_util_1.toPublicMemberInterface)(member.interface, uid),
        }));
    }
    async requireQueue(args, name, ctx) {
        try {
            await this.queuesService.findOne(name, ctx.vpbxUserUid);
            return { ok: true, args };
        }
        catch {
            return { ok: false, reason: `Очередь ${name} не найдена у тенанта` };
        }
    }
    async revalidateRefs(args, overflow, members, ctx) {
        const refused = await this.refuseBadRefs(overflow, members, ctx.vpbxUserUid);
        if (refused)
            return { ok: false, reason: String(refused.message) };
        return { ok: true, args };
    }
    updateSummary(current, applyArgs) {
        const lines = [];
        if (applyArgs.timeout != null && Number(applyArgs.timeout) !== Number(current.timeout)) {
            lines.push(`timeout: ${current.timeout ?? '—'} → ${applyArgs.timeout}`);
        }
        if (applyArgs.strategy != null && String(applyArgs.strategy) !== String(current.strategy ?? '')) {
            lines.push(`strategy: ${current.strategy ?? '—'} → ${applyArgs.strategy}`);
        }
        const nextOverflow = applyArgs.context != null ? String(applyArgs.context) : current.context;
        if (applyArgs.context != null && String(applyArgs.context) !== String(current.context ?? '')) {
            lines.push(`overflow: ${current.context ?? '—'} → ${applyArgs.context}`);
        }
        else if (nextOverflow) {
            lines.push(`overflow: ${nextOverflow}`);
        }
        const membershipTouched = applyArgs.members !== undefined || applyArgs.strategy != null;
        if (membershipTouched) {
            const agents = memberNames(current.members);
            if (agents.length)
                lines.push(`Агенты: ${agents.join(', ')}`);
        }
        if (lines.length === 0) {
            lines.push(`Изменить очередь ${current.display_name || current.name}`);
        }
        return lines;
    }
    async refuseBadRefs(overflow, members, uid) {
        if (overflow) {
            const contexts = await this.contextsService.findAll(uid);
            const ok = contexts.some((context) => context.name === overflow || String(context.uid) === overflow);
            if (!ok) {
                return {
                    refused: true,
                    destination: overflow,
                    message: `Overflow указывает на несуществующее назначение ${overflow}`,
                };
            }
        }
        if (members?.length) {
            const endpoints = await this.endpointsService.findAll(uid);
            for (const member of members) {
                if (!memberResolves(member.interface, endpoints)) {
                    return {
                        refused: true,
                        destination: member.interface,
                        message: `Член очереди ${member.interface} не найден у тенанта`,
                    };
                }
            }
        }
        return null;
    }
    async feederNames(name, exten, uid) {
        const keys = [name, exten, exten ? `q${exten}` : ''].filter(Boolean);
        const routes = new Set();
        const menus = new Set();
        for (const key of keys) {
            const usage = await this.routeReferencesService.findUsage('queue', key, uid);
            for (const ref of usage.references ?? []) {
                if (ref.routeName)
                    routes.add(ref.routeName);
                if (ref.ivrName)
                    menus.add(ref.ivrName);
            }
        }
        return { routes: [...routes], menus: [...menus] };
    }
    async safeFindOne(name, uid, fallback) {
        try {
            return await this.queuesService.findOne(name, uid);
        }
        catch {
            return fallback;
        }
    }
    toListRow(row) {
        const exten = row.exten || (0, tenant_public_id_util_1.toPublicExten)(row.name);
        return {
            name: row.display_name || exten,
            exten,
            strategy: row.strategy,
            timeout: row.timeout,
            overflow: row.context ?? null,
            members: (row.members ?? []).map((member) => ({
                extension: (0, tenant_public_id_util_1.toPublicExten)(member.interface.split('/').pop() ?? member.interface),
                membername: member.membername,
                penalty: member.penalty,
            })),
        };
    }
    async resolveQueueName(args, uid) {
        const rows = await this.queuesService.findAll(uid);
        const exten = (0, tenant_public_id_util_1.toPublicExten)(args.exten ?? '', uid);
        const label = (args.name ?? '').trim();
        const byExten = exten
            ? rows.find((row) => (0, tenant_public_id_util_1.toPublicExten)(row.name, uid) === exten || row.exten === exten)
            : undefined;
        if (byExten)
            return byExten.name;
        const byLabel = label
            ? rows.find((row) => row.name === label
                || row.display_name === label
                || (0, tenant_public_id_util_1.toPublicExten)(row.name, uid) === (0, tenant_public_id_util_1.toPublicExten)(label, uid))
            : undefined;
        if (byLabel)
            return byLabel.name;
        if (label)
            return label;
        throw new Error('Очередь не найдена у тенанта');
    }
    snapshot(row) {
        return {
            name: row.name,
            strategy: row.strategy ?? null,
            timeout: row.timeout ?? null,
            overflow: row.context ?? null,
            members: memberNames(row.members),
        };
    }
    proposal(tool, label, args, before, after, summary) {
        return {
            entityType: 'queue',
            entityLabel: label,
            summary,
            before,
            after,
            applyPayload: { tool, args },
            includesDialplanReload: false,
        };
    }
};
exports.QueuesAiAdapter = QueuesAiAdapter;
exports.QueuesAiAdapter = QueuesAiAdapter = QueuesAiAdapter_1 = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [queues_service_1.QueuesService,
        ai_adapter_registry_service_1.AiAdapterRegistryService,
        contexts_service_1.ContextsService,
        endpoints_service_1.EndpointsService,
        route_references_service_1.RouteReferencesService])
], QueuesAiAdapter);
function overflowOf(input) {
    if (input.overflow != null && input.overflow.trim())
        return input.overflow;
    if (input.context != null && input.context.trim())
        return input.context;
    return null;
}
function memberNames(members) {
    return (members ?? [])
        .map((member) => member.membername || member.interface)
        .filter(Boolean);
}
function memberResolves(iface, endpoints) {
    const raw = String(iface || '');
    const id = (0, tenant_public_id_util_1.toPublicExten)(raw.replace(/^(PJSIP|SIP)\//i, ''));
    return endpoints.some((row) => String(row.sipUsername) === id
        || String(row.extension) === id
        || (0, tenant_public_id_util_1.toPublicExten)(row.sipUsername) === id
        || raw.endsWith(`/${row.sipUsername}`)
        || raw.endsWith(`/${row.extension}`));
}
//# sourceMappingURL=queues-ai.adapter.js.map