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
var SttEnginesAiAdapter_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.SttEnginesAiAdapter = exports.STT_ENGINE_ALLOW_LIST = void 0;
exports.toSttEngineView = toSttEngineView;
const common_1 = require("@nestjs/common");
const stt_engines_service_1 = require("./stt-engines.service");
const ai_adapter_registry_service_1 = require("../ai-platform/ai-adapter-registry.service");
const tts_engines_ai_adapter_1 = require("../tts-engines/tts-engines-ai.adapter");
/**
 * Same allow list as TTS — engine rows store encrypted provider keys beside
 * harmless fields; subtracting secrets from a full row is what leaks a new column.
 */
exports.STT_ENGINE_ALLOW_LIST = [
    'uid',
    'name',
    'vendor',
    'enabled',
    'capabilities',
    'configured',
];
/**
 * SttEnginesAiAdapter — read-only STT catalog (D-15).
 * Transcription is billable with no undo — no transcribe tool is declared (T-15-88).
 */
let SttEnginesAiAdapter = SttEnginesAiAdapter_1 = class SttEnginesAiAdapter {
    sttEngines;
    registry;
    logger = new common_1.Logger(SttEnginesAiAdapter_1.name);
    domain = 'stt-engines';
    constructor(sttEngines, registry) {
        this.sttEngines = sttEngines;
        this.registry = registry;
    }
    onModuleInit() {
        this.registry.register(this);
        this.logger.log('SttEnginesAiAdapter registered');
    }
    getTools() {
        return [this.toolListSttEngines()];
    }
    getStateProvider() {
        return { domain: this.domain, buildSummary: (uid) => this.buildSummary(uid) };
    }
    getKnowledgeBlock() {
        return `## STT-движки
- Каталог распознавания: имя, вендор, enabled, capabilities, configured. Ключ и URL не отдаются.
- Транскрипция через агента недоступна — это платная операция без отмены.`;
    }
    async buildSummary(vpbxUserUid) {
        const engines = await this.sttEngines.findAll(vpbxUserUid);
        if (engines.length === 0)
            return '';
        const ready = engines.filter((engine) => (0, tts_engines_ai_adapter_1.isSpeechEngineConfigured)(engine)).length;
        return `STT-движки: ${ready}/${engines.length} настроены`;
    }
    toolListSttEngines() {
        return {
            name: 'list_stt_engines',
            description: 'STT-движки тенанта: имя, вендор, enabled, безопасные capabilities и configured. Без ключа, URL и заголовков. Транскрипция недоступна.',
            inputSchema: {},
            entityType: 'stt_engine',
            handler: async (_args, uid) => {
                const rows = await this.sttEngines.findAll(uid);
                return { engines: rows.map((row) => toSttEngineView(row)) };
            },
        };
    }
};
exports.SttEnginesAiAdapter = SttEnginesAiAdapter;
exports.SttEnginesAiAdapter = SttEnginesAiAdapter = SttEnginesAiAdapter_1 = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [stt_engines_service_1.SttEnginesService,
        ai_adapter_registry_service_1.AiAdapterRegistryService])
], SttEnginesAiAdapter);
function toSttEngineView(row) {
    return (0, tts_engines_ai_adapter_1.toSpeechEngineView)(row);
}
//# sourceMappingURL=stt-engines-ai.adapter.js.map