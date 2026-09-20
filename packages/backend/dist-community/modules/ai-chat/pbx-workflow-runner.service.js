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
var __param = (this && this.__param) || function (paramIndex, decorator) {
    return function (target, key) { decorator(target, key, paramIndex); }
};
var PbxWorkflowRunnerService_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.PbxWorkflowRunnerService = void 0;
const common_1 = require("@nestjs/common");
const sequelize_1 = require("@nestjs/sequelize");
const crypto_1 = require("crypto");
const sequelize_2 = require("sequelize");
const ai_adapter_registry_service_1 = require("../ai-platform/ai-adapter-registry.service");
const ai_mutation_contract_1 = require("../ai-platform/ai-mutation.contract");
const user_model_1 = require("../users/user.model");
const route_apply_service_1 = require("../routes/route-apply.service");
const agent_workflow_model_1 = require("./models/agent-workflow.model");
const agent_thread_model_1 = require("./models/agent-thread.model");
const pbx_workflow_compiler_service_1 = require("./pbx-workflow-compiler.service");
const EXPIRY_MS = 24 * 60 * 60 * 1000;
let PbxWorkflowRunnerService = PbxWorkflowRunnerService_1 = class PbxWorkflowRunnerService {
    workflowModel;
    stepModel;
    compiler;
    registry;
    routeApply;
    threadModel;
    logger = new common_1.Logger(PbxWorkflowRunnerService_1.name);
    locks = new Set();
    constructor(workflowModel, stepModel, compiler, registry, routeApply, threadModel) {
        this.workflowModel = workflowModel;
        this.stepModel = stepModel;
        this.compiler = compiler;
        this.registry = registry;
        this.routeApply = routeApply;
        this.threadModel = threadModel;
    }
    async findLatestPendingForThread(threadUid, ctx) {
        if (threadUid <= 0)
            return null;
        const row = await this.workflowModel.findOne({
            where: {
                thread_uid: threadUid,
                vpbx_user_uid: ctx.vpbxUserUid,
                user_uid: ctx.userUid,
                status: { [sequelize_2.Op.in]: ['pending', 'failed'] },
            },
            order: [['created_at', 'DESC']],
        });
        if (!row)
            return null;
        const steps = await this.stepModel.findAll({
            where: { workflow_uid: row.uid },
            order: [['step_index', 'ASC']],
        });
        return this.toView(row, steps);
    }
    async createFromDraft(draft, ctx) {
        const compiled = await this.compiler.compile(draft, ctx);
        return this.persistCompiled(compiled, ctx);
    }
    async createFromCompiled(compiled, ctx) {
        return this.persistCompiled(compiled, ctx);
    }
    async getOwned(workflowId, ctx) {
        const row = await this.findOwned(workflowId, ctx);
        if (!row)
            throw new common_1.NotFoundException('Workflow not found');
        const steps = await this.stepModel.findAll({
            where: { workflow_uid: row.uid },
            order: [['step_index', 'ASC']],
        });
        return this.toView(row, steps);
    }
    async reject(workflowId, ctx) {
        const row = await this.findOwned(workflowId, ctx);
        if (!row || row.status !== 'pending') {
            throw new common_1.NotFoundException('Workflow not pending');
        }
        const [changed] = await this.workflowModel.update({ status: 'rejected', updated_at: new Date() }, { where: { uid: row.uid, status: 'pending' } });
        if (!changed)
            throw new Error('WORKFLOW_BUSY');
        await row.reload();
        const steps = await this.stepModel.findAll({
            where: { workflow_uid: row.uid },
            order: [['step_index', 'ASC']],
        });
        return this.toView(row, steps);
    }
    /**
     * Database claim spans workers. A durable write checkpoint allows reload-only
     * retries. An ambiguous write keeps the claim for operator reconciliation.
     */
    async apply(workflowId, ctx) {
        if (this.locks.has(workflowId)) {
            throw new Error('WORKFLOW_BUSY');
        }
        this.locks.add(workflowId);
        try {
            const row = await this.findOwned(workflowId, ctx);
            if (!row)
                throw new common_1.NotFoundException('Workflow not found');
            if (row.status !== 'pending' && row.status !== 'failed') {
                return this.getOwned(workflowId, ctx);
            }
            if (new Date(row.expires_at).getTime() <= Date.now()) {
                await this.workflowModel.update({ status: 'expired', updated_at: new Date() }, {
                    where: { uid: row.uid, status: { [sequelize_2.Op.in]: ['pending', 'failed'] } },
                });
                return this.getOwned(workflowId, ctx);
            }
            if (ctx.role === user_model_1.UserLevel.READONLY) {
                throw new common_1.ForbiddenException('Read-only users cannot apply workflows');
            }
            const [claimed] = await this.workflowModel.update({ status: 'applying', error: null, updated_at: new Date() }, { where: { uid: row.uid, status: { [sequelize_2.Op.in]: ['pending', 'failed'] }, applied_at: null } });
            if (!claimed)
                return this.getOwned(workflowId, ctx);
            const steps = await this.stepModel.findAll({
                where: { workflow_uid: row.uid },
                order: [['step_index', 'ASC']],
            });
            const results = new Map();
            for (const step of steps) {
                if (step.status === 'applied') {
                    if (step.result_json)
                        results.set(step.step_key, step.result_json);
                    continue;
                }
                if (step.status === 'skipped')
                    continue;
                const depsOk = (step.depends_on ?? []).every((dep) => {
                    const depStep = steps.find((s) => s.step_key === dep);
                    return depStep?.status === 'applied';
                });
                if (!depsOk) {
                    await step.update({
                        status: 'failed',
                        error: 'dependency not applied',
                        updated_at: new Date(),
                    });
                    await row.update({
                        status: 'failed',
                        error: `step ${step.step_key}: dependency not applied`,
                        updated_at: new Date(),
                    });
                    break;
                }
                await step.update({ status: 'applying', attempts: step.attempts + 1, updated_at: new Date() });
                let writeStarted = false;
                let writeCompleted = false;
                try {
                    const checkpoint = step.result_json?.__execution;
                    if (checkpoint?.writeCompleted) {
                        writeCompleted = true;
                        if (checkpoint.contextUid !== undefined) {
                            await this.routeApply.applyContext(checkpoint.contextUid, ctx.vpbxUserUid, ctx.role === user_model_1.UserLevel.ADMIN);
                        }
                        results.set(step.step_key, step.result_json);
                        await step.update({ status: 'applied', error: null, updated_at: new Date() });
                        continue;
                    }
                    const resolvedArgs = this.resolveSymbolicArgs(step.canonical_args, results);
                    const tool = this.registry.getMutationTool(step.tool);
                    if (!tool)
                        throw new Error(`unknown tool ${step.tool}`);
                    if (step.schema_version !== tool.mutation.schemaVersion) {
                        throw new Error(`stale schema ${step.schema_version}`);
                    }
                    const args = (0, ai_mutation_contract_1.parseMutationArgs)(tool.mutation, (0, ai_mutation_contract_1.stripTenantAliasesDeep)(resolvedArgs));
                    const mutationCtx = {
                        vpbxUserUid: ctx.vpbxUserUid,
                        userUid: ctx.userUid,
                        role: ctx.role,
                        isAdmin: ctx.role === user_model_1.UserLevel.ADMIN,
                    };
                    const check = await tool.mutation.revalidate(args, mutationCtx);
                    if (!check.ok)
                        throw new Error(check.reason);
                    const contextUid = tool.mutation.reload.kind === 'dialplan-context'
                        ? tool.mutation.reload.contextUid(check.args) : undefined;
                    writeStarted = true;
                    const applied = await tool.mutation.apply(check.args, mutationCtx);
                    const extra = applied && typeof applied === 'object' ? applied : {};
                    const result = {
                        ...(typeof check.args === 'object' && check.args ? check.args : {}),
                        ...extra,
                        applied: true,
                        __execution: { writeCompleted: true, ...(contextUid === undefined ? {} : { contextUid }) },
                    };
                    await step.update({ result_json: result, updated_at: new Date() });
                    writeCompleted = true;
                    if (contextUid !== undefined) {
                        await this.routeApply.applyContext(contextUid, ctx.vpbxUserUid, ctx.role === user_model_1.UserLevel.ADMIN);
                    }
                    results.set(step.step_key, result);
                    await step.update({
                        status: 'applied',
                        result_json: result,
                        error: null,
                        updated_at: new Date(),
                    });
                }
                catch (err) {
                    const message = err?.message ?? String(err);
                    const status = writeStarted && !writeCompleted ? 'applying' : 'failed';
                    const error = status === 'applying' ? `WRITE_OUTCOME_UNKNOWN: ${message}` : message;
                    await step.update({ status, error, updated_at: new Date() });
                    await row.update({
                        status,
                        error: `step ${step.step_key}: ${error}`,
                        updated_at: new Date(),
                    });
                    this.logger.warn(`workflow ${workflowId} stopped at ${step.step_key}: ${message}`);
                    break;
                }
            }
            const fresh = await this.stepModel.findAll({
                where: { workflow_uid: row.uid },
                order: [['step_index', 'ASC']],
            });
            const allApplied = fresh.every((s) => s.status === 'applied' || s.status === 'skipped');
            if (allApplied) {
                await row.update({ status: 'applied', applied_at: new Date(), error: null, updated_at: new Date() });
            }
            return this.toView(await row.reload(), fresh);
        }
        finally {
            this.locks.delete(workflowId);
        }
    }
    async persistCompiled(compiled, ctx) {
        const now = new Date();
        const threadUid = ctx.threadUid ?? 0;
        if (threadUid > 0) {
            await this.workflowModel.update({ status: 'rejected', error: 'superseded', updated_at: now }, {
                where: {
                    thread_uid: threadUid,
                    vpbx_user_uid: ctx.vpbxUserUid,
                    user_uid: ctx.userUid,
                    status: { [sequelize_2.Op.in]: ['pending', 'failed'] },
                },
            });
        }
        const workflow = await this.workflowModel.create({
            workflow_id: (0, crypto_1.randomUUID)(),
            thread_uid: ctx.threadUid ?? 0,
            vpbx_user_uid: ctx.vpbxUserUid,
            user_uid: ctx.userUid,
            brief_version: ctx.briefVersion ?? 0,
            title: compiled.title,
            summary: compiled.summary,
            status: 'pending',
            error: null,
            expires_at: new Date(now.getTime() + EXPIRY_MS),
            applied_at: null,
            created_at: now,
            updated_at: now,
        });
        const steps = await Promise.all(compiled.steps.map((step, index) => this.stepModel.create({
            workflow_uid: workflow.uid,
            step_key: step.stepKey,
            step_index: index,
            tool: step.tool,
            entity_type: step.entityType,
            entity_label: step.entityLabel,
            depends_on: step.dependsOn,
            canonical_args: step.canonicalArgs,
            schema_version: step.schemaVersion,
            before_json: step.before,
            after_json: step.after,
            result_json: null,
            status: 'pending',
            attempts: 0,
            error: null,
            requires_secure_input: step.requiresSecureInput,
            created_at: now,
            updated_at: now,
        })));
        return this.toView(workflow, steps);
    }
    resolveSymbolicArgs(args, results) {
        const rewrite = (value) => {
            if (typeof value === 'string') {
                const match = /^steps\.([^.]+)\.result\.(.+)$/.exec(value);
                if (match) {
                    const [, stepKey, path] = match;
                    const result = results.get(stepKey);
                    if (!result)
                        throw new Error(`unresolved symbolic ref ${value}`);
                    const parts = path.split('.');
                    let cur = result;
                    for (const part of parts) {
                        cur = cur?.[part];
                    }
                    return cur;
                }
                return value;
            }
            if (Array.isArray(value))
                return value.map(rewrite);
            if (value && typeof value === 'object') {
                return Object.fromEntries(Object.entries(value).map(([k, v]) => [k, rewrite(v)]));
            }
            return value;
        };
        return rewrite(args);
    }
    async findOwned(workflowId, ctx) {
        return this.workflowModel.findOne({
            where: {
                workflow_id: workflowId,
                vpbx_user_uid: ctx.vpbxUserUid,
                user_uid: ctx.userUid,
            },
        });
    }
    toView(row, steps) {
        return {
            workflowId: row.workflow_id,
            threadUid: Number(row.thread_uid),
            title: row.title,
            summary: row.summary ?? [],
            status: row.status,
            error: row.error,
            expiresAt: new Date(row.expires_at).toISOString(),
            appliedAt: row.applied_at ? new Date(row.applied_at).toISOString() : null,
            steps: steps.map((step) => ({
                stepKey: step.step_key,
                stepIndex: step.step_index,
                tool: step.tool,
                entityType: step.entity_type,
                entityLabel: step.entity_label,
                status: step.status,
                error: step.error,
                dependsOn: step.depends_on ?? [],
                requiresSecureInput: !!step.requires_secure_input,
            })),
        };
    }
    async listPending(ctx) {
        const rows = await this.workflowModel.findAll({
            where: {
                vpbx_user_uid: ctx.vpbxUserUid,
                user_uid: ctx.userUid,
                status: { [sequelize_2.Op.in]: ['pending', 'failed', 'applying'] },
                expires_at: { [sequelize_2.Op.gt]: new Date() },
            },
            order: [['created_at', 'DESC']],
        });
        const threadUids = [...new Set(rows.map((row) => Number(row.thread_uid)).filter((uid) => uid > 0))];
        const living = threadUids.length
            ? await this.threadModel.findAll({
                where: {
                    uid: { [sequelize_2.Op.in]: threadUids },
                    vpbx_user_uid: ctx.vpbxUserUid,
                    user_uid: ctx.userUid,
                },
                attributes: ['uid'],
            })
            : [];
        const livingSet = new Set(living.map((row) => Number(row.uid)));
        const orphanUids = rows
            .filter((row) => !livingSet.has(Number(row.thread_uid)))
            .map((row) => row.uid);
        if (orphanUids.length) {
            await this.stepModel.destroy({ where: { workflow_uid: { [sequelize_2.Op.in]: orphanUids } } });
            await this.workflowModel.destroy({ where: { uid: { [sequelize_2.Op.in]: orphanUids } } });
        }
        const views = [];
        for (const row of rows) {
            if (!livingSet.has(Number(row.thread_uid)))
                continue;
            const steps = await this.stepModel.findAll({
                where: { workflow_uid: row.uid },
                order: [['step_index', 'ASC']],
            });
            views.push(this.toView(row, steps));
        }
        return views;
    }
    async deleteForThread(threadUid, ctx) {
        const rows = await this.workflowModel.findAll({
            where: {
                thread_uid: threadUid,
                vpbx_user_uid: ctx.vpbxUserUid,
                user_uid: ctx.userUid,
            },
        });
        const uids = rows.map((row) => row.uid);
        if (!uids.length)
            return;
        await this.stepModel.destroy({ where: { workflow_uid: { [sequelize_2.Op.in]: uids } } });
        await this.workflowModel.destroy({ where: { uid: { [sequelize_2.Op.in]: uids } } });
    }
};
exports.PbxWorkflowRunnerService = PbxWorkflowRunnerService;
exports.PbxWorkflowRunnerService = PbxWorkflowRunnerService = PbxWorkflowRunnerService_1 = __decorate([
    (0, common_1.Injectable)(),
    __param(0, (0, sequelize_1.InjectModel)(agent_workflow_model_1.AgentWorkflow)),
    __param(1, (0, sequelize_1.InjectModel)(agent_workflow_model_1.AgentWorkflowStep)),
    __param(5, (0, sequelize_1.InjectModel)(agent_thread_model_1.AgentThread)),
    __metadata("design:paramtypes", [Object, Object, pbx_workflow_compiler_service_1.PbxWorkflowCompilerService,
        ai_adapter_registry_service_1.AiAdapterRegistryService,
        route_apply_service_1.RouteApplyService, Object])
], PbxWorkflowRunnerService);
//# sourceMappingURL=pbx-workflow-runner.service.js.map