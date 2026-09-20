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
var TenantSettingsAiAdapter_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.TenantSettingsAiAdapter = exports.TENANT_SETTINGS_ALLOW_LIST = void 0;
exports.assertWritableKey = assertWritableKey;
exports.toTenantSettingsView = toTenantSettingsView;
const common_1 = require("@nestjs/common");
const zod_1 = require("zod");
const tenant_settings_service_1 = require("./tenant-settings.service");
const tenant_settings_keys_1 = require("./tenant-settings.keys");
const ai_adapter_registry_service_1 = require("../ai-platform/ai-adapter-registry.service");
const ai_mutation_contract_1 = require("../ai-platform/ai-mutation.contract");
/**
 * Explicit allow list — never project settings by subtracting known secrets (T-15-77).
 * Presence-only entries are secret-valued: configured / not configured, never the value.
 * Only `kind: 'value'` keys may be written by the agent.
 */
exports.TENANT_SETTINGS_ALLOW_LIST = [
    { key: 'routes.show_raw_dialplan', area: 'routes', kind: 'value' },
    { key: 'routes.show_flowchart', area: 'routes', kind: 'value' },
    { key: 'integrations.provider_token', area: 'integrations', kind: 'presence' },
];
const WRITABLE_KEYS = new Set(exports.TENANT_SETTINGS_ALLOW_LIST.filter((entry) => entry.kind === 'value').map((entry) => entry.key));
const FORBIDDEN_IDENTITY_KEYS = new Set([
    'tenant.name',
    'tenant.number',
    'tenant.identity',
    'billing',
    'provisioning',
]);
const updateInput = zod_1.z.strictObject({
    key: zod_1.z.string().min(1),
    value: zod_1.z.union([zod_1.z.boolean(), zod_1.z.number(), zod_1.z.string()]),
});
/**
 * TenantSettingsAiAdapter — allowlisted reads and value-only writes.
 * Identity / provisioning / secrets remain forbidden at schema and service levels.
 */
let TenantSettingsAiAdapter = TenantSettingsAiAdapter_1 = class TenantSettingsAiAdapter {
    tenantSettings;
    registry;
    logger = new common_1.Logger(TenantSettingsAiAdapter_1.name);
    domain = 'tenant-settings';
    constructor(tenantSettings, registry) {
        this.tenantSettings = tenantSettings;
        this.registry = registry;
    }
    onModuleInit() {
        this.registry.register(this);
        this.logger.log('TenantSettingsAiAdapter registered');
    }
    getTools() {
        return [this.toolGetTenantSettings(), this.toolUpdateTenantSetting()];
    }
    getStateProvider() {
        return { domain: this.domain, buildSummary: (uid) => this.buildSummary(uid) };
    }
    getKnowledgeBlock() {
        return `## Настройки тенанта
- Флаги маршрутов (сырой dialplan, блок-схема) объясняют, почему UI или генерация ведёт себя иначе, чем ожидалось.
- Секретные значения показываются только как configured / not configured.
- Агент может менять только allowlisted value-флаги (не identity, billing, provisioning, secrets).`;
    }
    async buildSummary(vpbxUserUid) {
        const view = toTenantSettingsView(await this.tenantSettings.getAll(vpbxUserUid));
        if (view.areas.length === 0)
            return '';
        const flags = view.areas
            .flatMap((group) => group.settings)
            .filter((row) => 'value' in row)
            .map((row) => `${row.key}=${String(row.value)}`);
        return flags.length ? `Настройки: ${flags.join(', ')}` : '';
    }
    toolGetTenantSettings() {
        return {
            name: 'get_tenant_settings',
            description: 'Настройки тенанта по областям с текущими значениями. Секреты — только configured/not configured.',
            inputSchema: {},
            entityType: 'tenant_setting',
            handler: async (_args, uid) => {
                const stored = await this.tenantSettings.getAll(uid);
                return toTenantSettingsView(stored);
            },
        };
    }
    toolUpdateTenantSetting() {
        return (0, ai_mutation_contract_1.defineMutationTool)({
            name: 'update_tenant_setting',
            description: 'Изменяет allowlisted value-флаг тенанта (например routes.show_flowchart). Секреты и identity запрещены.',
            entityType: 'tenant_setting',
            schemaVersion: 'tenant-settings-1',
            input: updateInput,
            args: updateInput,
            reload: { kind: 'none' },
            propose: async (input) => {
                assertWritableKey(input.key);
                return {
                    entityType: 'tenant_setting',
                    entityLabel: input.key,
                    summary: [`Установить ${input.key}=${String(input.value)}`],
                    before: null,
                    after: { key: input.key, value: input.value },
                    applyPayload: { tool: 'update_tenant_setting', args: input },
                    includesDialplanReload: false,
                };
            },
            revalidate: async (args) => {
                try {
                    assertWritableKey(args.key);
                    return { ok: true, args };
                }
                catch (err) {
                    return { ok: false, reason: err?.message ?? String(err) };
                }
            },
            apply: async (args, ctx) => {
                await this.tenantSettings.setMany(ctx.vpbxUserUid, { [args.key]: args.value });
            },
        });
    }
};
exports.TenantSettingsAiAdapter = TenantSettingsAiAdapter;
exports.TenantSettingsAiAdapter = TenantSettingsAiAdapter = TenantSettingsAiAdapter_1 = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [tenant_settings_service_1.TenantSettingsService,
        ai_adapter_registry_service_1.AiAdapterRegistryService])
], TenantSettingsAiAdapter);
function assertWritableKey(key) {
    if (FORBIDDEN_IDENTITY_KEYS.has(key) || key.startsWith('tenant.') || key.startsWith('billing.')) {
        throw new Error(`TENANT_SETTING_FORBIDDEN:${key}`);
    }
    if (!WRITABLE_KEYS.has(key) || !(key in tenant_settings_keys_1.TENANT_SETTING_KEYS)) {
        throw new Error(`TENANT_SETTING_NOT_ALLOWLISTED:${key}`);
    }
}
function toTenantSettingsView(stored) {
    const byArea = new Map();
    for (const entry of exports.TENANT_SETTINGS_ALLOW_LIST) {
        const rows = byArea.get(entry.area) ?? [];
        if (entry.kind === 'presence') {
            const raw = stored[entry.key];
            rows.push({ key: entry.key, configured: isConfigured(raw) });
        }
        else {
            rows.push({ key: entry.key, value: stored[entry.key] });
        }
        byArea.set(entry.area, rows);
    }
    return {
        areas: [...byArea.entries()].map(([area, settings]) => ({ area, settings })),
    };
}
function isConfigured(value) {
    if (value === undefined || value === null)
        return false;
    if (typeof value === 'string')
        return value.trim().length > 0;
    return true;
}
//# sourceMappingURL=tenant-settings-ai.adapter.js.map