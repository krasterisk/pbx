import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/sequelize';
import { randomUUID } from 'crypto';
import type { IDirectoryRecord } from '@krasterisk/shared';
import { UserLevel } from '../users/user.model';
import { RouteApplyService } from '../routes/route-apply.service';
import { RoutesService } from '../routes/routes.service';
import { DirectoriesService } from '../directories/directories.service';
import type { DirectoryRecordDto } from '../directories/dto/directory.dto';
import { EndpointsService } from '../endpoints/endpoints.service';
import { TrunksService } from '../trunks/trunks.service';
import { confirmTrunkDelete } from '../trunks/trunks-ai.adapter';
import { LoggerService } from '../logger/logger.service';
import { CcAiAuditLog } from '../ai-agents/models/ai-audit-log.model';
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

@Injectable()
export class PbxAgentDiffService {
  constructor(
    @InjectModel(AgentProposal) private readonly proposalModel: typeof AgentProposal,
    private readonly routeApplyService: RouteApplyService,
    private readonly directoriesService: DirectoriesService,
    private readonly routesService: RoutesService,
    private readonly endpointsService: EndpointsService,
    private readonly trunksService: TrunksService,
    private readonly loggerService: LoggerService,
    @InjectModel(CcAiAuditLog) private readonly auditModel: typeof CcAiAuditLog,
  ) {}

  async createProposal(proposal: unknown, ctx: ProposalContext): Promise<AgentProposalView> {
    const dto = parseAgentDiffProposal(proposal);
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
    const row = await this.findOwnedPending(proposalId, ctx);
    if (!row) {
      const result = { ok: false, reason: 'not_pending' };
      await this.writeApplyAudit(ctx, 'apply', {}, result, 'error', startedAt);
      return result;
    }
    if (new Date(row.expires_at).getTime() <= Date.now()) {
      const result = { ok: false, reason: 'expired' };
      await this.writeApplyAudit(ctx, this.toolNameOf(row), row.apply_payload, result, 'error', startedAt);
      return result;
    }

    if (!this.canMutate(ctx)) {
      await row.update({ status: 'denied' });
      const result = { ok: false, reason: 'denied', proposal: toProposalView(row) };
      await this.writeApplyAudit(ctx, this.toolNameOf(row), row.apply_payload, result, 'denied', startedAt);
      return result;
    }

    if (row.entity_type === 'route') {
      const precedence = checkRoutePrecedence(patternsFromProposal(row));
      if (!precedence.safe) {
        const reason = `precedence: catch-all ${precedence.catchAll} would shadow ${precedence.shadowed}`;
        await row.update({ error: reason });
        const result = { ok: false, reason, proposal: toProposalView(row) };
        await this.writeApplyAudit(ctx, this.toolNameOf(row), row.apply_payload, result, 'denied', startedAt);
        return result;
      }
    }

    try {
      await this.executePayload(row.apply_payload as { tool: string; args: Record<string, unknown> }, ctx);
    } catch (err: any) {
      await row.update({ error: err?.message ?? String(err) });
      const result = { ok: false, reason: 'write_failed', error: err?.message ?? String(err) };
      await this.writeApplyAudit(ctx, this.toolNameOf(row), row.apply_payload, result, 'error', startedAt);
      return result;
    }

    if (row.includes_dialplan_reload) {
      try {
        const contextUid = this.contextUidFrom(row.apply_payload as { args?: Record<string, unknown> });
        await this.routeApplyService.applyContext(
          contextUid,
          ctx.vpbxUserUid,
          ctx.role === UserLevel.ADMIN,
        );
      } catch (err: any) {
        await row.update({ error: err?.message ?? String(err) });
        const result = { ok: false, reason: 'switch_failed', error: err?.message ?? String(err) };
        await this.writeApplyAudit(ctx, this.toolNameOf(row), row.apply_payload, result, 'error', startedAt);
        return result;
      }
    }

    await row.update({ status: 'applied', applied_at: new Date(), error: null });
    const result = { ok: true, proposal: toProposalView(row) };
    await this.writeApplyAudit(ctx, this.toolNameOf(row), row.apply_payload, result, 'ok', startedAt);
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

  private canMutate(ctx: ProposalContext): boolean {
    return ctx.role !== UserLevel.READONLY;
  }

  private toolNameOf(row: AgentProposal): string {
    const payload = row.apply_payload as { tool?: string } | null;
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

  private contextUidFrom(payload: { args?: Record<string, unknown> }): number {
    const args = payload.args ?? {};
    return Number(args.context_uid ?? args.contextUid);
  }

  private async executePayload(
    payload: { tool: string; args: Record<string, unknown> },
    ctx: ProposalContext,
  ): Promise<void> {
    const args = payload.args ?? {};
    const uid = ctx.vpbxUserUid;
    switch (payload.tool) {
      case 'create_directory':
        await this.directoriesService.create(args as any, uid);
        return;
      case 'update_directory': {
        const { uid: directoryUid, ...rest } = args;
        await this.directoriesService.update(Number(directoryUid), rest as any, uid);
        return;
      }
      case 'delete_directory':
        await this.directoriesService.remove(Number(args.uid), uid);
        return;
      case 'add_directory_records': {
        const directoryUid = Number(args.uid);
        const incoming = (args.records ?? []) as DirectoryRecordDto[];
        const current = await this.directoriesService.findOne(directoryUid, uid);
        const merged = [...this.toRecordDtos(current.records ?? []), ...incoming];
        await this.directoriesService.update(directoryUid, { records: merged }, uid);
        return;
      }
      case 'remove_directory_records': {
        const directoryUid = Number(args.uid);
        const lookupValues = new Set((args.lookup_values as unknown[] ?? []).map((value) => String(value)));
        const recordUids = new Set((args.record_uids as unknown[] ?? []).map((value) => Number(value)));
        const current = await this.directoriesService.findOne(directoryUid, uid);
        const remaining = (current.records ?? []).filter((record) => {
          if (recordUids.has(record.uid)) return false;
          if (lookupValues.has(String(record.lookup_value))) return false;
          return true;
        });
        await this.directoriesService.update(directoryUid, { records: this.toRecordDtos(remaining) }, uid);
        return;
      }
      case 'create_route':
        await this.routesService.create(args as any, uid);
        return;
      case 'update_route': {
        const { id, ...rest } = args;
        await this.routesService.update(Number(id), rest as any, uid);
        return;
      }
      case 'delete_route':
        await this.routesService.remove(Number(args.id), uid);
        return;
      case 'create_endpoint':
        await this.endpointsService.createWithGeneratedCredentials(args as any, uid);
        return;
      case 'create_endpoints_bulk':
        await this.endpointsService.bulkCreate(args as any, uid);
        return;
      case 'delete_endpoint':
        await this.endpointsService.remove(String(args.sipId), uid);
        return;
      case 'create_trunk':
        await this.trunksService.create(args as any, uid);
        return;
      case 'delete_trunk': {
        const result = await confirmTrunkDelete(
          this.trunksService,
          this.routesService,
          String(args.trunkId),
          uid,
        );
        if (!result.ok) {
          const names = (result.references ?? []).map((row) => row.name).join(', ');
          throw new Error(`Trunk is referenced by routes: ${names}`);
        }
        return;
      }
      default:
        throw new Error(`Unsupported apply tool: ${payload.tool}`);
    }
  }

  private toRecordDtos(records: IDirectoryRecord[]): DirectoryRecordDto[] {
    return records.map((record) => ({
      values: (record.values ?? {}) as Record<string, string | number | boolean>,
      comment: record.comment,
    }));
  }
}
