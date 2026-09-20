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
Object.defineProperty(exports, "__esModule", { value: true });
exports.PlanAiAdapter = void 0;
const common_1 = require("@nestjs/common");
const ai_adapter_registry_service_1 = require("../ai-platform/ai-adapter-registry.service");
const pbx_workflow_runner_service_1 = require("./pbx-workflow-runner.service");
let PlanAiAdapter = class PlanAiAdapter {
    registry;
    workflows;
    domain = 'plan';
    constructor(registry, workflows) {
        this.registry = registry;
        this.workflows = workflows;
    }
    onModuleInit() { this.registry.register(this); }
    getTools() { return [this.toolProposePlan()]; }
    getKnowledgeBlock() {
        return `## План изменений
- Две и более сущности в одном запросе — это один propose_plan, а не серия create_*.
- Отдельный create_* по такому запросу отклоняется: собери план целиком.
- Если факты изменились, вызови propose_plan снова — новая карточка заменяет незакрытую.
- Шаг ссылается на результат предыдущего строкой steps.<id>.result.<поле>.`;
    }
    toolProposePlan() {
        return {
            name: 'propose_plan',
            description: 'Собрать несколько мутаций в один план (одна карточка). Две и более сущности в одном запросе — этот инструмент, не серия create_*.',
            inputSchema: {
                type: 'object',
                required: ['title', 'steps'],
                additionalProperties: false,
                properties: {
                    title: { type: 'string', description: 'Заголовок плана для карточки' },
                    steps: {
                        type: 'array',
                        minItems: 1,
                        maxItems: 30,
                        description: 'Шаги плана в порядке выполнения',
                        items: {
                            type: 'object',
                            additionalProperties: false,
                            properties: {
                                id: { type: 'string', description: 'Ключ шага, уникальный внутри плана' },
                                tool: { type: 'string', description: 'Имя мутирующего инструмента' },
                                args: { type: 'object', description: 'Аргументы инструмента' },
                                dependsOn: { type: 'array', items: { type: 'string' }, description: 'Ключи шагов-зависимостей' },
                                label: { type: 'string', description: 'Человеческое название шага' },
                            },
                            required: ['id', 'tool', 'args'],
                        },
                    },
                },
            },
            entityType: 'workflow',
            proposes: true,
            handler: async (args, vpbxUserUid, ctx) => {
                const title = typeof args.title === 'string' ? args.title : '';
                const steps = this.parseSteps(args.steps);
                try {
                    return await this.workflows.createFromDraft({ title, steps }, {
                        vpbxUserUid,
                        userUid: ctx?.userUid ?? 0,
                        role: ctx?.role ?? 0,
                        threadUid: ctx?.threadUid ?? 0,
                    });
                }
                catch (err) {
                    const code = err instanceof Error ? err.message : String(err);
                    if (code === 'WORKFLOW_EMPTY') {
                        return { refused: true, message: 'План пуст: укажите хотя бы один шаг.' };
                    }
                    if (/ARGS_INVALID|WORKFLOW_BAD_STEP/.test(code)) {
                        const schemas = [...new Set(steps.map((step) => step.tool))]
                            .slice(0, 6).map((name) => ({ tool: name, argsSchema: this.registry.getToolByName(name)?.inputSchema }));
                        throw new Error(`${code}. Each steps item must be an object {id,tool,args,dependsOn:[]}. `
                            + `Use the exact tool argument schemas, preserve the user's numbers: ${JSON.stringify(schemas)}`, { cause: err });
                    }
                    throw err;
                }
            },
        };
    }
    parseSteps(raw) {
        if (!Array.isArray(raw))
            return [];
        return raw.map((step) => {
            const row = (step && typeof step === 'object' ? step : {});
            return {
                id: typeof row.id === 'string' ? row.id : '',
                tool: typeof row.tool === 'string' ? row.tool : '',
                args: row.args && typeof row.args === 'object' && !Array.isArray(row.args)
                    ? row.args
                    : {},
                dependsOn: Array.isArray(row.dependsOn)
                    ? row.dependsOn.filter((key) => typeof key === 'string')
                    : undefined,
                label: typeof row.label === 'string' ? row.label : undefined,
            };
        });
    }
};
exports.PlanAiAdapter = PlanAiAdapter;
exports.PlanAiAdapter = PlanAiAdapter = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [ai_adapter_registry_service_1.AiAdapterRegistryService,
        pbx_workflow_runner_service_1.PbxWorkflowRunnerService])
], PlanAiAdapter);
//# sourceMappingURL=plan-ai.adapter.js.map