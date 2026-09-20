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
var PbxWorkflowCompilerService_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.PbxWorkflowCompilerService = void 0;
exports.plannedEntitiesFromSteps = plannedEntitiesFromSteps;
const common_1 = require("@nestjs/common");
const ai_adapter_registry_service_1 = require("../ai-platform/ai-adapter-registry.service");
const ai_mutation_contract_1 = require("../ai-platform/ai-mutation.contract");
const endpoints_ai_adapter_1 = require("../endpoints/endpoints-ai.adapter");
const user_model_1 = require("../users/user.model");
const FORBIDDEN_TOOLS = new Set([
    'create_tenant',
    'delete_tenant',
    'update_billing',
    'create_user_auth',
    'delete_audit',
    'set_provider_secret',
]);
/**
 * Accepts a declarative LLM draft, resolves only registered mutation tools,
 * rejects cycles / forbidden platform ops, and stamps canonical args.
 */
let PbxWorkflowCompilerService = PbxWorkflowCompilerService_1 = class PbxWorkflowCompilerService {
    registry;
    logger = new common_1.Logger(PbxWorkflowCompilerService_1.name);
    constructor(registry) {
        this.registry = registry;
    }
    async compile(draft, ctx) {
        if (!Array.isArray(draft.steps) || draft.steps.length === 0) {
            throw new Error('WORKFLOW_EMPTY');
        }
        if (ctx.role === user_model_1.UserLevel.READONLY) {
            throw new Error('WORKFLOW_DENIED');
        }
        const keys = new Set();
        for (const step of draft.steps) {
            if (!step.id || keys.has(step.id))
                throw new Error(`WORKFLOW_BAD_STEP:${step.id || '(empty)'}`);
            keys.add(step.id);
            if (FORBIDDEN_TOOLS.has(step.tool))
                throw new Error(`WORKFLOW_FORBIDDEN:${step.tool}`);
        }
        this.assertAcyclic(draft.steps);
        const compiled = [];
        const summary = [];
        const skippedIds = new Set();
        for (const [index, step] of draft.steps.entries()) {
            const tool = this.registry.getMutationTool(step.tool);
            if (!tool)
                throw new Error(`WORKFLOW_UNKNOWN_TOOL:${step.tool}`);
            const input = (0, ai_mutation_contract_1.parseMutationInput)(tool.mutation, (0, ai_mutation_contract_1.stripTenantAliasesDeep)(step.args ?? {}));
            const proposed = await tool.mutation.propose(input, {
                vpbxUserUid: ctx.vpbxUserUid,
                userUid: ctx.userUid,
                role: ctx.role,
                isAdmin: ctx.role === user_model_1.UserLevel.ADMIN,
                planned: plannedEntitiesFromSteps(draft.steps.slice(0, index)),
            });
            if ((0, ai_mutation_contract_1.isToolSkip)(proposed)) {
                skippedIds.add(step.id);
                continue;
            }
            if (proposed.refused) {
                throw new Error(`WORKFLOW_REFUSED:${step.tool}:${proposed.message ?? 'refused'}`);
            }
            const proposal = proposed;
            const canonicalArgs = (0, ai_mutation_contract_1.parseMutationArgs)(tool.mutation, (0, ai_mutation_contract_1.stripTenantAliasesDeep)(proposal.applyPayload?.args ?? {}));
            compiled.push({
                stepKey: step.id,
                tool: step.tool,
                entityType: proposal.entityType || tool.entityType,
                entityLabel: step.label || proposal.entityLabel || step.tool,
                dependsOn: [...(step.dependsOn ?? [])].filter((id) => !skippedIds.has(id)),
                canonicalArgs,
                schemaVersion: tool.mutation.schemaVersion,
                before: proposal.before ?? null,
                after: proposal.after ?? null,
                summary: proposal.summary ?? [],
                requiresSecureInput: !!canonicalArgs.requiresSecureInput,
            });
            summary.push(...(proposal.summary ?? [`${step.tool}`]));
        }
        if (compiled.length === 0) {
            throw new Error('WORKFLOW_EMPTY');
        }
        this.logger.log(`compiled workflow steps=${compiled.length} tenant=${ctx.vpbxUserUid}`);
        return {
            title: draft.title?.trim() || compiled.map((s) => s.entityLabel).join(' → '),
            summary,
            steps: compiled,
        };
    }
    assertAcyclic(steps) {
        const byId = new Map(steps.map((s) => [s.id, s]));
        const visiting = new Set();
        const visited = new Set();
        const walk = (id) => {
            if (visited.has(id))
                return;
            if (visiting.has(id))
                throw new Error(`WORKFLOW_CYCLE:${id}`);
            visiting.add(id);
            const step = byId.get(id);
            for (const dep of step?.dependsOn ?? []) {
                if (!byId.has(dep))
                    throw new Error(`WORKFLOW_MISSING_DEP:${dep}`);
                walk(dep);
            }
            visiting.delete(id);
            visited.add(id);
        };
        for (const step of steps)
            walk(step.id);
    }
};
exports.PbxWorkflowCompilerService = PbxWorkflowCompilerService;
exports.PbxWorkflowCompilerService = PbxWorkflowCompilerService = PbxWorkflowCompilerService_1 = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [ai_adapter_registry_service_1.AiAdapterRegistryService])
], PbxWorkflowCompilerService);
function plannedEntitiesFromSteps(steps) {
    const extensions = new Set();
    const groups = [];
    const queues = [];
    for (const step of steps) {
        const args = step.args ?? {};
        if (step.tool === 'create_endpoints_bulk' && typeof args.extensionsPattern === 'string') {
            for (const extension of (0, endpoints_ai_adapter_1.parseBulkExtensions)(args.extensionsPattern)) {
                extensions.add(extension);
            }
        }
        if (step.tool === 'create_endpoint' && args.extension != null) {
            extensions.add(String(args.extension));
        }
        if (step.tool === 'create_call_group') {
            groups.push({
                name: typeof args.name === 'string' ? args.name : undefined,
                exten: args.exten != null ? String(args.exten) : undefined,
            });
        }
        if (step.tool === 'create_queue') {
            queues.push({
                name: typeof args.name === 'string' ? args.name : undefined,
                exten: args.exten != null ? String(args.exten) : undefined,
            });
        }
    }
    return { extensions: [...extensions], groups, queues };
}
//# sourceMappingURL=pbx-workflow-compiler.service.js.map