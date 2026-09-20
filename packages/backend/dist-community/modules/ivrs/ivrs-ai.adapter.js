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
var __param = (this && this.__param) || function (paramIndex, decorator) {
    return function (target, key) { decorator(target, key, paramIndex); }
};
var IvrsAiAdapter_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.IvrsAiAdapter = void 0;
const common_1 = require("@nestjs/common");
const zod_1 = require("zod");
const tenant_public_id_util_1 = require("../../shared/utils/tenant-public-id.util");
const ivrs_service_1 = require("./ivrs.service");
const contexts_service_1 = require("../contexts/contexts.service");
const endpoints_service_1 = require("../endpoints/endpoints.service");
const queues_service_1 = require("../queues/queues.service");
const call_groups_service_1 = require("../call-groups/call-groups.service");
const tts_engines_service_1 = require("../tts-engines/tts-engines.service");
const tts_engines_ai_adapter_1 = require("../tts-engines/tts-engines-ai.adapter");
const ai_adapter_registry_service_1 = require("../ai-platform/ai-adapter-registry.service");
const ivr_menu_actions_util_1 = require("./ivr-menu-actions.util");
const ai_mutation_contract_1 = require("../ai-platform/ai-mutation.contract");
const SCHEMA_VERSION = 'ivrs-1';
/** Dialplan action params are deliberately open; tenant aliases are rejected recursively at parse. */
const actionSchema = zod_1.z.record(zod_1.z.string(), zod_1.z.unknown());
const destinationSchema = zod_1.z.strictObject({
    kind: zod_1.z.enum(['context', 'extension', 'queue', 'menu', 'group']),
    target: zod_1.z.union([zod_1.z.string(), zod_1.z.number()]),
});
const menuItemInput = zod_1.z.strictObject({
    digit: zod_1.z.union([zod_1.z.string(), zod_1.z.number()]),
    actions: zod_1.z.array(actionSchema).optional(),
    destination: destinationSchema.optional(),
});
const promptInput = zod_1.z.strictObject({
    kind: zod_1.z.string().optional(),
    text: zod_1.z.string().optional(),
    engine_uid: zod_1.z.number().int().min(0).optional(),
});
const menuItemArgs = zod_1.z.strictObject({
    digit: zod_1.z.string(),
    actions: zod_1.z.array(actionSchema),
});
const promptArgs = zod_1.z.strictObject({
    kind: zod_1.z.string(),
    text: zod_1.z.string().optional(),
    engine_uid: zod_1.z.number().int().min(0),
});
const createInput = zod_1.z.strictObject({
    timeout: zod_1.z.number().int().min(1).max(120).optional().describe('Сколько секунд ждать нажатия после приветствия'),
    name: zod_1.z.string().min(1).describe('Имя меню'),
    prompts: zod_1.z.array(promptInput).optional().describe('Приветствие [{kind: tts, text, engine_uid}]'),
    text: zod_1.z.string().optional().describe('Текст TTS-приветствия, если prompts не переданы'),
    engine_uid: zod_1.z.number().int().min(0).optional().describe('Не передавай: сервер сам выберет движок по имени'),
    engine: zod_1.z.string().optional().describe('Имя TTS-движка из list_tts_engines, не uid'),
    menu_items: zod_1.z
        .array(menuItemInput)
        .optional()
        .describe('[{digit, actions|destination}] цепочка пункта как в редакторе маршрутов; destination = первый шаг; t часто togroup затем totrunk/hangup'),
    steps: zod_1.z.array(menuItemInput).optional().describe('Псевдоним menu_items'),
});
const createArgs = zod_1.z.strictObject({
    timeout: zod_1.z.number().int().min(1).max(120).optional(),
    name: zod_1.z.string().min(1),
    menu_items: zod_1.z.array(menuItemArgs),
    prompts: zod_1.z.array(promptArgs).optional(),
});
const updateInput = zod_1.z.strictObject({
    timeout: zod_1.z.number().int().min(1).max(120).optional().describe('Сколько секунд ждать нажатия после приветствия'),
    id: zod_1.z.number().int().positive().describe('UID меню из list_ivrs / get_pbx_state'),
    name: zod_1.z.string().optional(),
    description: zod_1.z.string().optional(),
    digit: zod_1.z.union([zod_1.z.string(), zod_1.z.number()]).optional().describe('Одна цифра для замены назначения'),
    destination: destinationSchema
        .optional()
        .describe('{kind: context|extension|queue|menu|group, target}'),
    prompts: zod_1.z.array(promptInput).optional(),
    text: zod_1.z.string().optional(),
    engine_uid: zod_1.z.number().int().min(0).optional(),
    menu_items: zod_1.z.array(menuItemInput).optional(),
    steps: zod_1.z.array(menuItemInput).optional(),
});
const updateArgs = zod_1.z.strictObject({
    timeout: zod_1.z.number().int().min(1).max(120).optional(),
    id: zod_1.z.number().int().positive(),
    menu_items: zod_1.z.array(menuItemArgs),
    name: zod_1.z.string().optional(),
    prompts: zod_1.z.array(promptArgs).optional(),
});
const byId = zod_1.z.strictObject({ id: zod_1.z.number().int().positive().describe('UID меню') });
/**
 * IvrsAiAdapter — voice-menu mutations as proposals (D-18, D-27).
 * Update is always proposal-gated: a digit change rewrites inbound routing.
 */
