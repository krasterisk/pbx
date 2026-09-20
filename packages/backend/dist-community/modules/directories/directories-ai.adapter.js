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
var DirectoriesAiAdapter_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.DirectoriesAiAdapter = void 0;
const common_1 = require("@nestjs/common");
const zod_1 = require("zod");
const shared_1 = require("@krasterisk/shared");
const directories_service_1 = require("./directories.service");
const ai_adapter_registry_service_1 = require("../ai-platform/ai-adapter-registry.service");
const ai_mutation_contract_1 = require("../ai-platform/ai-mutation.contract");
const SCHEMA_VERSION = 'directories-1';
const keyNormalization = zod_1.z.enum(shared_1.DIRECTORY_KEY_NORMALIZATIONS);
const fieldSchema = zod_1.z.strictObject({
    key: zod_1.z.string().min(1).describe('Ключ поля, по нему пишутся значения записей'),
    label: zod_1.z.string().min(1).describe('Отображаемое имя поля'),
    type: zod_1.z.enum(['string', 'phone', 'number', 'boolean']).default('string'),
    required: zod_1.z.boolean().default(false),
    position: zod_1.z.number().int().min(0).default(0),
});
const recordSchema = zod_1.z.strictObject({
    match_kind: zod_1.z.enum(['exact', 'asterisk_pattern']).optional(),
    priority: zod_1.z.number().int().min(0).optional(),
    values: zod_1.z
        .record(zod_1.z.string(), zod_1.z.union([zod_1.z.string(), zod_1.z.number(), zod_1.z.boolean()]))
        .describe('Значения по ключам полей справочника'),
    comment: zod_1.z.string().optional(),
});
const directoryShape = {
    name: zod_1.z.string().min(1).describe('Название справочника'),
    description: zod_1.z.string().optional(),
    lookupFieldKey: zod_1.z.string().min(1).describe('Ключ поля поиска'),
    key_normalization: keyNormalization.optional().describe('none | digits | ru_8_to_7'),
    fields: zod_1.z.array(fieldSchema).optional().describe('Схема полей справочника'),
    records: zod_1.z.array(recordSchema).optional(),
};
const createInput = zod_1.z.strictObject(directoryShape);
const createArgs = zod_1.z.strictObject({
    ...directoryShape,
    key_normalization: keyNormalization.default('digits'),
    fields: zod_1.z.array(fieldSchema).default([]),
});
const updateInput = zod_1.z.strictObject({
    uid: zod_1.z.number().int().positive().describe('UID справочника'),
    ...directoryShape,
    name: zod_1.z.string().min(1).optional(),
    lookupFieldKey: zod_1.z.string().min(1).optional(),
});
const updateArgs = updateInput;
const byUid = zod_1.z.strictObject({ uid: zod_1.z.number().int().positive().describe('UID справочника') });
const addRecordsInput = zod_1.z.strictObject({
    uid: zod_1.z.number().int().positive().describe('UID справочника'),
    records: zod_1.z.array(recordSchema).min(1).describe('[{values, match_kind?, priority?, comment?}]'),
});
const removeRecordsInput = zod_1.z.strictObject({
    uid: zod_1.z.number().int().positive().describe('UID справочника'),
    lookup_values: zod_1.z.array(zod_1.z.string()).optional().describe('Значения ключа поиска для удаления'),
    record_uids: zod_1.z.array(zod_1.z.number().int()).optional().describe('UID записей для удаления'),
});
/**
 * DirectoriesAiAdapter — Domain AI Adapter for universal dialplan directories.
 *
 * Seven tools, registered through AiAdapterRegistryService and consumed by
 * both MCP discovery and generic webhook dispatch. Every handler receives
 * `vpbxUserUid` as a call parameter — never closed over.
 *
 * The five mutating tools carry an executable contract: the strict schema the
 * model is shown is the schema their arguments are parsed with, and the write
 * that a confirmation performs lives here rather than in a central switch.
 */
