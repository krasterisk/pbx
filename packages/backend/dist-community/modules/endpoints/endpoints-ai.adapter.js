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
var EndpointsAiAdapter_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.EndpointsAiAdapter = exports.BULK_CREATE_CEILING = void 0;
exports.toExtensionsPattern = toExtensionsPattern;
exports.parseBulkExtensions = parseBulkExtensions;
const common_1 = require("@nestjs/common");
const zod_1 = require("zod");
const tenant_public_id_util_1 = require("../../shared/utils/tenant-public-id.util");
const endpoint_ids_util_1 = require("./endpoint-ids.util");
const endpoints_service_1 = require("./endpoints.service");
const ai_adapter_registry_service_1 = require("../ai-platform/ai-adapter-registry.service");
const ai_mutation_contract_1 = require("../ai-platform/ai-mutation.contract");
const DEFAULT_EXTENSION_START = 200;
/** Documented AI bulk ceiling — refused at tool time (T-15-38). */
exports.BULK_CREATE_CEILING = 50;
const CREDENTIALS_NOTE = 'Учётные данные доступны на экране абонента — пароль в переписку не попадает.';
const SCHEMA_VERSION = 'endpoints-1';
const natProfile = zod_1.z.enum(['lan', 'nat', 'webrtc']);
const createInput = zod_1.z.strictObject({
    extension: zod_1.z.string().optional().describe('Номер абонента. Если не указан — следующий свободный у тенанта.'),
    name: zod_1.z.string().optional().describe('Отображаемое имя'),
    displayName: zod_1.z.string().optional().describe('Псевдоним для name'),
    context: zod_1.z.string().optional().describe('Контекст маршрутизации. Если не указан — контекст существующих абонентов.'),
    codecs: zod_1.z.string().optional(),
    natProfile: natProfile.optional(),
    department: zod_1.z.string().optional(),
});
const createArgs = zod_1.z.strictObject({
    extension: zod_1.z.string().min(1),
    context: zod_1.z.string().min(1),
    displayName: zod_1.z.string().min(1),
    codecs: zod_1.z.string().optional(),
    natProfile: natProfile.optional(),
    department: zod_1.z.string().optional(),
});
const bulkInput = zod_1.z.strictObject({
    extensionsPattern: zod_1.z.string().optional().describe('Паттерн: "200-220" или "201,205,210-215"'),
    startExtension: zod_1.z.string().optional().describe('Стартовый номер, если задан count'),
    count: zod_1.z
        .number()
        .int()
        .positive()
        .optional()
        .describe(`Сколько абонентов создать от startExtension. Максимум ${exports.BULK_CREATE_CEILING}.`),
    context: zod_1.z.string().optional(),
    displayNamePattern: zod_1.z.string().optional().describe('Шаблон имени: "Абонент {N}"'),
    codecs: zod_1.z.string().optional(),
    natProfile: natProfile.optional(),
});
const bulkArgs = zod_1.z.strictObject({
    extensionsPattern: zod_1.z.string().min(1),
    context: zod_1.z.string().min(1),
    passwordPattern: zod_1.z.literal('auto'),
    displayNamePattern: zod_1.z.string().min(1),
    codecs: zod_1.z.string().optional(),
    natProfile: natProfile.optional(),
});
const deleteInput = zod_1.z.strictObject({
    sipId: zod_1.z.string().min(1).describe('Внутренний номер абонента, 2–8 цифр'),
});
const deleteArgs = deleteInput;
/**
 * EndpointsAiAdapter — subscriber (SIP endpoint) mutations as proposals (D-18).
 * Credential generation lives in EndpointsService, never in this layer, and no
 * schema here accepts a password: a secret the model invented must not survive
 * into a confirmation card.
 */
