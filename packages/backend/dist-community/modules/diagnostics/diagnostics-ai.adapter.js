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
var DiagnosticsAiAdapter_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.DiagnosticsAiAdapter = void 0;
const common_1 = require("@nestjs/common");
const ai_adapter_registry_service_1 = require("../ai-platform/ai-adapter-registry.service");
const diagnostics_service_1 = require("./diagnostics.service");
/**
 * DiagnosticsAiAdapter — read-only live channels, recent events, compiled dialplan (D-12, D-13).
 * Tenant is a handler argument, never a registration closure (D-22).
 */
let DiagnosticsAiAdapter = DiagnosticsAiAdapter_1 = class DiagnosticsAiAdapter {
    diagnostics;
    registry;
    logger = new common_1.Logger(DiagnosticsAiAdapter_1.name);
    domain = 'diagnostics';
    constructor(diagnostics, registry) {
        this.diagnostics = diagnostics;
        this.registry = registry;
    }
    onModuleInit() {
        this.registry.register(this);
        this.logger.log('DiagnosticsAiAdapter registered');
    }
    getTools() {
        return [this.toolLiveChannels(), this.toolRecentEvents(), this.toolCompiledDialplan(), {
                name: 'get_endpoint_registration',
                description: 'Проверить регистрацию своего SIP-абонента в Asterisk по внутреннему номеру. Только состояния; без паролей и raw AuthDetail.',
                inputSchema: { extension: { type: 'string', description: 'Внутренний номер, 2–8 цифр' } },
                entityType: 'diagnostic_registration',
                handler: async (args, uid) => this.diagnostics.readEndpointRegistration(uid, String(args.extension ?? '')),
            }];
    }
    getStateProvider() {
        return { domain: this.domain, buildSummary: async () => '' };
    }
    getKnowledgeBlock() {
        return `## Диагностика
- Живые каналы, недавние события и скомпилированный диалплан — доказательства, не догадки.
- Порядок правил в get_compiled_dialplan — порядок оценки. Чужой контекст отвергается.
- Списки усекаются; truncated значит «спроси уже», а не «вызова не было».`;
    }
    toolLiveChannels() {
        return {
            name: 'get_live_channels',
            description: 'Живые каналы вызывающего тенанта. Общий свитч фильтруется по своим контекстам и endpoint. Усечение сообщается.',
            inputSchema: {},
            entityType: 'diagnostic_channel',
            handler: async (_args, uid) => this.diagnostics.readLiveChannels(uid),
        };
    }
    toolRecentEvents() {
        return {
            name: 'get_recent_call_events',
            description: 'Недавние события звонков тенанта в ограниченном окне и количестве. Не причина сама по себе — только улика.',
            inputSchema: {},
            entityType: 'diagnostic_event',
            handler: async (_args, uid) => this.diagnostics.readRecentEvents(uid),
        };
    }
    toolCompiledDialplan() {
        return {
            name: 'get_compiled_dialplan',
            description: 'Скомпилированные правила одного своего контекста в порядке оценки. Чужой контекст отвергается.',
            inputSchema: {
                context: { type: 'string', description: 'Имя контекста тенанта, как в list_contexts' },
            },
            entityType: 'diagnostic_dialplan',
            handler: async (args, uid) => this.diagnostics.readCompiledDialplan(uid, String(args.context ?? '')),
        };
    }
};
exports.DiagnosticsAiAdapter = DiagnosticsAiAdapter;
exports.DiagnosticsAiAdapter = DiagnosticsAiAdapter = DiagnosticsAiAdapter_1 = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [diagnostics_service_1.DiagnosticsService,
        ai_adapter_registry_service_1.AiAdapterRegistryService])
], DiagnosticsAiAdapter);
//# sourceMappingURL=diagnostics-ai.adapter.js.map