let IvrsAiAdapter = IvrsAiAdapter_1 = class IvrsAiAdapter {
    ivrsService;
    registry;
    contextsService;
    endpointsService;
    queuesService;
    callGroupsService;
    ttsEngines;
    logger = new common_1.Logger(IvrsAiAdapter_1.name);
    domain = 'ivrs';
    constructor(ivrsService, registry, contextsService, endpointsService, queuesService, callGroupsService, ttsEngines) {
        this.ivrsService = ivrsService;
        this.registry = registry;
        this.contextsService = contextsService;
        this.endpointsService = endpointsService;
        this.queuesService = queuesService;
        this.callGroupsService = callGroupsService;
        this.ttsEngines = ttsEngines;
    }
    onModuleInit() {
        this.registry.register(this);
        this.logger.log('IvrsAiAdapter registered');
    }
    getTools() {
        return [this.toolListIvrs(), this.toolCreateIvr(), this.toolUpdateIvr(), this.toolDeleteIvr()];
    }
    getStateProvider() {
        return { domain: this.domain, buildSummary: (uid) => this.buildSummary(uid) };
    }
    getKnowledgeBlock() {
        return `## Голосовые меню (IVR)
- Цифра — цепочка действий того же редактора, что у маршрутов (DialplanAppsEditor). destination {kind,target} = только первый шаг. Абонент — kind extension (toexten). Таймаут t обычно начинается с kind group (togroup).
- После группы внешний номер / почта / сброс — следующие actions (totrunk, voicemail, hangup), не overflow группы и не «замени группу очередью». Перед нетривиальной цепочкой — list_dialplan_apps(host=ivr).
- «группа 101-103» = одна группа с членами 101–103. Приветствие — prompts TTS, не description. Текст и карту цифр из любой реплики треда не переспрашивай.`;
    }
    async buildSummary(vpbxUserUid) {
        const menus = await this.ivrsService.findAll(vpbxUserUid);
        if (menus.length === 0)
            return '';
        const names = menus.map((menu) => menu.name || `#${menu.uid}`).join(', ');
        return `Голосовые меню: ${names}`;
    }
    toolListIvrs() {
        return {
            name: 'list_ivrs',
            description: 'Список голосовых меню тенанта с картой цифр и назначениями. Без изменений.',
            inputSchema: {},
            entityType: 'ivr',
            handler: async (_args, uid) => {
                const rows = await this.ivrsService.findAll(uid);
                return {
                    menus: rows.map((row) => ({
                        uid: row.uid,
                        name: row.name,
                        timeout: row.timeout,
                        digits: digitMapOf(row.menu_items),
                    })),
                };
            },
        };
    }
    toolCreateIvr() {
        return (0, ai_mutation_contract_1.defineMutationTool)({
            name: 'create_ivr',
            description: 'Предлагает создать голосовое меню. Каждая цифра должна указывать на существующее назначение тенанта.',
            entityType: 'ivr',
            schemaVersion: SCHEMA_VERSION,
            input: createInput,
            args: createArgs,
            reload: { kind: 'none' },
            propose: async (input, ctx) => {
                const uid = ctx.vpbxUserUid;
                const catalog = this.mergePlanned(await this.loadCatalog(uid), ctx.planned);
                const normalized = this.normalizeProposedMenu(input.menu_items ?? input.steps, catalog, uid, 'create_ivr');
                if (normalized.refused)
                    return normalized.refused;
                const menuItems = normalized.items;
                const prompts = await this.resolvePrompts(input, uid);
                const applyArgs = {
                    name: input.name,
                    menu_items: menuItems,
                };
                if (prompts.length)
                    applyArgs.prompts = toApplyPrompts(prompts);
                if (input.timeout !== undefined)
                    applyArgs.timeout = input.timeout;
                const summary = summarizeCreateIvr(applyArgs.name, prompts, menuItems, catalog);
                return this.proposal('create_ivr', `Меню «${input.name || 'IVR'}»`, applyArgs, null, {
                    name: applyArgs.name,
                    digits: publicDigitMapOf(menuItems, catalog),
                    greeting: prompts[0]?.text ?? null,
                    voice: prompts[0]?.engineName ?? null,
                    timeout: applyArgs.timeout ?? 10,
                }, summary);
            },
            revalidate: (args, ctx) => this.revalidateMenu(args, args.menu_items, ctx, 'create_ivr'),
            apply: async (args, ctx) => {
                const created = await this.ivrsService.create({ ...args,
                    ...(args.timeout === undefined ? {} : { timeout: String(args.timeout) }),
                }, ctx.vpbxUserUid, ctx.isAdmin);
                return created ? { uid: created.uid, name: created.name } : undefined;
            },
        });
    }
    toolUpdateIvr() {
        return (0, ai_mutation_contract_1.defineMutationTool)({
            name: 'update_ivr',
            description: 'Предлагает изменить голосовое меню. Смена цифры — изменение маршрутизации, не безопасная правка. Назначение должно существовать у тенанта.',
            entityType: 'ivr',
            schemaVersion: SCHEMA_VERSION,
            input: updateInput,
            args: updateArgs,
            reload: { kind: 'none' },
            propose: async (input, ctx) => {
                const uid = ctx.vpbxUserUid;
                const id = input.id;
                const current = await this.ivrsService.findOne(id, uid);
                const catalog = this.mergePlanned(await this.loadCatalog(uid), ctx.planned);
                const currentItems = (0, ivr_menu_actions_util_1.asIvrMenuItems)(current.menu_items);
                const normalized = this.normalizeProposedMenu(this.nextMenuItems(currentItems, input), catalog, uid, 'update_ivr');
                if (normalized.refused)
                    return normalized.refused;
                const nextItems = normalized.items;
                const applyArgs = { id, menu_items: nextItems };
                if (input.timeout !== undefined)
                    applyArgs.timeout = input.timeout;
                if (input.name)
                    applyArgs.name = input.name;
                const prompts = await this.resolvePrompts(input, uid);
                if (prompts.length)
                    applyArgs.prompts = toApplyPrompts(prompts);
                const digit = input.digit != null ? String(input.digit) : changedDigit(currentItems, nextItems);
                const oldDest = digit ? destinationOfDigit(currentItems, digit) : null;
                const newDest = digit ? destinationOfDigit(nextItems, digit) : null;
                const summary = digit
                    ? [
                        `Цифра ${digit}: ${formatDest(oldDest)} → ${formatDest(newDest)}`,
                    ]
                    : [`Изменить голосовое меню ${current.name || id}`];
                return this.proposal('update_ivr', String(current.name || id), applyArgs, { ...(digit ? { digit, target: oldDest?.target ?? null, kind: oldDest?.kind ?? null } : { digits: digitMapOf(currentItems) }), timeout: current.timeout ?? 10 }, { ...(digit ? { digit, target: newDest?.target ?? null, kind: newDest?.kind ?? null } : { digits: digitMapOf(nextItems) }), timeout: input.timeout ?? current.timeout ?? 10 }, summary);
            },
            revalidate: async (args, ctx) => {
                const owned = await this.requireIvr(args, args.id, ctx);
                if (!owned.ok)
                    return owned;
                return this.revalidateMenu(args, args.menu_items, ctx, 'update_ivr');
            },
            apply: async (args, ctx) => {
                const { id, ...rest } = args;
                await this.ivrsService.update(id, { ...rest,
                    ...(rest.timeout === undefined ? {} : { timeout: String(rest.timeout) }),
                }, ctx.vpbxUserUid, ctx.isAdmin);
            },
        });
    }
    toolDeleteIvr() {
        return (0, ai_mutation_contract_1.defineMutationTool)({
            name: 'delete_ivr',
            description: 'Предлагает удалить голосовое меню по UID. Деструктивно, только внутри тенанта.',
            entityType: 'ivr',
            destructive: true,
            schemaVersion: SCHEMA_VERSION,
            input: byId,
            args: byId,
            reload: { kind: 'none' },
            propose: async (input, ctx) => {
                const current = await this.ivrsService.findOne(input.id, ctx.vpbxUserUid);
                return this.proposal('delete_ivr', String(current.name || input.id), { id: input.id }, { uid: current.uid, name: current.name, digits: digitMapOf(current.menu_items) }, null, [`Удалить голосовое меню ${current.name || input.id}`]);
            },
            revalidate: (args, ctx) => this.requireIvr(args, args.id, ctx),
            apply: async (args, ctx) => {
                await this.ivrsService.remove(args.id, ctx.vpbxUserUid);
            },
        });
    }
    async requireIvr(args, id, ctx) {
        try {
            await this.ivrsService.findOne(id, ctx.vpbxUserUid);
            return { ok: true, args };
        }
        catch {
            return { ok: false, reason: `Голосовое меню ${id} не найдено у тенанта` };
        }
    }
    /**
     * Confirm-time healing: the canonical menu is re-resolved against the catalog as
     * it is now, so a destination deleted between proposal and confirmation stops the
     * write instead of persisting a dead digit.
     */
    async revalidateMenu(args, menuItems, ctx, tool) {
        const catalog = await this.loadCatalog(ctx.vpbxUserUid);
        const normalized = this.normalizeProposedMenu(menuItems, catalog, ctx.vpbxUserUid, tool);
        if (normalized.refused) {
            return { ok: false, reason: String(normalized.refused.message) };
        }
        return { ok: true, args: { ...args, menu_items: normalized.items } };
    }
    nextMenuItems(current, args) {
        if (args.menu_items != null || args.steps != null) {
            return (0, ivr_menu_actions_util_1.asIvrMenuItems)(args.menu_items ?? args.steps);
        }
        if (args.digit != null && args.destination) {
            const digit = String(args.digit);
            const dest = (0, ivr_menu_actions_util_1.asIvrDestination)(args.destination);
            const action = (0, ivr_menu_actions_util_1.actionFromIvrDestination)(dest, { digit });
            const replaced = current.map((item) => String(item.digit) === digit ? { digit, actions: [action] } : item);
            if (!replaced.some((item) => String(item.digit) === digit)) {
                replaced.push({ digit, actions: [action] });
            }
            return replaced;
        }
        return current;
    }
    normalizeProposedMenu(raw, catalog, uid, tool) {
        const resolved = resolveMenuItems((0, ivr_menu_actions_util_1.asIvrMenuItems)(raw), catalog);
        const normalized = (0, ivr_menu_actions_util_1.normalizeIvrMenuItems)(resolved, uid);
        if (normalized.aliases.length) {
            this.logger.warn(`${tool} tenant=${uid} rewritten action types: ${JSON.stringify(normalized.aliases)}`);
        }
        if (normalized.unmapped.length) {
            this.logger.warn(`${tool} tenant=${uid} refused unknown action types: ${JSON.stringify(normalized.unmapped)}`);
            return {
                items: normalized.items,
                refused: {
                    refused: true,
                    message: `Неизвестный тип действия диалплана: ${normalized.unmapped.map((row) => row.type).join(', ')}. Нужны типы редактора маршрутов: toexten, togroup, toqueue, toivr, toroute, totrunk, voicemail, hangup, playback.`,
                },
            };
        }
        const refused = refuseMissingDestinations(normalized.items, catalog);
        if (refused)
            return { items: normalized.items, refused };
        this.logger.log(`${tool} tenant=${uid} menu=${(0, ivr_menu_actions_util_1.summarizeIvrMenu)(normalized.items)}`);
        return { items: normalized.items };
    }
    async resolvePrompts(args, uid) {
        const prompts = asPrompts(args);
        if (!prompts.length)
            return prompts;
        const picked = await this.pickTtsEngine(uid, args);
        return prompts.map((prompt) => {
            if (Number(prompt.engine_uid) > 0 && !args.engine) {
                return { ...prompt, engineName: picked?.name };
            }
            if (!picked)
                return prompt;
            return { ...prompt, engine_uid: picked.uid, engineName: picked.name };
        });
    }
    async pickTtsEngine(uid, args) {
        if (!this.ttsEngines)
            return null;
        const rows = await this.ttsEngines.findAll(uid);
        const views = rows
            .map((row) => ({ row, view: (0, tts_engines_ai_adapter_1.toSpeechEngineView)(row) }))
            .filter((item) => item.view.enabled && (0, tts_engines_ai_adapter_1.isSpeechEngineConfigured)(item.row));
        const named = typeof args.engine === 'string' ? args.engine.trim().toLowerCase() : '';
        if (named) {
            const hit = views.find((item) => item.view.name.trim().toLowerCase() === named)
                ?? rows.find((row) => String(row.name ?? '').trim().toLowerCase() === named);
            if (hit && 'view' in hit)
                return { uid: Number(hit.row.uid), name: hit.view.name };
            if (hit && 'uid' in hit)
                return { uid: Number(hit.uid), name: String(hit.name ?? '') };
        }
        const requested = Number(args.engine_uid);
        if (requested > 0) {
            const hit = views.find((item) => Number(item.row.uid) === requested);
            if (hit)
                return { uid: requested, name: hit.view.name };
        }
        if (views.length === 0)
            return null;
        const yandex = views.find((item) => /yandex/i.test(item.view.name) || /yandex/i.test(String(item.view.vendor ?? '')));
        const chosen = yandex ?? views[0];
        return { uid: Number(chosen.row.uid), name: chosen.view.name };
    }
    mergePlanned(catalog, planned) {
        if (!planned)
            return catalog;
        return {
            ...catalog,
            endpoints: [
                ...catalog.endpoints,
                ...planned.extensions.map((extension) => ({ extension })),
            ],
            groups: [
                ...catalog.groups,
                ...planned.groups.map((group) => ({ name: group.name, exten: group.exten })),
            ],
            queues: [
                ...catalog.queues,
                ...planned.queues.map((queue) => ({ name: queue.name, exten: queue.exten })),
            ],
        };
    }
    async loadCatalog(uid) {
        const [menus, contexts, endpoints, queues, groups] = await Promise.all([
            this.ivrsService.findAll(uid),
            this.contextsService.findAll(uid),
            this.endpointsService.findAll(uid),
            this.queuesService.findAll(uid),
            this.callGroupsService.findAll(uid),
        ]);
        return { menus, contexts, endpoints, queues, groups };
    }
    proposal(tool, label, args, before, after, summary) {
        return {
            entityType: 'ivr',
            entityLabel: label,
            summary,
            before,
            after,
            applyPayload: { tool, args },
            includesDialplanReload: false,
        };
    }
};
exports.IvrsAiAdapter = IvrsAiAdapter;
exports.IvrsAiAdapter = IvrsAiAdapter = IvrsAiAdapter_1 = __decorate([
    (0, common_1.Injectable)(),
    __param(6, (0, common_1.Optional)()),
    __metadata("design:paramtypes", [ivrs_service_1.IvrsService,
        ai_adapter_registry_service_1.AiAdapterRegistryService,
        contexts_service_1.ContextsService,
        endpoints_service_1.EndpointsService,
        queues_service_1.QueuesService,
        call_groups_service_1.CallGroupsService,
        tts_engines_service_1.TtsEnginesService])
], IvrsAiAdapter);
function asPrompts(args) {
    if (Array.isArray(args.prompts)) {
        return args.prompts
            .filter((row) => row && typeof row === 'object')
            .map((row) => {
            const rec = row;
            return {
                kind: String(rec.kind || 'tts'),
                text: rec.text != null ? String(rec.text) : undefined,
                engine_uid: rec.engine_uid != null ? Number(rec.engine_uid) : 0,
            };
        });
    }
    const text = args.text != null ? String(args.text).trim() : '';
    if (!text)
        return [];
    return [{ kind: 'tts', text, engine_uid: args.engine_uid != null ? Number(args.engine_uid) : 0 }];
}
function toApplyPrompts(prompts) {
    return prompts.map((prompt) => ({
        kind: prompt.kind,
        ...(prompt.text != null ? { text: prompt.text } : {}),
        engine_uid: Number(prompt.engine_uid ?? 0),
    }));
}
function resolveMenuItems(items, catalog) {
    return items.map((item) => {
        const dest = (0, ivr_menu_actions_util_1.destinationFromIvrActions)(item.actions);
        if (!dest || dest.kind !== 'group')
            return item;
        const group = resolveGroup(catalog, dest.target);
        if (!group?.uid)
            return item;
        let replaced = false;
        const actions = item.actions.map((action, index) => {
            if (replaced || String(action.type ?? '') !== 'togroup')
                return action;
            replaced = true;
            return (0, ivr_menu_actions_util_1.actionFromIvrDestination)({ kind: 'group', target: String(group.uid) }, { digit: item.digit, index });
        });
        return { digit: item.digit, actions };
    });
}
function refuseMissingDestinations(items, catalog) {
    for (const item of items) {
        const dest = (0, ivr_menu_actions_util_1.destinationFromIvrActions)(item.actions);
        if (!dest)
            continue;
        if (!catalogResolves(catalog, dest)) {
            return {
                refused: true,
                digit: String(item.digit),
                destination: dest.target,
                message: `Цифра ${item.digit} указывает на несуществующее назначение ${dest.target}`,
            };
        }
    }
    return null;
}
function resolveGroup(catalog, target) {
    return catalog.groups.find((group) => String(group.uid) === target
        || group.name === target
        || String(group.exten) === target);
}
function digitMapOf(items) {
    const map = {};
    for (const item of (0, ivr_menu_actions_util_1.asIvrMenuItems)(items)) {
        const dest = (0, ivr_menu_actions_util_1.destinationFromIvrActions)(item.actions);
        map[item.digit] = dest ?? { kind: 'none' };
    }
    return map;
}
function destinationOfDigit(items, digit) {
    const item = items.find((row) => String(row.digit) === digit);
    return item ? (0, ivr_menu_actions_util_1.destinationFromIvrActions)(item.actions) : null;
}
function catalogResolves(catalog, dest) {
    const target = dest.target;
    if (!target)
        return false;
    if (dest.kind === 'queue') {
        const publicTarget = (0, tenant_public_id_util_1.toPublicExten)(target);
        return catalog.queues.some((queue) => queue.name === target
            || String(queue.exten) === target
            || String(queue.exten) === publicTarget
            || (0, tenant_public_id_util_1.toPublicExten)(queue.name) === publicTarget);
    }
    if (dest.kind === 'extension') {
        const publicTarget = (0, tenant_public_id_util_1.toPublicExten)(target);
        return catalog.endpoints.some((row) => String(row.extension) === target
            || String(row.sipUsername) === target
            || String(row.extension) === publicTarget
            || (0, tenant_public_id_util_1.toPublicExten)(row.sipUsername) === publicTarget);
    }
    if (dest.kind === 'menu') {
        return catalog.menus.some((menu) => String(menu.uid) === target || menu.name === target);
    }
    if (dest.kind === 'context') {
        return catalog.contexts.some((context) => String(context.uid) === target || context.name === target);
    }
    if (dest.kind === 'group') {
        return !!resolveGroup(catalog, target);
    }
    return false;
}
function changedDigit(before, after) {
    const beforeMap = new Map(before.map((item) => [String(item.digit), JSON.stringify(item.actions)]));
    for (const item of after) {
        if (beforeMap.get(String(item.digit)) !== JSON.stringify(item.actions)) {
            return String(item.digit);
        }
    }
    return null;
}
function formatDest(dest) {
    if (!dest)
        return 'нет';
    return formatIvrRoute(dest.kind, dest.target);
}
function kindLabel(kind) {
    if (kind === 'extension')
        return 'абонент';
    if (kind === 'group')
        return 'группа';
    if (kind === 'queue')
        return 'очередь';
    if (kind === 'menu')
        return 'меню';
    if (kind === 'context')
        return 'контекст';
    return kind;
}
function formatIvrRoute(kind, target) {
    return `${kindLabel(kind)} ${target}`.trim();
}
function digitLabel(digit) {
    if (digit === 't')
        return 'таймаут';
    if (digit === 'i')
        return 'ошибка ввода';
    return digit;
}
function publicDest(dest, catalog) {
    if (dest.kind === 'group' && catalog) {
        const group = resolveGroup(catalog, dest.target);
        return { kind: 'group', target: String(group?.exten || group?.name || dest.target) };
    }
    if (dest.kind === 'extension') {
        return { kind: 'extension', target: (0, tenant_public_id_util_1.toPublicExten)(dest.target) };
    }
    return dest;
}
function publicDigitMapOf(items, catalog) {
    const map = {};
    for (const item of (0, ivr_menu_actions_util_1.asIvrMenuItems)(items)) {
        const dest = (0, ivr_menu_actions_util_1.destinationFromIvrActions)(item.actions);
        map[item.digit] = dest ? publicDest(dest, catalog) : { kind: 'none' };
    }
    return map;
}
function summarizeCreateIvr(name, prompts, items, catalog) {
    const lines = [`Создать голосовое меню ${name}`];
    const greeting = prompts[0]?.text?.trim();
    if (greeting)
        lines.push(`Приветствие: ${greeting}`);
    if (prompts[0]?.engineName) {
        lines.push(`Голос: ${prompts[0].engineName}`);
    }
    else if (prompts[0] && !Number(prompts[0].engine_uid)) {
        lines.push('Голосовой движок не настроен в кабинете — фразу можно повесить на экране меню.');
    }
    for (const item of items) {
        const dest = (0, ivr_menu_actions_util_1.destinationFromIvrActions)(item.actions);
        if (!dest)
            continue;
        const shown = publicDest(dest, catalog);
        lines.push(`${digitLabel(item.digit)} → ${formatIvrRoute(shown.kind, shown.target)}`);
    }
    return lines;
}
//# sourceMappingURL=ivrs-ai.adapter.js.map