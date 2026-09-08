import { Controller, Get, NotFoundException, Param, ParseIntPipe, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { SkipThrottle } from '@nestjs/throttler';
import { InjectModel } from '@nestjs/sequelize';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { SuperAdminGuard } from '../auth/superadmin.guard';
import { User, UserLevel } from '../users/user.model';
import { AgentProposal } from './models/agent-proposal.model';
import { AgentThread } from './models/agent-thread.model';
import { AgentThreadMessage } from './models/agent-thread-message.model';
import { toProposalView, type AgentProposalView } from './dto/agent-diff.dto';
import { buildTimeline, type TimelineProposalRef } from './agent-timeline.util';
import { PbxAgentThreadService } from './pbx-agent-thread.service';
import { PbxWorkflowRunnerService, type WorkflowPlanView } from './pbx-workflow-runner.service';

/**
 * Platform-administrator read-only view of tenant conversations (F4).
 * Tenant comes from the path — never from the JWT vpbx_user_uid.
 */
@ApiTags('AI Chat')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, SuperAdminGuard)
@Controller('cloud-admin/ai-chat')
export class PlatformAiThreadsController {
  constructor(
    private readonly threads: PbxAgentThreadService,
    @InjectModel(AgentProposal) private readonly proposals: typeof AgentProposal,
    private readonly workflows: PbxWorkflowRunnerService,
    @InjectModel(User) private readonly users: typeof User,
  ) {}

  @ApiOperation({ summary: 'List conversations of a tenant (platform read-only)' })
  @SkipThrottle({ default: true, global: true })
  @Get('tenants/:tenantUid/threads')
  async listThreads(@Param('tenantUid', ParseIntPipe) tenantUid: number) {
    const rows = await this.threads.listTenantThreads(tenantUid);
    const names = await this.ownerNamesByUid(rows.map((row) => row.user_uid), tenantUid);
    return rows.map((row) => ({
      ...this.toThreadJson(row),
      ownerName: names.get(row.user_uid) ?? '',
      readOnly: true as const,
    }));
  }

  @ApiOperation({ summary: 'Get one tenant conversation as a read-only timeline' })
  @SkipThrottle({ default: true, global: true })
  @Get('tenants/:tenantUid/threads/:uid')
  async getThread(
    @Param('tenantUid', ParseIntPipe) tenantUid: number,
    @Param('uid', ParseIntPipe) uid: number,
  ) {
    const thread = await this.threads.getTenantThread(uid, tenantUid);
    const threadAuthorUid = thread.user_uid;
    const messages = await this.threads.listMessages(uid, tenantUid, threadAuthorUid);
    const proposalById = await this.proposalViewsFor(messages, tenantUid, threadAuthorUid);
    const workflowById = await this.workflowViewsFor(
      messages,
      tenantUid,
      threadAuthorUid,
      new Set(proposalById.keys()),
    );
    const proposalRefs = new Map<string, TimelineProposalRef>();
    for (const id of proposalById.keys()) {
      proposalRefs.set(id, { proposalId: id, card: 'single' });
    }
    for (const id of workflowById.keys()) {
      proposalRefs.set(id, { proposalId: id, card: 'workflow' });
    }
    const timeline = buildTimeline(
      messages.filter((row) => row.visibility !== 'internal'),
      { proposals: proposalRefs },
    );
    const ownerName = (await this.ownerNamesByUid([threadAuthorUid], tenantUid)).get(threadAuthorUid) ?? '';
    return {
      ...this.toThreadJson(thread),
      ownerName,
      readOnly: true as const,
      timeline,
      cards: this.cardsFor(messages, proposalById, workflowById),
    };
  }

  private toIso(value: Date | string | null | undefined): string | null {
    if (!value) return null;
    return value instanceof Date ? value.toISOString() : String(value);
  }

  private toThreadJson(thread: AgentThread) {
    return {
      uid: thread.uid,
      title: thread.title,
      status: thread.status,
      last_message_at: this.toIso(thread.last_message_at),
      created_at: this.toIso(thread.created_at) ?? '',
      updated_at: this.toIso(thread.updated_at) ?? '',
    };
  }

  private async ownerNamesByUid(authorUids: number[], tenantUid: number): Promise<Map<number, string>> {
    const unique = [...new Set(authorUids.filter((id) => Number(id) > 0))];
    if (!unique.length) return new Map();
    const rows = await this.users.findAll({
      where: { uniqueid: unique, vpbx_user_uid: tenantUid },
      attributes: ['uniqueid', 'name', 'login'],
    });
    return new Map(rows.map((row) => [row.uniqueid, row.name || row.login || '']));
  }

  private async proposalViewsFor(
    messages: AgentThreadMessage[],
    tenantUid: number,
    authorUid: number,
  ): Promise<Map<string, ReturnType<typeof toProposalView>>> {
    const ids = [...new Set(messages.map((row) => row.proposal_id).filter((id): id is string => !!id))];
    if (!ids.length) return new Map();
    const rows = await this.proposals.findAll({
      where: { proposal_id: ids, vpbx_user_uid: tenantUid, user_uid: authorUid },
    });
    return new Map(rows.map((row) => [row.proposal_id, toProposalView(row)]));
  }

  private async workflowViewsFor(
    messages: AgentThreadMessage[],
    tenantUid: number,
    authorUid: number,
    knownProposalIds: Set<string>,
  ): Promise<Map<string, WorkflowPlanView>> {
    const ids = [...new Set(
      messages
        .map((row) => row.proposal_id)
        .filter((id): id is string => !!id && !knownProposalIds.has(id)),
    )];
    const views = new Map<string, WorkflowPlanView>();
    for (const id of ids) {
      try {
        const view = await this.workflows.getOwned(id, {
          vpbxUserUid: tenantUid,
          userUid: authorUid,
          role: UserLevel.SUPERADMIN,
        });
        views.set(id, view);
      } catch (err) {
        if (err instanceof NotFoundException) continue;
        throw err;
      }
    }
    return views;
  }

  private cardsFor(
    messages: AgentThreadMessage[],
    proposalById: Map<string, AgentProposalView>,
    workflowById: Map<string, WorkflowPlanView>,
  ): Record<string, { card: 'single'; proposal: AgentProposalView } | { card: 'workflow'; workflow: WorkflowPlanView }> {
    const cards: Record<
      string,
      { card: 'single'; proposal: AgentProposalView } | { card: 'workflow'; workflow: WorkflowPlanView }
    > = {};
    for (const message of messages) {
      if (message.visibility === 'internal') continue;
      if (message.role === 'system' || message.role === 'user' || message.role === 'assistant') continue;
      if (message.tool_name === 'read_skill') continue;
      const proposalId = message.proposal_id;
      if (!proposalId) continue;
      const itemId = `p${message.uid}`;
      const proposal = proposalById.get(proposalId);
      if (proposal) {
        cards[itemId] = { card: 'single', proposal };
        continue;
      }
      const workflow = workflowById.get(proposalId);
      if (workflow) {
        cards[itemId] = { card: 'workflow', workflow };
      }
    }
    return cards;
  }
}
