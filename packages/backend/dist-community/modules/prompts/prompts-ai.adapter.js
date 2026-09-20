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
var PromptsAiAdapter_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.PromptsAiAdapter = void 0;
exports.toPromptViews = toPromptViews;
exports.collectPromptReferences = collectPromptReferences;
const common_1 = require("@nestjs/common");
const prompts_service_1 = require("./prompts.service");
const ivrs_service_1 = require("../ivrs/ivrs.service");
const ai_adapter_registry_service_1 = require("../ai-platform/ai-adapter-registry.service");
const notifications_ai_adapter_1 = require("../notifications/notifications-ai.adapter");
/**
 * PromptsAiAdapter — read-only audio prompt metadata (D-15).
 * Results never include audio bytes or a fetchable path (T-15-92).
 */
let PromptsAiAdapter = PromptsAiAdapter_1 = class PromptsAiAdapter {
    prompts;
    registry;
    ivrs;
    logger = new common_1.Logger(PromptsAiAdapter_1.name);
    domain = 'prompts';
    constructor(prompts, registry, ivrs) {
        this.prompts = prompts;
        this.registry = registry;
        this.ivrs = ivrs;
    }
    onModuleInit() {
        this.registry.register(this);
        this.logger.log('PromptsAiAdapter registered');
    }
    getTools() {
        return [this.toolListAudioPrompts()];
    }
    getStateProvider() {
        return { domain: this.domain, buildSummary: (uid) => this.buildSummary(uid) };
    }
    getKnowledgeBlock() {
        return `## Аудиоподсказки
- Список: имя, длительность и какие меню на них ссылаются. Без аудио и без путей.
- Загрузить или синтезировать подсказку агент не может.`;
    }
    async buildSummary(vpbxUserUid) {
        const rows = await this.prompts.findAll(vpbxUserUid);
        if (rows.length === 0)
            return '';
        const names = rows
            .slice(0, 5)
            .map((row) => String(row.comment || row.filename || row.uid))
            .join(', ');
        return `Аудиоподсказки: ${names}`;
    }
    toolListAudioPrompts() {
        return {
            name: 'list_audio_prompts',
            description: 'Аудиоподсказки тенанта: имя, длительность и сущности, которые на них ссылаются. Без аудио и без путей.',
            inputSchema: {
                limit: {
                    type: 'number',
                    description: `Число строк, не больше ${notifications_ai_adapter_1.OPERATIONS_RESULT_CEILING}`,
                },
            },
            entityType: 'prompt',
            handler: async (args, uid) => {
                const [rows, menus] = await Promise.all([
                    this.prompts.findAll(uid),
                    this.ivrs.findAll(uid),
                ]);
                const limit = clampOptional(args.limit, rows.length);
                return {
                    prompts: toPromptViews(rows, menus).slice(0, limit),
                };
            },
        };
    }
};
exports.PromptsAiAdapter = PromptsAiAdapter;
exports.PromptsAiAdapter = PromptsAiAdapter = PromptsAiAdapter_1 = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prompts_service_1.PromptsService,
        ai_adapter_registry_service_1.AiAdapterRegistryService,
        ivrs_service_1.IvrsService])
], PromptsAiAdapter);
function toPromptViews(rows, ivrs = []) {
    return (rows ?? []).map((row) => ({
        uid: Number(row.uid ?? 0),
        name: String(row.comment || row.name || ''),
        durationSeconds: durationOf(row),
        referencedBy: collectPromptReferences(String(row.filename ?? ''), ivrs ?? []),
    }));
}
function collectPromptReferences(filename, ivrs) {
    const key = promptKey(filename);
    if (!key)
        return [];
    return ivrs
        .filter((ivr) => (ivr.prompts ?? []).some((phrase) => phrase.kind === 'audio' && promptKey(String(phrase.filename ?? '')) === key))
        .map((ivr) => ({
        entityType: 'ivr',
        uid: ivr.uid,
        name: String(ivr.name ?? ivr.uid),
    }));
}
function durationOf(row) {
    const value = row.durationSeconds ?? row.duration;
    return typeof value === 'number' && Number.isFinite(value) ? value : null;
}
function promptKey(filename) {
    const base = filename.replace(/\\/g, '/').split('/').pop() ?? filename;
    return base.replace(/\.[^.]+$/, '');
}
function clampOptional(limit, fallback) {
    if (limit == null || limit === '')
        return fallback;
    const n = Number(limit);
    if (!Number.isFinite(n) || n <= 0)
        return fallback;
    return Math.min(Math.floor(n), notifications_ai_adapter_1.OPERATIONS_RESULT_CEILING);
}
//# sourceMappingURL=prompts-ai.adapter.js.map