let DirectoriesAiAdapter = DirectoriesAiAdapter_1 = class DirectoriesAiAdapter {
    directoriesService;
    registry;
    logger = new common_1.Logger(DirectoriesAiAdapter_1.name);
    domain = 'directories';
    constructor(directoriesService, registry) {
        this.directoriesService = directoriesService;
        this.registry = registry;
    }
    onModuleInit() {
        this.registry.register(this);
        this.logger.log('DirectoriesAiAdapter registered');
    }
    getTools() {
        return [
            this.toolListDirectories(),
            this.toolCreateDirectory(),
            this.toolUpdateDirectory(),
            this.toolDeleteDirectory(),
            this.toolListDirectoryRecords(),
            this.toolAddDirectoryRecords(),
            this.toolRemoveDirectoryRecords(),
        ];
    }
    getStateProvider() {
        return { domain: this.domain, buildSummary: (uid) => this.buildSummary(uid) };
    }
    getKnowledgeBlock() {
        return `## Справочники (Directories) — модель данных
- Справочник = схема полей + записи. Поведение задаётся привязкой к маршруту, не самой сущностью.
- Ключ поиска всегда явный (key source): original_caller, current_caller, route_pattern, variable, fixed. CALLERID(num) сам по себе ключом не является.
- Точное совпадение (exact) всегда проверяется раньше паттерна (asterisk_pattern). При нескольких паттернах побеждает меньший priority, затем меньший uid.
- Ссылки на поля идут по числовым field UID, не по display name. В management API записи пишутся ключами полей (field key), runtime lookup читает field_uids.
- Исходы lookup: FOUND, NOT_FOUND, ERROR. Технический ERROR — fail-open: исходный CallerID и значения канала сохраняются, on_no_match не выполняется.
- Один HTTP-запрос возвращает все запрошенные field UID записи. Глобального пространства переменных по ключу записи нет.`;
    }
    async buildSummary(vpbxUserUid) {
        const directories = await this.directoriesService.findAll(vpbxUserUid);
        if (directories.length === 0)
            return '';
        const lines = ['Справочники (Directories):'];
        for (const directory of directories) {
            const fieldsCount = (directory.fields || []).length;
            const recordsCount = (directory.records || []).length;
            const desc = directory.description ? ` (${directory.description})` : '';
            lines.push(`  • "${directory.name}"${desc}: ${fieldsCount} полей, ${recordsCount} записей`);
        }
        return lines.join('\n');
    }
    toolListDirectories() {
        return {
            name: 'list_directories',
            description: 'Список справочников тенанта: uid, имя, описание, поля, число записей. Полные записи — через list_directory_records.',
            inputSchema: {},
            entityType: 'directory',
            handler: async (_args, uid) => {
                const directories = await this.directoriesService.findAll(uid);
                return {
                    directories: directories.map((directory) => ({
                        uid: directory.uid,
                        name: directory.name,
                        description: directory.description,
                        lookup_field_uid: directory.lookup_field_uid,
                        key_normalization: directory.key_normalization,
                        fieldsCount: (directory.fields || []).length,
                        recordsCount: (directory.records || []).length,
                        fields: (directory.fields || []).map((field) => ({
                            uid: field.uid,
                            key: field.key,
                            label: field.label,
                            type: field.type,
                        })),
                    })),
                };
            },
        };
    }
    toolCreateDirectory() {
        return (0, ai_mutation_contract_1.defineMutationTool)({
            name: 'create_directory',
            description: 'Создаёт справочник. Нужны name, lookupFieldKey, key_normalization, fields. records опциональны.',
            entityType: 'directory',
            schemaVersion: SCHEMA_VERSION,
            input: createInput,
            args: createArgs,
            reload: { kind: 'none' },
            propose: async (input) => this.proposal('create_directory', input.name, input, null, {
                name: input.name,
                lookupFieldKey: input.lookupFieldKey,
            }, [`Создать справочник «${input.name}»`]),
            revalidate: async (args) => ({ ok: true, args }),
            apply: async (args, ctx) => {
                await this.directoriesService.create(args, ctx.vpbxUserUid);
            },
        });
    }
    toolUpdateDirectory() {
        return (0, ai_mutation_contract_1.defineMutationTool)({
            name: 'update_directory',
            description: 'Изменяет справочник. records полностью заменяет текущий список. Для добавления записей используй add_directory_records.',
            entityType: 'directory',
            schemaVersion: SCHEMA_VERSION,
            input: updateInput,
            args: updateArgs,
            reload: { kind: 'none' },
            propose: async (input, ctx) => {
                const current = await this.directoriesService.findOne(input.uid, ctx.vpbxUserUid);
                const { uid: _ignored, ...rest } = input;
                return this.proposal('update_directory', current.name, input, this.summary(current), { ...this.summary(current), ...rest }, [`Изменить справочник «${current.name}»`]);
            },
            revalidate: (args, ctx) => this.requireDirectory(args, args.uid, ctx),
            apply: async (args, ctx) => {
                const { uid: directoryUid, ...rest } = args;
                await this.directoriesService.update(directoryUid, rest, ctx.vpbxUserUid);
            },
        });
    }
    toolDeleteDirectory() {
        return (0, ai_mutation_contract_1.defineMutationTool)({
            name: 'delete_directory',
            description: 'Удаляет справочник, если на него нет ссылок в маршрутах и действиях. Деструктивная операция.',
            entityType: 'directory',
            destructive: true,
            schemaVersion: SCHEMA_VERSION,
            input: byUid,
            args: byUid,
            reload: { kind: 'none' },
            propose: async (input, ctx) => {
                const current = await this.directoriesService.findOne(input.uid, ctx.vpbxUserUid);
                return this.proposal('delete_directory', current.name, input, this.summary(current), null, [`Удалить справочник «${current.name}»`]);
            },
            revalidate: (args, ctx) => this.requireDirectory(args, args.uid, ctx),
            apply: async (args, ctx) => {
                await this.directoriesService.remove(args.uid, ctx.vpbxUserUid);
            },
        });
    }
    toolListDirectoryRecords() {
        return {
            name: 'list_directory_records',
            description: 'Полные записи справочника (values по ключам полей).',
            inputSchema: { uid: { type: 'number', description: 'UID справочника' } },
            entityType: 'directory',
            handler: async (args, uid) => {
                const directory = await this.directoriesService.findOne(Number(args.uid), uid);
                return { uid: directory.uid, records: directory.records ?? [] };
            },
        };
    }
    toolAddDirectoryRecords() {
        return (0, ai_mutation_contract_1.defineMutationTool)({
            name: 'add_directory_records',
            description: 'Добавляет записи инкрементально. Существующие записи сохраняются.',
            entityType: 'directory',
            schemaVersion: SCHEMA_VERSION,
            input: addRecordsInput,
            args: addRecordsInput,
            reload: { kind: 'none' },
            propose: async (input, ctx) => {
                const current = await this.directoriesService.findOne(input.uid, ctx.vpbxUserUid);
                const merged = [...(current.records ?? []), ...input.records];
                return this.proposal('add_directory_records', current.name, input, { recordsCount: (current.records ?? []).length }, { recordsCount: merged.length }, [`Добавить ${input.records.length} записей в «${current.name}»`]);
            },
            revalidate: (args, ctx) => this.requireDirectory(args, args.uid, ctx),
            apply: async (args, ctx) => {
                // Merge against the list as it stands now, not as it stood when the card
                // was built, so a record added meanwhile is not silently dropped.
                const current = await this.directoriesService.findOne(args.uid, ctx.vpbxUserUid);
                const merged = [...this.toRecordDtos(current.records ?? []), ...args.records];
                await this.directoriesService.update(args.uid, { records: merged }, ctx.vpbxUserUid);
            },
        });
    }
    toolRemoveDirectoryRecords() {
        return (0, ai_mutation_contract_1.defineMutationTool)({
            name: 'remove_directory_records',
            description: 'Удаляет записи по lookup_values или record_uids. Деструктивная операция.',
            entityType: 'directory',
            destructive: true,
            schemaVersion: SCHEMA_VERSION,
            input: removeRecordsInput,
            args: removeRecordsInput,
            reload: { kind: 'none' },
            propose: async (input, ctx) => {
                const current = await this.directoriesService.findOne(input.uid, ctx.vpbxUserUid);
                const remaining = this.keepRecords(current.records ?? [], input);
                return this.proposal('remove_directory_records', current.name, input, { recordsCount: (current.records ?? []).length }, { recordsCount: remaining.length }, [`Удалить записи из «${current.name}»`]);
            },
            revalidate: (args, ctx) => this.requireDirectory(args, args.uid, ctx),
            apply: async (args, ctx) => {
                const current = await this.directoriesService.findOne(args.uid, ctx.vpbxUserUid);
                const remaining = this.keepRecords(current.records ?? [], args);
                await this.directoriesService.update(args.uid, { records: this.toRecordDtos(remaining) }, ctx.vpbxUserUid);
            },
        });
    }
    keepRecords(records, args) {
        const lookupValues = new Set((args.lookup_values ?? []).map(String));
        const recordUids = new Set((args.record_uids ?? []).map(Number));
        return records.filter((record) => {
            if (recordUids.has(record.uid))
                return false;
            if (lookupValues.has(String(record.lookup_value)))
                return false;
            return true;
        });
    }
    /** Confirm-time check: the directory the card names still belongs to this tenant. */
    async requireDirectory(args, directoryUid, ctx) {
        try {
            await this.directoriesService.findOne(directoryUid, ctx.vpbxUserUid);
            return { ok: true, args };
        }
        catch {
            return { ok: false, reason: `Справочник ${directoryUid} не найден у тенанта` };
        }
    }
    toRecordDtos(records) {
        return records.map((record) => ({
            match_kind: record.match_kind,
            priority: record.priority,
            values: (record.values ?? {}),
            comment: record.comment,
        }));
    }
    summary(directory) {
        return {
            uid: directory.uid,
            name: directory.name,
            fieldsCount: (directory.fields || []).length,
            recordsCount: (directory.records || []).length,
        };
    }
    proposal(tool, label, args, before, after, summary) {
        return {
            entityType: 'directory',
            entityLabel: label,
            summary,
            before,
            after,
            applyPayload: { tool, args },
            includesDialplanReload: false,
        };
    }
};
exports.DirectoriesAiAdapter = DirectoriesAiAdapter;
exports.DirectoriesAiAdapter = DirectoriesAiAdapter = DirectoriesAiAdapter_1 = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [directories_service_1.DirectoriesService,
        ai_adapter_registry_service_1.AiAdapterRegistryService])
], DirectoriesAiAdapter);
//# sourceMappingURL=directories-ai.adapter.js.map