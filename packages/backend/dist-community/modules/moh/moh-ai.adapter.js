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
var MohAiAdapter_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.MohAiAdapter = void 0;
const common_1 = require("@nestjs/common");
const zod_1 = require("zod");
const moh_service_1 = require("./moh.service");
const queues_service_1 = require("../queues/queues.service");
const routes_service_1 = require("../routes/routes.service");
const ai_adapter_registry_service_1 = require("../ai-platform/ai-adapter-registry.service");
const ai_mutation_contract_1 = require("../ai-platform/ai-mutation.contract");
const SCHEMA_VERSION = 'moh-1';
const assignInput = zod_1.z.strictObject({
    target_type: zod_1.z.enum(['queue', 'route']).describe('queue | route'),
    target: zod_1.z.union([zod_1.z.string(), zod_1.z.number()]).describe('Имя очереди или uid маршрута'),
    class_name: zod_1.z.string().min(1).describe('Имя класса музыки тенанта'),
});
const assignArgs = zod_1.z.strictObject({
    target_type: zod_1.z.enum(['queue', 'route']),
    target: zod_1.z.union([zod_1.z.string(), zod_1.z.number()]),
    class_name: zod_1.z.string().min(1),
});
/**
 * MohAiAdapter — hold-music reads and proposal-gated assignment (D-15, D-18).
 * Results are metadata only: no bytes, no fetchable paths (T-15-59).
 */
