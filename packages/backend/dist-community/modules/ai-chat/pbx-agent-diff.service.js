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
var PbxAgentDiffService_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.PbxAgentDiffService = void 0;
const common_1 = require("@nestjs/common");
const sequelize_1 = require("@nestjs/sequelize");
const crypto_1 = require("crypto");
const user_model_1 = require("../users/user.model");
const route_apply_service_1 = require("../routes/route-apply.service");
const logger_service_1 = require("../logger/logger.service");
const ai_audit_log_model_1 = require("./models/ai-audit-log.model");
const ai_adapter_registry_service_1 = require("../ai-platform/ai-adapter-registry.service");
const ai_mutation_contract_1 = require("../ai-platform/ai-mutation.contract");
const agent_proposal_model_1 = require("./models/agent-proposal.model");
const agent_diff_dto_1 = require("./dto/agent-diff.dto");
const route_precedence_util_1 = require("./route-precedence.util");
const PROPOSAL_TTL_MS = 24 * 60 * 60 * 1000;
const ACTION_LOG_TRUNCATE = 200;
const AUDIT_TRUNCATE = 4000;
/**
 * PbxAgentDiffService — persists confirmation cards and confirms them.
 *
 * Confirming resolves the write from the adapter that produced the proposal:
 * the tool name in the stored payload is looked up in the adapter registry and
 * the adapter's own `revalidate`/`apply` pair runs. There is no per-tool branch
 * here, so a mutation can no longer be proposed without a matching write, and an
 * apply branch can no longer outlive the tool that fed it.
 */
