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
var DialplanDryRunAiAdapter_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.DialplanDryRunAiAdapter = void 0;
const common_1 = require("@nestjs/common");
const ai_adapter_registry_service_1 = require("../ai-platform/ai-adapter-registry.service");
const dialplan_dry_run_service_1 = require("./dialplan-dry-run.service");
/**
 * DialplanDryRunAiAdapter — Domain AI Adapter wrapping DialplanDryRunService (D-32).
 *
 * Tool is registered through AiAdapterRegistryService. The handler receives
 * `vpbxUserUid` as a call parameter — never closed over, never read from args.
 */
let DialplanDryRunAiAdapter = DialplanDryRunAiAdapter_1 = class DialplanDryRunAiAdapter {
    dryRunService;
    registry;
    logger = new common_1.Logger(DialplanDryRunAiAdapter_1.name);
    domain = 'dialplan_dry_run';
    constructor(dryRunService, registry) {
        this.dryRunService = dryRunService;
        this.registry = registry;
    }
    onModuleInit() {
        this.registry.register(this);
        this.logger.log('DialplanDryRunAiAdapter registered');
    }
    getTools() {
        return [this.toolDialplanDryRun()];
    }
    getStateProvider() {
        return { domain: this.domain, buildSummary: async () => '' };
    }
    getKnowledgeBlock() {
        return `## Dry-run диалплана
- Детерминированная симуляция цепочки без Asterisk (D-29).
- Хост: route | ivr. На входе черновик actions или menu_items, номер, пресеты сценария.
- Переходы toivr / toroute / goto тратят hop; предел DEFAULT_HOP_LIMIT, затем Congestion.
- toroute — только точное совпадение extension; иначе исход «Ушло на адрес» с конкретной причиной.
- Нехватка значения условия → reask с askedAfterRun, повторный прогон. Обязательным перед правкой не является.`;
    }
    toolDialplanDryRun() {
        return {
            name: 'dialplan_dry_run',
            description: 'Прогон черновика маршрута или IVR без Asterisk. Те же поля, что POST /dialplan/dry-run. Тенант берётся из vpbxUserUid вызова, не из тела.',
            inputSchema: {
                host: { type: 'string', description: 'route | ivr' },
                actions: { type: 'array', description: 'Черновик действий хоста маршрута' },
                menu_items: { type: 'array', description: 'Черновик пунктов меню хоста IVR' },
                callerNumber: { type: 'string', description: 'Номер абонента' },
                scenario: { type: 'object', description: 'Пресеты ConditionSource → значение' },
                ivrChoice: { type: 'string', description: 'Выбранная цифра / t / i' },
            },
            entityType: 'dialplan_dry_run',
            handler: async (args, vpbxUserUid) => {
                const body = {
                    host: args.host === 'ivr' ? 'ivr' : 'route',
                    actions: args.actions,
                    menu_items: args.menu_items,
                    callerNumber: args.callerNumber,
                    scenario: args.scenario,
                    ivrChoice: args.ivrChoice,
                };
                return this.dryRunService.run(vpbxUserUid, body);
            },
        };
    }
};
exports.DialplanDryRunAiAdapter = DialplanDryRunAiAdapter;
exports.DialplanDryRunAiAdapter = DialplanDryRunAiAdapter = DialplanDryRunAiAdapter_1 = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [dialplan_dry_run_service_1.DialplanDryRunService,
        ai_adapter_registry_service_1.AiAdapterRegistryService])
], DialplanDryRunAiAdapter);
//# sourceMappingURL=dialplan-dry-run-ai.adapter.js.map