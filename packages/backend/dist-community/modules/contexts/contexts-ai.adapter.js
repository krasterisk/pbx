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
var ContextsAiAdapter_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.ContextsAiAdapter = void 0;
const common_1 = require("@nestjs/common");
const zod_1 = require("zod");
const contexts_service_1 = require("./contexts.service");
const ai_adapter_registry_service_1 = require("../ai-platform/ai-adapter-registry.service");
const ai_mutation_contract_1 = require("../ai-platform/ai-mutation.contract");
const SCHEMA_VERSION = 'contexts-1';
const createInput = zod_1.z.strictObject({
    name: zod_1.z.string().min(1).max(64),
    comment: zod_1.z.string().max(255).optional(),
});
const updateInput = zod_1.z.strictObject({
    uid: zod_1.z.number().int().positive(),
    name: zod_1.z.string().min(1).max(64).optional(),
    comment: zod_1.z.string().max(255).optional(),
});
const byUid = zod_1.z.strictObject({
    uid: zod_1.z.number().int().positive(),
});
/**
 * ContextsAiAdapter — list + CRUD mutations for routing contexts (tenant UI parity).
 */
let ContextsAiAdapter = ContextsAiAdapter_1 = class ContextsAiAdapter {
    contextsService;
    registry;
    logger = new common_1.Logger(ContextsAiAdapter_1.name);
    domain = 'contexts';
    constructor(contextsService, registry) {
        this.contextsService = contextsService;
        this.registry = registry;
    }
    onModuleInit() {
        this.registry.register(this);
        this.logger.log('ContextsAiAdapter registered');
    }
    getTools() {
        return [
            this.toolListContexts(),
            this.toolCreateContext(),
            this.toolUpdateContext(),
            this.toolDeleteContext(),
        ];
    }
    getStateProvider() {
        return { domain: this.domain, buildSummary: (uid) => this.buildSummary(uid) };
    }
    getKnowledgeBlock() {
        return `## Контексты маршрутизации
- Контекст — именованный контейнер маршрутов тенанта. create_route требует uid контекста из list_contexts.
- Имя в Asterisk суффиксируется идентификатором тенанта; агент оперирует uid и отображаемым name, не сырым dialplan-именем.
- Контекст принадлежит ровно одному тенанту. Список всегда фильтруется параметром вызова, не аргументом модели.
- Не выдумывай UID контекста — создай через create_context или возьми из list_contexts.`;
    }
    async buildSummary(vpbxUserUid) {
        const contexts = await this.contextsService.findAll(vpbxUserUid);
        if (contexts.length === 0)
            return '';
        const names = contexts.map((context) => context.name).join(', ');
        return `Контексты: ${names}`;
    }
    toolListContexts() {
        return {
            name: 'list_contexts',
            description: 'Возвращает все контексты маршрутизации с UID. Используй перед create_route.',
            inputSchema: {},
            entityType: 'context',
            handler: async (_args, uid) => {
                const contexts = await this.contextsService.findAll(uid);
                return {
                    contexts: contexts.map((context) => ({
                        uid: context.uid,
                        name: context.name,
                        comment: context.comment,
                    })),
                };
            },
        };
    }
    toolCreateContext() {
        return (0, ai_mutation_contract_1.defineMutationTool)({
            name: 'create_context',
            description: 'Создаёт контекст маршрутизации. Нужны name и опциональный comment.',
            entityType: 'context',
            schemaVersion: SCHEMA_VERSION,
            input: createInput,
            args: createInput,
            reload: { kind: 'none' },
            propose: async (input) => this.proposal('create_context', input.name, input, null, input, [
                `Создать контекст «${input.name}»`,
            ]),
            revalidate: async (args) => ({ ok: true, args }),
            apply: async (args, ctx) => {
                await this.contextsService.create(args, ctx.vpbxUserUid);
            },
        });
    }
    toolUpdateContext() {
        return (0, ai_mutation_contract_1.defineMutationTool)({
            name: 'update_context',
            description: 'Изменяет имя или комментарий контекста по uid.',
            entityType: 'context',
            schemaVersion: SCHEMA_VERSION,
            input: updateInput,
            args: updateInput,
            reload: { kind: 'none' },
            propose: async (input, ctx) => {
                const current = await this.contextsService.findOne(input.uid, ctx.vpbxUserUid);
                return this.proposal('update_context', current.name, input, { uid: current.uid, name: current.name, comment: current.comment }, { uid: current.uid, name: input.name ?? current.name, comment: input.comment ?? current.comment }, [`Изменить контекст «${current.name}»`]);
            },
            revalidate: (args, ctx) => this.requireContext(args, args.uid, ctx),
            apply: async (args, ctx) => {
                const { uid, ...rest } = args;
                await this.contextsService.update(uid, rest, ctx.vpbxUserUid);
            },
        });
    }
    toolDeleteContext() {
        return (0, ai_mutation_contract_1.defineMutationTool)({
            name: 'delete_context',
            description: 'Удаляет контекст по uid. Деструктивная операция.',
            entityType: 'context',
            destructive: true,
            schemaVersion: SCHEMA_VERSION,
            input: byUid,
            args: byUid,
            reload: { kind: 'none' },
            propose: async (input, ctx) => {
                const current = await this.contextsService.findOne(input.uid, ctx.vpbxUserUid);
                return this.proposal('delete_context', current.name, input, { uid: current.uid, name: current.name, comment: current.comment }, null, [`Удалить контекст «${current.name}»`]);
            },
            revalidate: (args, ctx) => this.requireContext(args, args.uid, ctx),
            apply: async (args, ctx) => {
                await this.contextsService.remove(args.uid, ctx.vpbxUserUid);
            },
        });
    }
    async requireContext(args, uid, ctx) {
        try {
            await this.contextsService.findOne(uid, ctx.vpbxUserUid);
            return { ok: true, args };
        }
        catch (err) {
            return { ok: false, reason: err?.message ?? 'context not found' };
        }
    }
    proposal(tool, label, args, before, after, summary) {
        return {
            entityType: 'context',
            entityLabel: label,
            summary,
            before,
            after,
            applyPayload: { tool, args },
            includesDialplanReload: false,
        };
    }
};
exports.ContextsAiAdapter = ContextsAiAdapter;
exports.ContextsAiAdapter = ContextsAiAdapter = ContextsAiAdapter_1 = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [contexts_service_1.ContextsService,
        ai_adapter_registry_service_1.AiAdapterRegistryService])
], ContextsAiAdapter);
//# sourceMappingURL=contexts-ai.adapter.js.map