import { Injectable, Logger } from '@nestjs/common';
import { InjectModel } from '@nestjs/sequelize';
import { randomUUID } from 'crypto';
import { UserLevel } from '../users/user.model';
import { RouteApplyService } from '../routes/route-apply.service';
import { LoggerService } from '../logger/logger.service';
import { CcAiAuditLog } from '../ai-agents/models/ai-audit-log.model';
import { AiAdapterRegistryService } from '../ai-platform/ai-adapter-registry.service';
import {
  parseMutationArgs,
  stripTenantAliasesDeep,
  type AiMutationContext,
  type AiMutationContract,
} from '../ai-platform/ai-mutation.contract';
import { AgentProposal } from './models/agent-proposal.model';
import {
  parseAgentDiffProposal,
  toProposalView,
  type AgentProposalView,
} from './dto/agent-diff.dto';
import { checkRoutePrecedence, patternsFromProposal } from './route-precedence.util';

const PROPOSAL_TTL_MS = 24 * 60 * 60 * 1000;
const ACTION_LOG_TRUNCATE = 200;
const AUDIT_TRUNCATE = 4000;

export interface ProposalContext {
  vpbxUserUid: number;
  userUid: number;
  role: number;
  threadUid?: number;
}

export interface ProposalActionResult {
  ok: boolean;
  reason?: string;
  error?: string;
  proposal?: AgentProposalView;
}

interface StoredPayload {
  tool?: string;
  args?: Record<string, unknown>;
  schemaVersion?: string;
}

/**
 * PbxAgentDiffService — persists confirmation cards and confirms them.
 *
 * Confirming resolves the write from the adapter that produced the proposal:
 * the tool name in the stored payload is looked up in the adapter registry and
 * the adapter's own `revalidate`/`apply` pair runs. There is no per-tool branch
 * here, so a mutation can no longer be proposed without a matching write, and an
 * apply branch can no longer outlive the tool that fed it.
 */
@Injectable()
export class PbxAgentDiffService {
  private readonly logger = new Logger(PbxAgentDiffService.name);

  constructor(
    @InjectModel(AgentProposal) private readonly proposalModel: typeof AgentProposal,
    private readonly routeApplyService: RouteApplyService,
    private readonly loggerService: LoggerService,
    @InjectModel(CcAiAuditLog) private readonly auditModel: typeof CcAiAuditLog,
    private readonly registry: AiAdapterRegistryService,
  ) {}

