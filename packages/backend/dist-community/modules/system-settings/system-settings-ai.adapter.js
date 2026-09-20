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
var SystemSettingsAiAdapter_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.SystemSettingsAiAdapter = exports.PLATFORM_TENANT_PROJECTION = void 0;
exports.toPlatformSettingsView = toPlatformSettingsView;
const common_1 = require("@nestjs/common");
const system_settings_service_1 = require("./system-settings.service");
const ai_adapter_registry_service_1 = require("../ai-platform/ai-adapter-registry.service");
/**
 * Explicit tenant-facing projection — a new platform setting is invisible until listed (T-15-78).
 * Never pass through findAll() or getServerConfigRaw().
 */
exports.PLATFORM_TENANT_PROJECTION = [
    {
        key: 'recordings_available',
        explanation: 'Whether this tenant can play call recordings from stored files',
    },
    {
        key: 'recordings_tenant_prefix',
        explanation: 'Relative recordings prefix for this tenant, not the server store root',
    },
    {
        key: 'webhook_configured',
        explanation: 'Whether outbound webhooks are configured; the secret is never returned',
    },
];
/**
 * SystemSettingsAiAdapter — tenant-scoped projection of platform settings (D-15, D-22).
 * Safety comes from the projection itself: there is no tenant column to filter on.
 */
let SystemSettingsAiAdapter = SystemSettingsAiAdapter_1 = class SystemSettingsAiAdapter {
    systemSettings;
    registry;
    logger = new common_1.Logger(SystemSettingsAiAdapter_1.name);
    domain = 'system-settings';
    constructor(systemSettings, registry) {
        this.systemSettings = systemSettings;
        this.registry = registry;
    }
    onModuleInit() {
        this.registry.register(this);
        this.logger.log('SystemSettingsAiAdapter registered');
    }
    getTools() {
        return [this.toolGetPlatformSettings()];
    }
    getStateProvider() {
        return { domain: this.domain, buildSummary: (uid) => this.buildSummary(uid) };
    }
    getKnowledgeBlock() {
        return `## Платформенные настройки (проекция тенанта)
- Агент видит только лимиты и возможности своего тенанта: записи, префикс хранения, наличие webhook.
- Сырая таблица system_settings, пути сервера и секреты в ответ не входят. Писать платформенные настройки нельзя.`;
    }
    async buildSummary(vpbxUserUid) {
        const config = await this.systemSettings.getServerConfig();
        const view = toPlatformSettingsView(config, vpbxUserUid);
        const recordings = view.settings.find((row) => row.key === 'recordings_available');
        const available = recordings && 'value' in recordings ? recordings.value : false;
        return `Записи: ${available ? 'доступны' : 'недоступны'}`;
    }
    toolGetPlatformSettings() {
        return {
            name: 'get_platform_settings',
            description: 'Лимиты и возможности платформы для вызывающего тенанта. Не сырая таблица настроек. Секреты и чужие квоты недоступны. Изменить нельзя.',
            inputSchema: {},
            entityType: 'system_setting',
            handler: async (_args, uid) => {
                const config = await this.systemSettings.getServerConfig();
                return toPlatformSettingsView(config, uid);
            },
        };
    }
};
exports.SystemSettingsAiAdapter = SystemSettingsAiAdapter;
exports.SystemSettingsAiAdapter = SystemSettingsAiAdapter = SystemSettingsAiAdapter_1 = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [system_settings_service_1.SystemSettingsService,
        ai_adapter_registry_service_1.AiAdapterRegistryService])
], SystemSettingsAiAdapter);
function toPlatformSettingsView(config, vpbxUserUid) {
    const recordingsAvailable = Boolean(config.records_base_url && String(config.records_base_url).trim());
    const webhookConfigured = isWebhookConfigured(config.webhook_secret);
    const values = {
        recordings_available: {
            key: 'recordings_available',
            value: recordingsAvailable,
            explanation: explanationOf('recordings_available'),
        },
        recordings_tenant_prefix: {
            key: 'recordings_tenant_prefix',
            value: `${vpbxUserUid}/`,
            explanation: explanationOf('recordings_tenant_prefix'),
        },
        webhook_configured: {
            key: 'webhook_configured',
            configured: webhookConfigured,
            explanation: explanationOf('webhook_configured'),
        },
    };
    return {
        settings: exports.PLATFORM_TENANT_PROJECTION.map((entry) => values[entry.key]),
    };
}
function explanationOf(key) {
    return exports.PLATFORM_TENANT_PROJECTION.find((entry) => entry.key === key)?.explanation ?? '';
}
function isWebhookConfigured(secret) {
    if (typeof secret !== 'string')
        return false;
    const trimmed = secret.trim();
    if (!trimmed)
        return false;
    // Masked UI placeholder still means "configured" — never echo it.
    return true;
}
//# sourceMappingURL=system-settings-ai.adapter.js.map