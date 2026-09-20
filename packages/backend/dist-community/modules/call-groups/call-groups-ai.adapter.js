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
var CallGroupsAiAdapter_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.CallGroupsAiAdapter = void 0;
const common_1 = require("@nestjs/common");
const zod_1 = require("zod");
const tenant_public_id_util_1 = require("../../shared/utils/tenant-public-id.util");
const call_groups_service_1 = require("./call-groups.service");
const endpoints_service_1 = require("../endpoints/endpoints.service");
const route_references_service_1 = require("../route-references/route-references.service");
const ai_adapter_registry_service_1 = require("../ai-platform/ai-adapter-registry.service");
const ai_mutation_contract_1 = require("../ai-platform/ai-mutation.contract");
const STRATEGIES = ['ringall', 'hunt', 'memoryhunt', 'random'];
const SCHEMA_VERSION = 'call-groups-1';
const digitish = zod_1.z.union([zod_1.z.string().min(1), zod_1.z.number()]).transform((value) => String(value));
const memberSchema = zod_1.z.strictObject({
    member_type: zod_1.z.enum(['internal', 'external']).default('internal'),
    value: digitish.describe('Внутренний номер абонента или внешний номер'),
    position: zod_1.z.number().int().min(0).optional(),
    ring_time: zod_1.z.number().int().positive().optional(),
});
const createInput = zod_1.z.strictObject({
    name: zod_1.z.string().min(1).describe('Название группы'),
    exten: digitish.describe('Номер группы, 2–8 цифр'),
    strategy: zod_1.z.enum(STRATEGIES).optional().describe(STRATEGIES.join(', ')),
    members: zod_1.z.array(memberSchema).optional().describe('[{member_type, value, position, ring_time}]'),
});
const createArgs = zod_1.z.strictObject({
    name: zod_1.z.string().min(1),
    exten: zod_1.z.string().min(1),
    strategy: zod_1.z.enum(STRATEGIES).default('ringall'),
    members: zod_1.z.array(memberSchema).optional(),
});
const updateMembersInput = zod_1.z.strictObject({
    uid: zod_1.z.number().int().positive().describe('UID группы'),
    members: zod_1.z
        .array(memberSchema)
        .describe('Полный новый состав [{member_type, value, position, ring_time}]'),
});
const byUid = zod_1.z.strictObject({ uid: zod_1.z.number().int().positive().describe('UID группы') });
/**
 * CallGroupsAiAdapter — call-group read and proposal-gated writes (D-15, D-18).
 * Tenant is a handler parameter. Membership is validated against this tenant's
 * subscribers both when the card is built and again when it is confirmed, so a
 * subscriber deleted in between stops the write instead of ringing nothing.
 */
