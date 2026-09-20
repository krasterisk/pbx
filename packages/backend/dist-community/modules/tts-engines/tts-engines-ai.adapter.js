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
var TtsEnginesAiAdapter_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.TtsEnginesAiAdapter = exports.TTS_ENGINE_ALLOW_LIST = void 0;
exports.toTtsEngineView = toTtsEngineView;
exports.toSpeechEngineView = toSpeechEngineView;
exports.isSpeechEngineConfigured = isSpeechEngineConfigured;
const common_1 = require("@nestjs/common");
const tts_engines_service_1 = require("./tts-engines.service");
const ai_adapter_registry_service_1 = require("../ai-platform/ai-adapter-registry.service");
/**
 * Explicit allow list — never project an engine by subtracting known secrets (T-15-86).
 * token, custom_url, custom_headers and encrypted blobs stay off this list.
 */
exports.TTS_ENGINE_ALLOW_LIST = [
    'uid',
    'name',
    'vendor',
    'enabled',
    'capabilities',
    'configured',
];
const CAPABILITY_KEYS = ['language', 'voice', 'speaking_rate', 'role', 'speed'];
/**
 * TtsEnginesAiAdapter — read-only TTS catalog (D-15).
 * Synthesis is billable with no undo — no synth tool is declared (T-15-88).
 */
let TtsEnginesAiAdapter = TtsEnginesAiAdapter_1 = class TtsEnginesAiAdapter {
    ttsEngines;
    registry;
    logger = new common_1.Logger(TtsEnginesAiAdapter_1.name);
    domain = 'tts-engines';
    constructor(ttsEngines, registry) {
        this.ttsEngines = ttsEngines;
        this.registry = registry;
    }
    onModuleInit() {
        this.registry.register(this);
        this.logger.log('TtsEnginesAiAdapter registered');
    }
    getTools() {
        return [this.toolListTtsEngines()];
    }
    getStateProvider() {
        return { domain: this.domain, buildSummary: (uid) => this.buildSummary(uid) };
    }
    getKnowledgeBlock() {
        return `## TTS-движки
- Каталог синтеза: имя, вендор, enabled, capabilities, configured. Ключ и URL не отдаются.
- Синтез через агента недоступен — это платная операция без отмены.`;
    }
    async buildSummary(vpbxUserUid) {
        const engines = await this.ttsEngines.findAll(vpbxUserUid);
        if (engines.length === 0)
            return '';
        const ready = engines.filter((engine) => isSpeechEngineConfigured(engine)).length;
        return `TTS-движки: ${ready}/${engines.length} настроены`;
    }
    toolListTtsEngines() {
        return {
            name: 'list_tts_engines',
            description: 'TTS-движки тенанта: имя, вендор, enabled, безопасные capabilities и configured. Без ключа, URL и заголовков. Синтез недоступен.',
            inputSchema: {},
            entityType: 'tts_engine',
            handler: async (_args, uid) => {
                const rows = await this.ttsEngines.findAll(uid);
                return { engines: rows.map((row) => toTtsEngineView(row)) };
            },
        };
    }
};
exports.TtsEnginesAiAdapter = TtsEnginesAiAdapter;
exports.TtsEnginesAiAdapter = TtsEnginesAiAdapter = TtsEnginesAiAdapter_1 = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [tts_engines_service_1.TtsEnginesService,
        ai_adapter_registry_service_1.AiAdapterRegistryService])
], TtsEnginesAiAdapter);
function toTtsEngineView(row) {
    return toSpeechEngineView(row);
}
function toSpeechEngineView(row) {
    return {
        uid: row.uid ?? null,
        name: row.name ?? '',
        vendor: row.type ?? 'custom',
        enabled: row.enabled === false || row.enabled === 0 ? false : true,
        capabilities: pickCapabilities(row.settings),
        configured: isSpeechEngineConfigured(row),
    };
}
function isSpeechEngineConfigured(row) {
    if (row.type === 'custom') {
        return Boolean(row.custom_url && String(row.custom_url).trim());
    }
    return Boolean(row.token && String(row.token).trim());
}
function pickCapabilities(settings) {
    const source = settings ?? {};
    const mapped = {
        language: source.language ?? source.language_code,
        voice: source.voice ?? source.voice_name,
        speaking_rate: source.speaking_rate,
        role: source.role,
        speed: source.speed,
    };
    const out = {};
    for (const key of CAPABILITY_KEYS) {
        const value = mapped[key];
        if (value !== undefined && value !== null && value !== '') {
            out[key] = value;
        }
    }
    return out;
}
//# sourceMappingURL=tts-engines-ai.adapter.js.map