let PbxAgentDiffService = PbxAgentDiffService_1 = class PbxAgentDiffService {
    proposalModel;
    routeApplyService;
    loggerService;
    auditModel;
    registry;
    logger = new common_1.Logger(PbxAgentDiffService_1.name);
    constructor(proposalModel, routeApplyService, loggerService, auditModel, registry) {
        this.proposalModel = proposalModel;
        this.routeApplyService = routeApplyService;
        this.loggerService = loggerService;
        this.auditModel = auditModel;
        this.registry = registry;
    }
    async createProposal(proposal, ctx) {
        const dto = (0, agent_diff_dto_1.parseAgentDiffProposal)(this.stampFromRegistry(proposal));
        const proposalId = dto.proposalId || (0, crypto_1.randomUUID)();
        const now = new Date();
        const row = await this.proposalModel.create({
            proposal_id: proposalId,
            thread_uid: ctx.threadUid ?? 0,
            vpbx_user_uid: ctx.vpbxUserUid,
            user_uid: ctx.userUid,
            entity_type: dto.entityType,
            entity_label: dto.entityLabel,
            summary: dto.summary,
            before_json: dto.before ?? null,
            after_json: dto.after ?? null,
            apply_payload: {
                tool: dto.applyPayload.tool, args: dto.applyPayload.args,
                schemaVersion: dto.applyPayload.schemaVersion,
            },
            includes_dialplan_reload: dto.includesDialplanReload,
            status: 'pending',
            error: null,
            expires_at: new Date(now.getTime() + PROPOSAL_TTL_MS),
            applied_at: null,
            created_at: now,
        });
        return (0, agent_diff_dto_1.toProposalView)(row);
    }
    /**
     * Any entry path that persists a card (MCP dispatch or a unit test that calls
     * createProposal with a raw adapter proposal) gets the adapter's schema version
     * and reload policy. The model never supplies either.
     */
    stampFromRegistry(proposal) {
        if (!proposal || typeof proposal !== 'object' || Array.isArray(proposal))
            return proposal;
        const rec = proposal;
        const payload = (rec.applyPayload && typeof rec.applyPayload === 'object'
            ? rec.applyPayload
            : {});
        const toolName = typeof payload.tool === 'string' ? payload.tool : '';
        const tool = toolName && typeof this.registry?.getMutationTool === 'function'
            ? this.registry.getMutationTool(toolName)
            : undefined;
        if (!tool)
            return proposal;
        let args;
        try {
            args = (0, ai_mutation_contract_1.parseMutationArgs)(tool.mutation, (0, ai_mutation_contract_1.stripTenantAliasesDeep)(payload.args ?? {}));
        }
        catch {
            args = (0, ai_mutation_contract_1.stripTenantAliasesDeep)((payload.args ?? {}));
        }
        return {
            ...rec,
            applyPayload: {
                tool: toolName,
                args,
                schemaVersion: tool.mutation.schemaVersion,
            },
            includesDialplanReload: tool.mutation.reload.kind !== 'none',
        };
    }
    async getPending(ctx) {
        const rows = await this.proposalModel.findAll({
            where: {
                vpbx_user_uid: ctx.vpbxUserUid,
                user_uid: ctx.userUid,
                status: 'pending',
            },
        });
        const now = Date.now();
        return rows
            .filter((row) => new Date(row.expires_at).getTime() > now)
            .map((row) => (0, agent_diff_dto_1.toProposalView)(row));
    }
    async apply(proposalId, ctx) {
        const startedAt = Date.now();
        const owned = await this.findOwned(proposalId, ctx);
        if (!owned) {
            const result = { ok: false, reason: 'not_pending' };
            await this.writeApplyAudit(ctx, 'apply', {}, result, 'error', startedAt);
            return result;
        }
        // Idempotent: a second Apply (or a racing retry) after success must not look like failure.
        if (owned.status === 'applied') {
            return { ok: true, proposal: (0, agent_diff_dto_1.toProposalView)(owned) };
        }
        if (owned.status !== 'pending') {
            const result = { ok: false, reason: 'not_pending', proposal: (0, agent_diff_dto_1.toProposalView)(owned) };
            await this.writeApplyAudit(ctx, this.toolNameOf(owned), owned.apply_payload, result, 'error', startedAt);
            return result;
        }
        let row = owned;
        let payload = (row.apply_payload ?? {});
        if (new Date(row.expires_at).getTime() <= Date.now()) {
            return this.refuse(row, ctx, 'expired', startedAt, 'error');
        }
        if (!this.canMutate(ctx)) {
            await this.proposalModel.update({ status: 'denied' }, {
                where: { proposal_id: proposalId, vpbx_user_uid: ctx.vpbxUserUid,
                    user_uid: ctx.userUid, status: 'pending', applied_at: null },
            });
            const result = { ok: false, reason: 'denied', proposal: (0, agent_diff_dto_1.toProposalView)(row) };
            await this.writeApplyAudit(ctx, this.toolNameOf(row), payload, result, 'denied', startedAt);
            return result;
        }
        const tool = payload.tool ? this.registry.getMutationTool(payload.tool) : undefined;
        if (!tool) {
            return this.refuse(row, ctx, `unknown apply tool: ${payload.tool ?? '(none)'}`, startedAt, 'error');
        }
        const mutation = tool.mutation;
        if (payload.schemaVersion !== mutation.schemaVersion) {
            return this.refuse(row, ctx, `stale proposal: schema ${payload.schemaVersion ?? '(none)'} is not ${mutation.schemaVersion}`, startedAt, 'denied');
        }
        let args;
        try {
            args = (0, ai_mutation_contract_1.parseMutationArgs)(mutation, (0, ai_mutation_contract_1.stripTenantAliasesDeep)(payload.args ?? {}));
        }
        catch (err) {
            return this.refuse(row, ctx, err?.message ?? String(err), startedAt, 'error');
        }
        if (row.entity_type === 'route') {
            const precedence = (0, route_precedence_util_1.checkRoutePrecedence)((0, route_precedence_util_1.patternsFromProposal)(row));
            if (!precedence.safe) {
                return this.refuse(row, ctx, `precedence: catch-all ${precedence.catchAll} would shadow ${precedence.shadowed}`, startedAt, 'denied');
            }
        }
        // Never steal a claim: a timeout cannot prove that a domain write did not run.
        // A crashed/ambiguous write requires reconciliation by an operator.
        const [claimed] = await this.proposalModel.update({ applied_at: new Date() }, {
            where: {
                proposal_id: proposalId,
                vpbx_user_uid: ctx.vpbxUserUid,
                user_uid: ctx.userUid,
                status: 'pending',
                applied_at: null,
            },
        });
        if (!claimed) {
            const again = await this.findOwned(proposalId, ctx);
            if (again?.status === 'applied') {
                return { ok: true, proposal: (0, agent_diff_dto_1.toProposalView)(again) };
            }
            const reason = again?.applied_at ? 'in_progress_or_reconciliation_required' : 'not_pending';
            const result = {
                ok: false,
                reason,
                error: again?.error ?? undefined,
                proposal: again ? (0, agent_diff_dto_1.toProposalView)(again) : undefined,
            };
            await this.writeApplyAudit(ctx, this.toolNameOf(row), payload, result, 'error', startedAt);
            return result;
        }
        // Re-read after claiming: an earlier owner may have saved its checkpoint and
        // released the reload lock after our initial read.
        row = (await this.findOwned(proposalId, ctx));
        payload = row.apply_payload;
        if (payload.execution?.writeCompleted) {
            return this.finishReload(row, payload.execution.reloadContextUid, ctx, startedAt);
        }
        const mutationCtx = this.mutationContext(ctx);
        let revalidated;
        try {
            const check = await mutation.revalidate(args, mutationCtx);
            if (!check.ok) {
                await this.releaseClaim(row);
                return this.refuse(row, ctx, check.reason, startedAt, 'denied');
            }
            revalidated = check.args;
        }
        catch (err) {
            await this.releaseClaim(row);
            return this.refuse(row, ctx, err?.message ?? String(err), startedAt, 'error');
        }
        this.logger.log(`apply ${payload.tool} tenant=${ctx.vpbxUserUid}`);
        // Resolve the reload target before performing any writes.
        let reloadContextUid;
        try {
            reloadContextUid = mutation.reload.kind === 'dialplan-context'
                ? mutation.reload.contextUid(revalidated) : null;
        }
        catch (err) {
            await this.releaseClaim(row);
            return this.refuse(row, ctx, err?.message ?? String(err), startedAt, 'error');
        }
        try {
            await mutation.apply(revalidated, mutationCtx);
        }
        catch (err) {
            // apply may have committed before throwing. Keep the claim until reconciled.
            await row.update({ error: err?.message ?? String(err) });
            const result = { ok: false, reason: 'write_failed', error: err?.message ?? String(err) };
            await this.writeApplyAudit(ctx, this.toolNameOf(row), payload, result, 'error', startedAt);
            return result;
        }
        await row.update({ apply_payload: {
                ...payload, execution: { writeCompleted: true, reloadContextUid },
            } });
        return this.finishReload(row, reloadContextUid, ctx, startedAt);
    }
    async finishReload(row, contextUid, ctx, startedAt) {
        const reloadFailure = await this.reloadDialplan(contextUid, ctx);
        if (reloadFailure) {
            await row.update({ error: reloadFailure });
            // A durable checkpoint now makes a retry safe: only reload can run again.
            await this.releaseClaim(row);
            const result = { ok: false, reason: 'switch_failed', error: reloadFailure };
            await this.writeApplyAudit(ctx, this.toolNameOf(row), row.apply_payload, result, 'error', startedAt);
            return result;
        }
        await row.update({ status: 'applied', applied_at: new Date(), error: null });
        const result = { ok: true, proposal: (0, agent_diff_dto_1.toProposalView)(row) };
        await this.writeApplyAudit(ctx, this.toolNameOf(row), row.apply_payload, result, 'ok', startedAt);
        return result;
    }
    async reject(proposalId, ctx) {
        let row = await this.findOwnedPending(proposalId, ctx);
        if (!row || row.apply_payload.execution?.writeCompleted) {
            return { ok: false, reason: 'not_pending' };
        }
        const [rejected] = await this.proposalModel.update({ applied_at: new Date() }, {
            where: { proposal_id: proposalId, vpbx_user_uid: ctx.vpbxUserUid,
                user_uid: ctx.userUid, status: 'pending', applied_at: null },
        });
        if (!rejected)
            return { ok: false, reason: 'in_progress_or_reconciliation_required' };
        row = (await this.findOwned(proposalId, ctx));
        if (row.apply_payload.execution?.writeCompleted) {
            await this.releaseClaim(row);
            return { ok: false, reason: 'reload_required', proposal: (0, agent_diff_dto_1.toProposalView)(row) };
        }
        await row.update({ status: 'rejected', applied_at: null });
        return { ok: true, proposal: (0, agent_diff_dto_1.toProposalView)(row) };
    }
    /**
     * Reload scope comes from the adapter's policy applied to the canonical args,
     * never from a flag the model could have supplied.
     */
    async reloadDialplan(contextUid, ctx) {
        if (contextUid === null)
            return null;
        try {
            await this.routeApplyService.applyContext(contextUid, ctx.vpbxUserUid, ctx.role === user_model_1.UserLevel.ADMIN);
            return null;
        }
        catch (err) {
            return err?.message ?? String(err);
        }
    }
    mutationContext(ctx) {
        return {
            vpbxUserUid: ctx.vpbxUserUid,
            userUid: ctx.userUid,
            role: ctx.role,
            isAdmin: ctx.role === user_model_1.UserLevel.ADMIN,
        };
    }
    async releaseClaim(row) {
        // Must use Model.update: after a bulk claim the in-memory instance still has
        // applied_at=null, so instance.update({ applied_at: null }) is a no-op in Sequelize
        // and leaves the DB row stuck (pending + applied_at set) → retries return not_pending.
        await this.proposalModel.update({ applied_at: null }, {
            where: {
                proposal_id: row.proposal_id,
                status: 'pending',
            },
        });
        row.applied_at = null;
    }
    async refuse(row, ctx, reason, startedAt, status) {
        if (status === 'denied') {
            await row.update({ error: reason });
        }
        const result = { ok: false, reason, proposal: (0, agent_diff_dto_1.toProposalView)(row) };
        await this.writeApplyAudit(ctx, this.toolNameOf(row), row.apply_payload, result, status, startedAt);
        return result;
    }
    canMutate(ctx) {
        return ctx.role !== user_model_1.UserLevel.READONLY;
    }
    toolNameOf(row) {
        const payload = row.apply_payload;
        return payload?.tool || 'apply';
    }
    async writeApplyAudit(ctx, toolName, args, result, status, startedAt) {
        const duration = Date.now() - startedAt;
        const actionDetails = this.truncate(this.safeJson(args), ACTION_LOG_TRUNCATE);
        await this.loggerService.logAction(ctx.userUid, 'ai_apply', toolName, null, ctx.vpbxUserUid, actionDetails, status === 'ok' ? 'success' : 'error');
        await this.auditModel.create({
            thread_uid: ctx.threadUid ?? 0,
            user_uid: ctx.vpbxUserUid,
            tool_name: toolName,
            args: this.truncate(this.safeJson(args), AUDIT_TRUNCATE),
            result: this.truncate(this.safeJson(result), AUDIT_TRUNCATE),
            duration_ms: duration,
            status,
        });
    }
    safeJson(value) {
        try {
            return JSON.stringify(value ?? {});
        }
        catch {
            return String(value);
        }
    }
    truncate(text, max) {
        return text.length > max ? `${text.slice(0, max)}...` : text;
    }
    findOwnedPending(proposalId, ctx) {
        return this.proposalModel.findOne({
            where: {
                proposal_id: proposalId,
                vpbx_user_uid: ctx.vpbxUserUid,
                user_uid: ctx.userUid,
                status: 'pending',
            },
        });
    }
    findOwned(proposalId, ctx) {
        return this.proposalModel.findOne({
            where: {
                proposal_id: proposalId,
                vpbx_user_uid: ctx.vpbxUserUid,
                user_uid: ctx.userUid,
            },
        });
    }
};
exports.PbxAgentDiffService = PbxAgentDiffService;
exports.PbxAgentDiffService = PbxAgentDiffService = PbxAgentDiffService_1 = __decorate([
    (0, common_1.Injectable)(),
    __param(0, (0, sequelize_1.InjectModel)(agent_proposal_model_1.AgentProposal)),
    __param(3, (0, sequelize_1.InjectModel)(ai_audit_log_model_1.CcAiAuditLog)),
    __metadata("design:paramtypes", [Object, route_apply_service_1.RouteApplyService,
        logger_service_1.LoggerService, Object, ai_adapter_registry_service_1.AiAdapterRegistryService])
], PbxAgentDiffService);
//# sourceMappingURL=pbx-agent-diff.service.js.map