let MohAiAdapter = MohAiAdapter_1 = class MohAiAdapter {
    mohService;
    registry;
    queuesService;
    routesService;
    logger = new common_1.Logger(MohAiAdapter_1.name);
    domain = 'moh';
    constructor(mohService, registry, queuesService, routesService) {
        this.mohService = mohService;
        this.registry = registry;
        this.queuesService = queuesService;
        this.routesService = routesService;
    }
    onModuleInit() {
        this.registry.register(this);
        this.logger.log('MohAiAdapter registered');
    }
    getTools() {
        return [this.toolListClasses(), this.toolDescribeClass(), this.toolAssignClass()];
    }
    getStateProvider() {
        return { domain: this.domain, buildSummary: (uid) => this.buildSummary(uid) };
    }
    getKnowledgeBlock() {
        return `## Музыка на удержании
- Класс — именованный плейлист тенанта (mode/sort), не файл. Агент описывает и назначает, не загружает.
- Назначение: очередь (musiconhold) или маршрут (options.musiconhold). Чужой класс отвергается до карточки.`;
    }
    async buildSummary(vpbxUserUid) {
        const classes = await this.mohService.findAll(vpbxUserUid);
        if (classes.length === 0)
            return '';
        const names = classes.map((row) => `${row.displayName || row.name} (${row.mode ?? 'playlist'})`).join(', ');
        return `Музыка на удержании: ${names}`;
    }
    toolListClasses() {
        return {
            name: 'list_moh_classes',
            description: 'Список классов музыки на удержании тенанта: режим и число треков. Без аудио.',
            inputSchema: {},
            entityType: 'moh',
            handler: async (_args, uid) => {
                const rows = await this.mohService.findAll(uid);
                return { classes: rows.map((row) => this.toListRow(row)) };
            },
        };
    }
    toolDescribeClass() {
        return {
            name: 'describe_moh_class',
            description: 'Один класс и упорядоченные имена треков. Без байтов и без путей к файлам.',
            inputSchema: { name: { type: 'string', description: 'Имя класса (moh_{tenant}_{slug})' } },
            entityType: 'moh',
            handler: async (args, uid) => {
                const current = await this.mohService.findOne(String(args.name), uid);
                return this.toDescribe(current);
            },
        };
    }
    toolAssignClass() {
        return (0, ai_mutation_contract_1.defineMutationTool)({
            name: 'assign_moh_class',
            description: 'Предлагает назначить класс очереди или маршруту. Класс должен принадлежать тенанту. Загрузка аудио недоступна.',
            entityType: 'moh',
            schemaVersion: SCHEMA_VERSION,
            input: assignInput,
            args: assignArgs,
            reload: { kind: 'none' },
            propose: async (input, ctx) => this.proposeAssign(input, ctx),
            revalidate: async (args, ctx) => this.revalidateAssign(args, ctx),
            apply: async (args, ctx) => this.applyAssign(args, ctx),
        });
    }
    async proposeAssign(input, ctx) {
        const owned = await this.requireOwnedClass(input.class_name, ctx.vpbxUserUid);
        if ('refused' in owned)
            return owned;
        const resolved = await this.resolveTarget(input.target_type, input.target, ctx.vpbxUserUid);
        if ('refused' in resolved)
            return resolved;
        return this.proposal('assign_moh_class', resolved.label, {
            target_type: input.target_type,
            target: resolved.target,
            class_name: input.class_name,
        }, { target: resolved.label, class: resolved.currentClass }, { target: resolved.label, class: input.class_name }, [
            `Назначить ${input.class_name} на ${resolved.label}`,
            `Сейчас: ${resolved.currentClass ?? '—'}`,
            `Будет: ${input.class_name}`,
        ]);
    }
    async revalidateAssign(args, ctx) {
        const owned = await this.requireOwnedClass(args.class_name, ctx.vpbxUserUid);
        if ('refused' in owned) {
            return { ok: false, reason: String(owned.message) };
        }
        const resolved = await this.resolveTarget(args.target_type, args.target, ctx.vpbxUserUid);
        if ('refused' in resolved) {
            return { ok: false, reason: String(resolved.message) };
        }
        return {
            ok: true,
            args: {
                target_type: args.target_type,
                target: resolved.target,
                class_name: args.class_name,
            },
        };
    }
    async applyAssign(args, ctx) {
        if (args.target_type === 'queue') {
            await this.queuesService.update(String(args.target), { musiconhold: args.class_name }, ctx.vpbxUserUid);
            return;
        }
        const route = await this.routesService.findOne(Number(args.target), ctx.vpbxUserUid);
        const options = { ...(route.options ?? {}), musiconhold: args.class_name };
        await this.routesService.update(Number(args.target), { options }, ctx.vpbxUserUid);
    }
    async requireOwnedClass(className, uid) {
        if (!className || /[\\/]/.test(className)) {
            return {
                refused: true,
                destination: className,
                message: `Класс ${className || '(пусто)'} не принадлежит тенанту`,
            };
        }
        try {
            return await this.mohService.findOne(className, uid);
        }
        catch (err) {
            if (err instanceof common_1.NotFoundException) {
                return {
                    refused: true,
                    destination: className,
                    message: `Класс ${className} не принадлежит тенанту`,
                };
            }
            throw err;
        }
    }
    async resolveTarget(targetType, target, uid) {
        if (targetType === 'queue') {
            const name = String(target ?? '');
            try {
                const queue = await this.queuesService.findOne(name, uid);
                return {
                    label: String(queue.display_name || queue.name),
                    target: name,
                    currentClass: queue.musiconhold ? String(queue.musiconhold) : null,
                };
            }
            catch {
                return {
                    refused: true,
                    destination: name,
                    message: `Очередь ${name || '(пусто)'} не принадлежит тенанту`,
                };
            }
        }
        if (targetType === 'route') {
            const routeUid = Number(target);
            try {
                const route = await this.routesService.findOne(routeUid, uid);
                const options = (route.options ?? {});
                return {
                    label: String(route.name || routeUid),
                    target: routeUid,
                    currentClass: options.musiconhold != null ? String(options.musiconhold) : null,
                };
            }
            catch {
                return {
                    refused: true,
                    destination: routeUid,
                    message: `Маршрут ${routeUid} не принадлежит тенанту`,
                };
            }
        }
        return {
            refused: true,
            destination: targetType,
            message: `Назначить можно очередь или маршрут, не ${targetType}`,
        };
    }
    toListRow(row) {
        return {
            name: row.name,
            displayName: row.displayName ?? null,
            mode: row.mode ?? null,
            sort: row.sort ?? null,
            trackCount: (row.entries ?? []).length,
        };
    }
    toDescribe(row) {
        const tracks = [...(row.entries ?? [])]
            .sort((a, b) => Number(a.position ?? 0) - Number(b.position ?? 0))
            .map((entry) => ({
            position: Number(entry.position ?? 0),
            filename: trackFilename(String(entry.entry ?? '')),
        }));
        return {
            name: row.name,
            displayName: row.displayName ?? null,
            mode: row.mode ?? null,
            sort: row.sort ?? null,
            tracks,
        };
    }
    proposal(tool, label, args, before, after, summary) {
        return {
            entityType: 'moh',
            entityLabel: label,
            summary,
            before,
            after,
            applyPayload: { tool, args },
            includesDialplanReload: false,
        };
    }
};
exports.MohAiAdapter = MohAiAdapter;
exports.MohAiAdapter = MohAiAdapter = MohAiAdapter_1 = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [moh_service_1.MohService,
        ai_adapter_registry_service_1.AiAdapterRegistryService,
        queues_service_1.QueuesService,
        routes_service_1.RoutesService])
], MohAiAdapter);
function trackFilename(entry) {
    const parts = entry.replace(/\\/g, '/').split('/');
    return parts[parts.length - 1] || entry;
}
//# sourceMappingURL=moh-ai.adapter.js.map