let CallGroupsAiAdapter = CallGroupsAiAdapter_1 = class CallGroupsAiAdapter {
    callGroupsService;
    registry;
    endpointsService;
    routeReferencesService;
    logger = new common_1.Logger(CallGroupsAiAdapter_1.name);
    domain = 'call-groups';
    constructor(callGroupsService, registry, endpointsService, routeReferencesService) {
        this.callGroupsService = callGroupsService;
        this.registry = registry;
        this.endpointsService = endpointsService;
        this.routeReferencesService = routeReferencesService;
    }
    onModuleInit() {
        this.registry.register(this);
        this.logger.log('CallGroupsAiAdapter registered');
    }
    getTools() {
        return [
            this.toolListCallGroups(),
            this.toolCreateCallGroup(),
            this.toolUpdateMembers(),
            this.toolDeleteCallGroup(),
        ];
    }
    getStateProvider() {
        return { domain: this.domain, buildSummary: (uid) => this.buildSummary(uid) };
    }
    getKnowledgeBlock() {
        return `## Группы вызова
- Стратегии: ${STRATEGIES.join(', ')}. Группа звонит фиксированному списку, очередь ставит в ожидание.
- Номер группы — 2–8 цифр, уникален среди групп, очередей и внутренних номеров тенанта. Занятый номер (например внутренний 110) адаптер сам меняет на свободный 6xxx в карточке — не спрашивай пользователя.
- У группы нет overflow. После ring_time управление возвращается в пункт IVR / маршрут: следующий шаг цепочки (totrunk, voicemail, hangup). Типы — list_dialplan_apps. Не «замени группу очередью».
- Член internal — extension абонента этого тенанта. Несуществующий extension отвергается до карточки.
- «группа 201-203» = одна новая группа с точно этими членами. Не подставляй чужой uid, даже если в нём есть один из номеров.`;
    }
    async buildSummary(vpbxUserUid) {
        const groups = await this.callGroupsService.findAll(vpbxUserUid);
        if (groups.length === 0)
            return '';
        const names = groups.map((group) => `${group.name} (${group.exten}, ${group.strategy})`).join(', ');
        return `Группы вызова: ${names}`;
    }
    toolListCallGroups() {
        return {
            name: 'list_call_groups',
            description: 'Список групп вызова тенанта: номер, стратегия и состав. Без изменений.',
            inputSchema: {},
            entityType: 'call_group',
            handler: async (_args, uid) => {
                const rows = await this.callGroupsService.findAll(uid);
                return { groups: rows.map((row) => this.toListRow(row)) };
            },
        };
    }
    toolCreateCallGroup() {
        return (0, ai_mutation_contract_1.defineMutationTool)({
            name: 'create_call_group',
            description: 'Предлагает создать группу вызова. Члены-абоненты проверяются по тенанту.',
            entityType: 'call_group',
            schemaVersion: SCHEMA_VERSION,
            input: createInput,
            args: createArgs,
            reload: { kind: 'none' },
            propose: async (input, ctx) => {
                const members = this.publicMembers(input.members, ctx.vpbxUserUid);
                const refused = await this.refuseUnknownMembers(members, ctx);
                if (refused)
                    return refused;
                let exten = (0, tenant_public_id_util_1.toPublicExten)(input.exten, ctx.vpbxUserUid);
                const occupied = await this.callGroupsService.checkExtenConflict(exten, ctx.vpbxUserUid);
                let replaced;
                if (occupied) {
                    replaced = exten;
                    exten = await this.callGroupsService.suggestFreeExten(ctx.vpbxUserUid);
                }
                const applyArgs = {
                    name: input.name,
                    exten,
                    strategy: input.strategy ?? 'ringall',
                };
                if (members.length)
                    applyArgs.members = members;
                return this.proposal('create_call_group', `Группа «${applyArgs.name || applyArgs.exten}»`, applyArgs, null, applyArgs, this.createGroupSummary(applyArgs, replaced));
            },
            revalidate: (args, ctx) => this.revalidateCreate(args, ctx),
            apply: async (args, ctx) => {
                await this.callGroupsService.create({
                    ...args,
                    exten: (0, tenant_public_id_util_1.toPublicExten)(args.exten, ctx.vpbxUserUid),
                    members: this.publicMembers(args.members, ctx.vpbxUserUid),
                }, ctx.vpbxUserUid);
            },
        });
    }
    toolUpdateMembers() {
        return (0, ai_mutation_contract_1.defineMutationTool)({
            name: 'update_call_group_members',
            description: 'Предлагает заменить состав группы. В карточке — кого добавляем и кого убираем, не итоговый список.',
            entityType: 'call_group',
            schemaVersion: SCHEMA_VERSION,
            input: updateMembersInput,
            args: updateMembersInput,
            reload: { kind: 'none' },
            propose: async (input, ctx) => {
                const current = await this.callGroupsService.findOne(input.uid, ctx.vpbxUserUid);
                const members = this.publicMembers(input.members, ctx.vpbxUserUid);
                const refused = await this.refuseUnknownMembers(members, ctx);
                if (refused)
                    return refused;
                const beforeValues = memberValues(current.members);
                const afterValues = memberValues(members);
                const added = afterValues.filter((value) => !beforeValues.includes(value));
                const removed = beforeValues.filter((value) => !afterValues.includes(value));
                return this.proposal('update_call_group_members', String(current.name), { uid: input.uid, members }, { members: beforeValues }, { members: afterValues, added, removed }, this.membershipSummary(added, removed));
            },
            revalidate: async (args, ctx) => {
                const owned = await this.requireGroup(args, args.uid, ctx);
                if (!owned.ok)
                    return owned;
                return this.revalidateMembers(args, args.members, ctx);
            },
            apply: async (args, ctx) => {
                await this.callGroupsService.update(args.uid, { members: this.publicMembers(args.members, ctx.vpbxUserUid) }, ctx.vpbxUserUid);
            },
        });
    }
    toolDeleteCallGroup() {
        return (0, ai_mutation_contract_1.defineMutationTool)({
            name: 'delete_call_group',
            description: 'Предлагает удалить группу. В карточке — маршруты и меню, которые на неё звонят.',
            entityType: 'call_group',
            destructive: true,
            schemaVersion: SCHEMA_VERSION,
            input: byUid,
            args: byUid,
            reload: { kind: 'none' },
            propose: async (input, ctx) => {
                const current = await this.callGroupsService.findOne(input.uid, ctx.vpbxUserUid);
                const feeders = await this.feederNames(input.uid, current.exten, ctx.vpbxUserUid);
                const summary = [
                    `Удалить группу ${current.name}`,
                    ...feeders.routes.map((route) => `Маршрут: ${route}`),
                    ...feeders.menus.map((menu) => `Меню: ${menu}`),
                ];
                return this.proposal('delete_call_group', String(current.name), { uid: input.uid }, this.toListRow(current), null, summary);
            },
            revalidate: (args, ctx) => this.requireGroup(args, args.uid, ctx),
            apply: async (args, ctx) => {
                await this.callGroupsService.remove(args.uid, ctx.vpbxUserUid);
            },
        });
    }
    publicMembers(members, uid) {
        return (members ?? []).map((member) => member.member_type === 'internal'
            ? { ...member, value: (0, tenant_public_id_util_1.toPublicExten)(member.value, uid) }
            : member);
    }
    async requireGroup(args, groupUid, ctx) {
        try {
            await this.callGroupsService.findOne(groupUid, ctx.vpbxUserUid);
            return { ok: true, args };
        }
        catch {
            return { ok: false, reason: `Группа ${groupUid} не найдена у тенанта` };
        }
    }
    async revalidateCreate(args, ctx) {
        const membersCheck = await this.revalidateMembers(args, args.members, ctx);
        if (!membersCheck.ok)
            return membersCheck;
        const conflict = await this.callGroupsService.checkExtenConflict(args.exten, ctx.vpbxUserUid);
        if (conflict) {
            return { ok: false, reason: `Номер группы ${args.exten} занят (${conflict.reason})` };
        }
        return { ok: true, args };
    }
    async revalidateMembers(args, members, ctx) {
        const refused = await this.refuseUnknownMembers(this.publicMembers(members, ctx.vpbxUserUid), ctx);
        if (refused)
            return { ok: false, reason: String(refused.message) };
        return { ok: true, args };
    }
    createGroupSummary(args, replaced) {
        const members = (args.members ?? []).map((member) => member.value).filter(Boolean);
        const lines = [
            `Создать группу ${args.name}`,
            replaced
                ? `Номер ${args.exten} (вместо занятого ${replaced})`
                : `Номер ${args.exten}`,
            `Стратегия ${args.strategy}`,
        ];
        if (members.length)
            lines.push(`Участники: ${members.join(', ')}`);
        return lines;
    }
    membershipSummary(added, removed) {
        const lines = [];
        if (added.length)
            lines.push(`Добавить ${added.join(', ')}`);
        if (removed.length)
            lines.push(`Удалить ${removed.join(', ')}`);
        if (lines.length === 0)
            lines.push('Состав группы без изменений');
        return lines;
    }
    async refuseUnknownMembers(members, ctx) {
        const internals = members
            .filter((member) => member.member_type === 'internal')
            .map((member) => member.value.trim())
            .filter(Boolean);
        if (!internals.length)
            return null;
        const endpoints = await this.endpointsService.findAll(ctx.vpbxUserUid);
        const known = new Set([
            ...endpoints.map((row) => String(row.extension)),
            ...(ctx.planned?.extensions ?? []),
        ]);
        const missing = [...new Set(internals.filter((exten) => !known.has(exten)))];
        if (!missing.length)
            return null;
        return {
            refused: true,
            destination: missing[0],
            message: `Абонент ${missing.join(', ')} не найден у тенанта`,
        };
    }
    async feederNames(groupUid, exten, uid) {
        const keys = [groupUid, exten].filter((value) => value != null && value !== '');
        const routes = new Set();
        const menus = new Set();
        for (const key of keys) {
            const usage = await this.routeReferencesService.findUsage('group', key, uid);
            for (const ref of usage.references ?? []) {
                if (ref.routeName)
                    routes.add(ref.routeName);
                if (ref.ivrName)
                    menus.add(ref.ivrName);
            }
        }
        return { routes: [...routes], menus: [...menus] };
    }
    toListRow(row) {
        return {
            uid: row.uid,
            name: row.name,
            exten: row.exten ?? null,
            strategy: row.strategy ?? null,
            members: (row.members ?? []).map((member) => ({
                member_type: member.member_type,
                value: member.member_type === 'internal' ? (0, tenant_public_id_util_1.toPublicExten)(member.value) : member.value,
                position: member.position,
                ring_time: member.ring_time,
            })),
        };
    }
    proposal(tool, label, args, before, after, summary) {
        return {
            entityType: 'call_group',
            entityLabel: label,
            summary,
            before,
            after,
            applyPayload: { tool, args },
            includesDialplanReload: false,
        };
    }
};
exports.CallGroupsAiAdapter = CallGroupsAiAdapter;
exports.CallGroupsAiAdapter = CallGroupsAiAdapter = CallGroupsAiAdapter_1 = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [call_groups_service_1.CallGroupsService,
        ai_adapter_registry_service_1.AiAdapterRegistryService,
        endpoints_service_1.EndpointsService,
        route_references_service_1.RouteReferencesService])
], CallGroupsAiAdapter);
function memberValues(members) {
    return (members ?? []).map((member) => member.value).filter(Boolean);
}
//# sourceMappingURL=call-groups-ai.adapter.js.map