let EndpointsAiAdapter = EndpointsAiAdapter_1 = class EndpointsAiAdapter {
    endpointsService;
    registry;
    logger = new common_1.Logger(EndpointsAiAdapter_1.name);
    domain = 'endpoints';
    constructor(endpointsService, registry) {
        this.endpointsService = endpointsService;
        this.registry = registry;
    }
    onModuleInit() {
        this.registry.register(this);
        this.logger.log('EndpointsAiAdapter registered');
    }
    getTools() {
        return [
            this.toolListEndpoints(),
            this.toolCreateEndpoint(),
            this.toolCreateEndpointsBulk(),
            this.toolDeleteEndpoint(),
        ];
    }
    getStateProvider() {
        return { domain: this.domain, buildSummary: (uid) => this.buildSummary(uid) };
    }
    getKnowledgeBlock() {
        return `## Абоненты (Endpoints)
- Сначала list_endpoints с фильтром названных номеров (101-103). Не выгружай весь список. Не утверждай, что номера нет, по sample снимка. create_endpoints_bulk сам пропустит уже существующие.
- В инструментах только публичный номер (101), не SIP id.
- Пароль на экране абонента, не в чате.`;
    }
    async buildSummary(vpbxUserUid) {
        const endpoints = await this.endpointsService.findAll(vpbxUserUid);
        if (endpoints.length === 0)
            return '';
        return `Абоненты: ${endpoints.length}`;
    }
    toolListEndpoints() {
        return {
            name: 'list_endpoints',
            description: 'Точечная проверка абонентов: всегда передавай extensions ("101-103" или "101,102"). '
                + 'Без фильтра вернётся только счётчик и короткий образец, не весь список. Без SIP id и без изменений.',
            inputSchema: {
                extensions: { type: 'string', description: 'Обязателен, если номера названы: "101-103" или "101,102"' },
            },
            entityType: 'endpoint',
            handler: async (args, uid) => {
                const rows = await this.endpointsService.findAll(uid);
                const mapped = rows.map((row) => ({
                    extension: (0, tenant_public_id_util_1.toPublicExten)(row.extension ?? '', uid),
                    name: displayNameFrom(row) || (0, tenant_public_id_util_1.toPublicExten)(row.extension ?? '', uid),
                    context: row.context ?? null,
                }));
                const wanted = args.extensions
                    ? parseBulkExtensions(String(args.extensions))
                    : null;
                if (wanted) {
                    const found = new Set(mapped.map((row) => row.extension));
                    return {
                        endpoints: mapped.filter((row) => wanted.includes(row.extension)),
                        missing: wanted.filter((extension) => !found.has(extension)),
                    };
                }
                const limit = 15;
                return {
                    total: mapped.length,
                    endpoints: mapped.slice(0, limit),
                    truncated: mapped.length > limit,
                };
            },
        };
    }
    toolCreateEndpoint() {
        return (0, ai_mutation_contract_1.defineMutationTool)({
            name: 'create_endpoint',
            description: 'Предлагает создать одного SIP-абонента. Номер и контекст по умолчанию берутся из абонентов тенанта. Пароль не возвращается.',
            entityType: 'endpoint',
            schemaVersion: SCHEMA_VERSION,
            input: createInput,
            args: createArgs,
            reload: { kind: 'none' },
            propose: async (input, ctx) => {
                const existing = await this.endpointsService.findAll(ctx.vpbxUserUid);
                const extension = (0, tenant_public_id_util_1.toPublicExten)(input.extension ?? this.nextFreeExtension(existing), ctx.vpbxUserUid);
                const context = input.context ?? this.defaultContext(existing);
                const displayName = input.name ?? input.displayName ?? `Абонент ${extension}`;
                const applyArgs = { extension, context, displayName };
                if (input.codecs)
                    applyArgs.codecs = input.codecs;
                if (input.natProfile)
                    applyArgs.natProfile = input.natProfile;
                if (input.department)
                    applyArgs.department = input.department;
                return this.proposal('create_endpoint', displayName, applyArgs, null, { extension, context, displayName }, [`Создать абонента ${extension} в контексте ${context}`, CREDENTIALS_NOTE]);
            },
            revalidate: async (args, ctx) => {
                const taken = await this.takenExtensions(ctx);
                if (taken.has(args.extension)) {
                    return { ok: false, reason: `Номер ${args.extension} уже занят у тенанта` };
                }
                return { ok: true, args };
            },
            apply: async (args, ctx) => {
                await this.endpointsService.createWithGeneratedCredentials(args, ctx.vpbxUserUid);
            },
        });
    }
    toolCreateEndpointsBulk() {
        return (0, ai_mutation_contract_1.defineMutationTool)({
            name: 'create_endpoints_bulk',
            description: `Предлагает создать пачку SIP-абонентов по паттерну или count+startExtension. Один proposal на всю пачку. Потолок ${exports.BULK_CREATE_CEILING}.`,
            entityType: 'endpoint',
            schemaVersion: SCHEMA_VERSION,
            input: bulkInput,
            args: bulkArgs,
            reload: { kind: 'none' },
            propose: async (input, ctx) => {
                const existing = await this.endpointsService.findAll(ctx.vpbxUserUid);
                const context = input.context ?? this.defaultContext(existing);
                const pattern = this.bulkPatternFrom(input);
                const extensions = parseBulkExtensions(pattern);
                const refused = this.refuseBadBatch(extensions);
                if (refused)
                    return refused;
                const taken = await this.takenExtensions(ctx);
                const missing = extensions.filter((extension) => !taken.has(extension));
                if (missing.length === 0) {
                    return {
                        skipped: true,
                        message: `Абоненты ${extensions.join(', ')} уже есть — создавать не нужно.`,
                        already: extensions,
                    };
                }
                const namePattern = input.displayNamePattern ?? 'Абонент {N}';
                const perItem = missing.map((extension) => `${extension} — ${namePattern.replace(/\{N\}/g, extension)}`);
                const applyArgs = {
                    extensionsPattern: toExtensionsPattern(missing),
                    context,
                    passwordPattern: 'auto',
                    displayNamePattern: namePattern,
                };
                if (input.codecs)
                    applyArgs.codecs = input.codecs;
                if (input.natProfile)
                    applyArgs.natProfile = input.natProfile;
                const already = extensions.filter((extension) => taken.has(extension));
                const summary = [
                    `Создать ${missing.length} абонентов в контексте ${context}`,
                    ...perItem,
                ];
                if (already.length) {
                    summary.push(`Уже есть, пропускаю: ${already.join(', ')}`);
                }
                summary.push(CREDENTIALS_NOTE);
                return this.proposal('create_endpoints_bulk', missing.join(', '), applyArgs, null, { total: missing.length, extensions: missing, context, already }, summary);
            },
            revalidate: async (args, ctx) => {
                const extensions = parseBulkExtensions(args.extensionsPattern);
                if (this.refuseBadBatch(extensions)) {
                    return { ok: false, reason: `Пакет вне допустимого размера (потолок ${exports.BULK_CREATE_CEILING})` };
                }
                const taken = await this.takenExtensions(ctx);
                const collisions = extensions.filter((extension) => taken.has(extension));
                if (collisions.length) {
                    return { ok: false, reason: `Номера уже заняты у тенанта: ${collisions.join(', ')}` };
                }
                return { ok: true, args };
            },
            apply: async (args, ctx) => {
                await this.endpointsService.bulkCreate(args, ctx.vpbxUserUid);
            },
        });
    }
    toolDeleteEndpoint() {
        return (0, ai_mutation_contract_1.defineMutationTool)({
            name: 'delete_endpoint',
            description: 'Предлагает удалить SIP-абонента по внутреннему номеру. Деструктивная операция, только внутри тенанта.',
            entityType: 'endpoint',
            destructive: true,
            schemaVersion: SCHEMA_VERSION,
            input: deleteInput,
            args: deleteArgs,
            reload: { kind: 'none' },
            propose: async (input, ctx) => {
                const sipId = await this.resolveSipId(input.sipId, ctx.vpbxUserUid);
                const current = await this.endpointsService.findOne(sipId, ctx.vpbxUserUid);
                const extension = String(current.extension ?? sipId);
                const displayName = displayNameFrom(current) || extension;
                return this.proposal('delete_endpoint', displayName, { sipId }, { extension, displayName, sipId }, null, [`Удалить абонента ${extension} (${displayName})`]);
            },
            revalidate: async (args, ctx) => {
                try {
                    await this.endpointsService.findOne(args.sipId, ctx.vpbxUserUid);
                    return { ok: true, args };
                }
                catch {
                    return { ok: false, reason: `Абонент ${args.sipId} не найден у тенанта` };
                }
            },
            apply: async (args, ctx) => {
                await this.endpointsService.remove(args.sipId, ctx.vpbxUserUid);
            },
        });
    }
    refuseBadBatch(extensions) {
        if (extensions.length > exports.BULK_CREATE_CEILING) {
            return {
                refused: true,
                ceiling: exports.BULK_CREATE_CEILING,
                message: `Пакет больше ${exports.BULK_CREATE_CEILING} абонентов. Потолок: ${exports.BULK_CREATE_CEILING}.`,
            };
        }
        if (extensions.length === 0) {
            return { refused: true, message: 'Пустой или некорректный паттерн абонентов.' };
        }
        return null;
    }
    async takenExtensions(ctx) {
        const existing = await this.endpointsService.findAll(ctx.vpbxUserUid);
        return new Set(existing.map((row) => (0, tenant_public_id_util_1.toPublicExten)(row.extension ?? '', ctx.vpbxUserUid)));
    }
    async resolveSipId(raw, uid) {
        const value = raw.trim();
        if (/^ew?.+_\d+$/i.test(value))
            return value;
        const publicExt = (0, tenant_public_id_util_1.toPublicExten)(value, uid);
        const existing = await this.endpointsService.findAll(uid);
        const match = existing.find((row) => String(row.extension) === publicExt);
        if (match?.sipUsername)
            return String(match.sipUsername);
        return (0, endpoint_ids_util_1.buildSipId)(uid, publicExt || value);
    }
    bulkPatternFrom(input) {
        if (input.extensionsPattern)
            return input.extensionsPattern;
        const start = parseInt(String(input.startExtension ?? ''), 10);
        const count = input.count;
        if (!Number.isNaN(start) && count != null) {
            return `${start}-${start + count - 1}`;
        }
        return '';
    }
    nextFreeExtension(existing) {
        let max = DEFAULT_EXTENSION_START - 1;
        for (const row of existing) {
            const numeric = parseInt(String(row.extension ?? ''), 10);
            if (!Number.isNaN(numeric) && numeric > max)
                max = numeric;
        }
        return String(max + 1);
    }
    defaultContext(existing) {
        const fromTenant = existing.find((row) => row.context)?.context;
        return fromTenant || 'from-internal';
    }
    proposal(tool, label, args, before, after, summary) {
        return {
            entityType: 'endpoint',
            entityLabel: label,
            summary,
            before,
            after,
            applyPayload: { tool, args },
            includesDialplanReload: false,
        };
    }
};
exports.EndpointsAiAdapter = EndpointsAiAdapter;
exports.EndpointsAiAdapter = EndpointsAiAdapter = EndpointsAiAdapter_1 = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [endpoints_service_1.EndpointsService,
        ai_adapter_registry_service_1.AiAdapterRegistryService])
], EndpointsAiAdapter);
function toExtensionsPattern(extensions) {
    const nums = [...new Set(extensions.map((value) => parseInt(value, 10)).filter((n) => !Number.isNaN(n)))]
        .sort((a, b) => a - b);
    if (nums.length === 0)
        return '';
    const parts = [];
    let start = nums[0];
    let prev = nums[0];
    for (let i = 1; i <= nums.length; i += 1) {
        const current = nums[i];
        if (current === prev + 1) {
            prev = current;
            continue;
        }
        parts.push(start === prev ? String(start) : `${start}-${prev}`);
        start = current;
        prev = current;
    }
    return parts.join(',');
}
function parseBulkExtensions(pattern) {
    const parsed = new Set();
    const parts = (pattern || '').split(',').map((part) => part.trim());
    for (const part of parts) {
        if (!part)
            continue;
        if (part.includes('-')) {
            const [startStr, endStr] = part.split('-');
            const start = parseInt(startStr, 10);
            const end = parseInt(endStr, 10);
            if (!Number.isNaN(start) && !Number.isNaN(end) && start <= end) {
                for (let i = start; i <= end; i += 1)
                    parsed.add(i);
            }
        }
        else {
            const num = parseInt(part, 10);
            if (!Number.isNaN(num))
                parsed.add(num);
        }
    }
    return Array.from(parsed)
        .sort((a, b) => a - b)
        .map(String);
}
function displayNameFrom(current) {
    const callerid = current.endpoint?.callerid ?? current.callerid ?? '';
    const quoted = callerid.match(/"([^"]+)"/);
    if (quoted?.[1])
        return quoted[1];
    return String(current.extension ?? '');
}
//# sourceMappingURL=endpoints-ai.adapter.js.map