  async createProposal(proposal: unknown, ctx: ProposalContext): Promise<AgentProposalView> {
    const dto = parseAgentDiffProposal(this.stampFromRegistry(proposal));
    const proposalId = dto.proposalId || randomUUID();
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
      apply_payload: dto.applyPayload,
      includes_dialplan_reload: dto.includesDialplanReload,
      status: 'pending',
      error: null,
      expires_at: new Date(now.getTime() + PROPOSAL_TTL_MS),
      applied_at: null,
      created_at: now,
    });
    return toProposalView(row);
  }

  /**
   * Any entry path that persists a card (MCP dispatch or a unit test that calls
   * createProposal with a raw adapter proposal) gets the adapter's schema version
   * and reload policy. The model never supplies either.
   */
  private stampFromRegistry(proposal: unknown): unknown {
    if (!proposal || typeof proposal !== 'object' || Array.isArray(proposal)) return proposal;
    const rec = proposal as Record<string, unknown>;
    const payload = (rec.applyPayload && typeof rec.applyPayload === 'object'
      ? rec.applyPayload
      : {}) as Record<string, unknown>;
    const toolName = typeof payload.tool === 'string' ? payload.tool : '';
    const tool =
      toolName && typeof this.registry?.getMutationTool === 'function'
        ? this.registry.getMutationTool(toolName)
        : undefined;
    if (!tool) return proposal;
    let args: Record<string, unknown>;
    try {
      args = parseMutationArgs(tool.mutation, stripTenantAliasesDeep(payload.args ?? {})) as Record<
        string,
        unknown
      >;
    } catch {
      args = stripTenantAliasesDeep((payload.args ?? {}) as Record<string, unknown>);
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

  async getPending(ctx: ProposalContext): Promise<AgentProposalView[]> {
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
      .map((row) => toProposalView(row));
  }

  async apply(proposalId: string, ctx: ProposalContext): Promise<ProposalActionResult> {
    const startedAt = Date.now();
    const owned = await this.findOwned(proposalId, ctx);
    if (!owned) {
      const result = { ok: false, reason: 'not_pending' };
      await this.writeApplyAudit(ctx, 'apply', {}, result, 'error', startedAt);
      return result;
    }
    // Idempotent: a second Apply (or a racing retry) after success must not look like failure.
    if (owned.status === 'applied') {
      return { ok: true, proposal: toProposalView(owned) };
    }
    if (owned.status !== 'pending') {
      const result = { ok: false, reason: 'not_pending', proposal: toProposalView(owned) };
      await this.writeApplyAudit(ctx, this.toolNameOf(owned), owned.apply_payload, result, 'error', startedAt);
      return result;
    }
    const row = owned;
    const payload = (row.apply_payload ?? {}) as StoredPayload;
    if (new Date(row.expires_at).getTime() <= Date.now()) {
      return this.refuse(row, ctx, 'expired', startedAt, 'error');
    }

    if (!this.canMutate(ctx)) {
      await row.update({ status: 'denied' });
      const result = { ok: false, reason: 'denied', proposal: toProposalView(row) };
      await this.writeApplyAudit(ctx, this.toolNameOf(row), payload, result, 'denied', startedAt);
      return result;
    }

    const tool = payload.tool ? this.registry.getMutationTool(payload.tool) : undefined;
    if (!tool) {
      return this.refuse(row, ctx, `unknown apply tool: ${payload.tool ?? '(none)'}`, startedAt, 'error');
    }
    const mutation = tool.mutation;
    if (payload.schemaVersion !== mutation.schemaVersion) {
      return this.refuse(
        row,
        ctx,
        `stale proposal: schema ${payload.schemaVersion ?? '(none)'} is not ${mutation.schemaVersion}`,
        startedAt,
        'denied',
      );
    }

    let args: unknown;
    try {
      args = parseMutationArgs(mutation, stripTenantAliasesDeep(payload.args ?? {}));
    } catch (err: any) {
      return this.refuse(row, ctx, err?.message ?? String(err), startedAt, 'error');
    }

    if (row.entity_type === 'route') {
      const precedence = checkRoutePrecedence(patternsFromProposal(row));
      if (!precedence.safe) {
        return this.refuse(
          row,
          ctx,
          `precedence: catch-all ${precedence.catchAll} would shadow ${precedence.shadowed}`,
          startedAt,
          'denied',
        );
      }
    }

    // Single-winner claim. A second confirmation of the same card finds the row
    // already claimed — if the winner finished, treat as idempotent success.
    // If a prior attempt left a stuck claim (pending + applied_at), release and retry once.
    let claimed = 0;
    for (let attempt = 0; attempt < 2; attempt += 1) {
      const [count] = await this.proposalModel.update(
        { applied_at: new Date() },
        {
          where: {
            proposal_id: proposalId,
            vpbx_user_uid: ctx.vpbxUserUid,
            user_uid: ctx.userUid,
            status: 'pending',
            applied_at: null,
          },
        },
      );
      claimed = count;
      if (claimed) break;

      const again = await this.findOwned(proposalId, ctx);
      if (again?.status === 'applied') {
        return { ok: true, proposal: toProposalView(again) };
      }
      if (again?.status === 'pending' && again.applied_at && attempt === 0) {
        this.logger.warn(
          `releasing stuck claim proposal=${proposalId} priorError=${again.error ?? '(none)'}`,
        );
        await this.releaseClaim(again);
        continue;
      }
      const reason = again?.error?.trim() || 'not_pending';
      const result = {
        ok: false,
        reason,
        error: again?.error ?? undefined,
        proposal: again ? toProposalView(again) : undefined,
      };
      await this.writeApplyAudit(ctx, this.toolNameOf(row), payload, result, 'error', startedAt);
      return result;
    }
    if (!claimed) {
      const result = { ok: false, reason: 'not_pending' };
      await this.writeApplyAudit(ctx, this.toolNameOf(row), payload, result, 'error', startedAt);
      return result;
    }

    const mutationCtx = this.mutationContext(ctx);
    let revalidated: unknown;
    try {
      const check = await mutation.revalidate(args, mutationCtx);
      if (!check.ok) {
        await this.releaseClaim(row);
        return this.refuse(row, ctx, check.reason, startedAt, 'denied');
      }
      revalidated = check.args;
    } catch (err: any) {
      await this.releaseClaim(row);
      return this.refuse(row, ctx, err?.message ?? String(err), startedAt, 'error');
    }

    this.logger.log(`apply ${payload.tool} tenant=${ctx.vpbxUserUid}`);
    try {
      await mutation.apply(revalidated, mutationCtx);
    } catch (err: any) {
      await this.releaseClaim(row);
      await row.update({ error: err?.message ?? String(err) });
      const result = { ok: false, reason: 'write_failed', error: err?.message ?? String(err) };
      await this.writeApplyAudit(ctx, this.toolNameOf(row), payload, result, 'error', startedAt);
      return result;
    }

    const reloadFailure = await this.reloadDialplan(mutation, revalidated, ctx);
    if (reloadFailure) {
      await row.update({ error: reloadFailure });
      const result = { ok: false, reason: 'switch_failed', error: reloadFailure };
      await this.writeApplyAudit(ctx, this.toolNameOf(row), payload, result, 'error', startedAt);
      return result;
    }

    await row.update({ status: 'applied', applied_at: new Date(), error: null });
    const result = { ok: true, proposal: toProposalView(row) };
    await this.writeApplyAudit(ctx, this.toolNameOf(row), payload, result, 'ok', startedAt);
    return result;
  }

  async reject(proposalId: string, ctx: ProposalContext): Promise<ProposalActionResult> {
    const row = await this.findOwnedPending(proposalId, ctx);
    if (!row) {
      return { ok: false, reason: 'not_pending' };
    }
    await row.update({ status: 'rejected' });
    return { ok: true, proposal: toProposalView(row) };
  }

  /**
   * Reload scope comes from the adapter's policy applied to the canonical args,
   * never from a flag the model could have supplied.
   */
  private async reloadDialplan(
    mutation: AiMutationContract,
    args: unknown,
    ctx: ProposalContext,
  ): Promise<string | null> {
    if (mutation.reload.kind !== 'dialplan-context') return null;
    try {
      const contextUid = mutation.reload.contextUid(args);
      await this.routeApplyService.applyContext(
        contextUid,
        ctx.vpbxUserUid,
        ctx.role === UserLevel.ADMIN,
      );
      return null;
    } catch (err: any) {
      return err?.message ?? String(err);
    }
  }

  private mutationContext(ctx: ProposalContext): AiMutationContext {
    return {
      vpbxUserUid: ctx.vpbxUserUid,
      userUid: ctx.userUid,
      role: ctx.role,
      isAdmin: ctx.role === UserLevel.ADMIN,
    };
  }

  private async releaseClaim(row: AgentProposal): Promise<void> {
    // Must use Model.update: after a bulk claim the in-memory instance still has
    // applied_at=null, so instance.update({ applied_at: null }) is a no-op in Sequelize
    // and leaves the DB row stuck (pending + applied_at set) → retries return not_pending.
    await this.proposalModel.update(
      { applied_at: null },
      {
        where: {
          proposal_id: row.proposal_id,
          status: 'pending',
        },
      },
    );
    row.applied_at = null;
  }

  private async refuse(
    row: AgentProposal,
    ctx: ProposalContext,
    reason: string,
    startedAt: number,
    status: 'error' | 'denied',
  ): Promise<ProposalActionResult> {
    if (status === 'denied') {
      await row.update({ error: reason });
    }
    const result = { ok: false, reason, proposal: toProposalView(row) };
    await this.writeApplyAudit(ctx, this.toolNameOf(row), row.apply_payload, result, status, startedAt);
    return result;
  }

  private canMutate(ctx: ProposalContext): boolean {
    return ctx.role !== UserLevel.READONLY;
  }

  private toolNameOf(row: AgentProposal): string {
    const payload = row.apply_payload as StoredPayload | null;
    return payload?.tool || 'apply';
  }

  private async writeApplyAudit(
    ctx: ProposalContext,
    toolName: string,
    args: unknown,
    result: unknown,
    status: 'ok' | 'error' | 'denied',
    startedAt: number,
  ): Promise<void> {
    const duration = Date.now() - startedAt;
    const actionDetails = this.truncate(this.safeJson(args), ACTION_LOG_TRUNCATE);
    await this.loggerService.logAction(
      ctx.userUid,
      'ai_apply',
      toolName,
      null,
      ctx.vpbxUserUid,
      actionDetails,
      status === 'ok' ? 'success' : 'error',
    );
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

  private safeJson(value: unknown): string {
    try {
      return JSON.stringify(value ?? {});
    } catch {
      return String(value);
    }
  }

  private truncate(text: string, max: number): string {
    return text.length > max ? `${text.slice(0, max)}...` : text;
  }

  private findOwnedPending(proposalId: string, ctx: ProposalContext): Promise<AgentProposal | null> {
    return this.proposalModel.findOne({
      where: {
        proposal_id: proposalId,
        vpbx_user_uid: ctx.vpbxUserUid,
        user_uid: ctx.userUid,
        status: 'pending',
      },
    });
  }

  private findOwned(proposalId: string, ctx: ProposalContext): Promise<AgentProposal | null> {
    return this.proposalModel.findOne({
      where: {
        proposal_id: proposalId,
        vpbx_user_uid: ctx.vpbxUserUid,
        user_uid: ctx.userUid,
      },
    });
  }
}
