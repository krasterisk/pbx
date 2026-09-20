import {
  ConflictException, ForbiddenException, HttpException, Injectable, NotFoundException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/sequelize';
import { randomUUID } from 'node:crypto';
import { UniqueConstraintError } from 'sequelize';
import { Sequelize } from 'sequelize-typescript';
import { CcAiAgent } from '../ai-agents/models/ai-agent.model';
import { ProductAccessService } from '../product-access/product-access.service';
import { ProductResourceAuthorization } from '../integration-credentials/product-resource.authorization';
import type { TenantContext } from '../integration-credentials/tenant-context';
import {
  AiCallControlOperation, AiRobotDeployment, AiRobotDraft, AiRobotVersion,
  AiVoiceEvent, AiVoiceSession, AiVoiceTicket, AiVoiceTurn,
} from './ai-voice.models';
import {
  DEFAULT_RUNTIME_POLICY, DomainError, consumeTicket, issueTicket, snapshotDigest,
  type AgentSnapshot, type RuntimePolicy,
} from './voice-engine';
import { executeVoiceTool } from './call-control';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

@Injectable()
export class AiVoiceService {
  constructor(
    private readonly sequelize: Sequelize,
    private readonly products: ProductAccessService,
    private readonly resources: ProductResourceAuthorization,
    @InjectModel(CcAiAgent) private readonly agents: typeof CcAiAgent,
    @InjectModel(AiRobotDraft) private readonly drafts: typeof AiRobotDraft,
    @InjectModel(AiRobotVersion) private readonly versions: typeof AiRobotVersion,
    @InjectModel(AiRobotDeployment) private readonly deployments: typeof AiRobotDeployment,
    @InjectModel(AiVoiceSession) private readonly sessions: typeof AiVoiceSession,
    @InjectModel(AiVoiceTurn) private readonly turns: typeof AiVoiceTurn,
    @InjectModel(AiVoiceEvent) private readonly events: typeof AiVoiceEvent,
    @InjectModel(AiCallControlOperation) private readonly operations: typeof AiCallControlOperation,
    @InjectModel(AiVoiceTicket) private readonly tickets: typeof AiVoiceTicket,
  ) {}

  private ticketSecret(): string {
    return process.env.AI_VOICE_TICKET_SECRET || 'ai-voice-ticket-dev';
  }

  private userId(context: TenantContext): number {
    const match = /^user:(\d+)$/.exec(context.principalId);
    return match ? Number(match[1]) : 0;
  }

  private mapError(error: unknown): never {
    if (error instanceof HttpException) throw error;
    if (error instanceof DomainError) throw new HttpException({ code: error.code }, error.status);
    throw error;
  }

  async assertScope(context: TenantContext, deploymentId: string, action: string): Promise<AiRobotDeployment> {
    await this.resources.authorize(context, {
      product: 'ai_voice_robots', action, resourceKind: 'deployment', resourceId: deploymentId,
    });
    const row = await this.deployments.findOne({ where: { tenant_uid: context.tenantUid, id: deploymentId } });
    if (!row) throw new NotFoundException({ code: 'resource_not_found' });
    return row;
  }

  async listDeployments(context: TenantContext) {
    return this.deployments.findAll({
      where: { tenant_uid: context.tenantUid }, order: [['created_at', 'DESC']],
    });
  }

  async publish(context: TenantContext, agentUid: number, operationKey: string) {
    try {
      if (!operationKey) throw new DomainError('operation_key_required', 422);
      const access = await this.products.decide(context.tenantUid, 'ai_voice_robots');
      if (!access.allowed) throw new ForbiddenException({ code: access.reason ?? 'not_entitled' });
      const agent = await this.agents.findOne({ where: { uid: agentUid, user_uid: context.tenantUid } });
      if (!agent) throw new NotFoundException({ code: 'resource_not_found' });
      const snapshot = this.snapshot(agent);
      if (snapshot.mode !== 'cascade') throw new DomainError('realtime_unavailable', 409);
      if (!snapshot.enabled || !snapshot.modelProfileId || !snapshot.sttProfileId || !snapshot.ttsProfileId) {
        throw new DomainError('agent_not_ready', 409);
      }
      const previous = await this.versions.findAll({ where: { tenant_uid: context.tenantUid, agent_uid: agentUid } });
      const replayed = previous.find(row => {
        try { return JSON.parse(row.config).operationKey === operationKey; } catch { return false; }
      });
      if (replayed) return { id: replayed.id, replay: true };
      const draft = await this.ensureDraft(context.tenantUid, agentUid);
      const policy = JSON.parse(draft.runtime_policy) as RuntimePolicy;
      const version = await this.versions.create({
        id: randomUUID(), tenant_uid: context.tenantUid, agent_uid: agentUid,
        version_no: previous.length + 1, config_digest: snapshotDigest(snapshot, policy),
        config: JSON.stringify({ agent: snapshot, policy, operationKey }),
        llm_revision_id: String(snapshot.modelProfileId),
        stt_revision_id: snapshot.sttProfileId ? String(snapshot.sttProfileId) : null,
        tts_revision_id: snapshot.ttsProfileId ? String(snapshot.ttsProfileId) : null,
        created_by: this.userId(context), created_at: new Date(),
      });
      return { id: version.id, replay: false };
    } catch (error) {
      this.mapError(error);
    }
  }

  async createDeployment(context: TenantContext, input: {
    agentUid: number; kind: 'internal' | 'browser_test' | 'external_sip'; versionId?: string;
  }) {
    try {
      if (input.kind === 'external_sip') {
        return this.deployments.create({
          id: randomUUID(), tenant_uid: context.tenantUid, agent_uid: input.agentUid,
          kind: input.kind, active_version_id: null, status: 'disabled', revision: 1,
          capture_policy: '{"mode":"allow"}', fallback_policy: '{"action":"hangup"}',
          created_at: new Date(), updated_at: new Date(),
        });
      }
      if (!input.versionId || !UUID.test(input.versionId)) throw new DomainError('version_not_found', 404);
      const version = await this.versions.findOne({
        where: { id: input.versionId, tenant_uid: context.tenantUid, agent_uid: input.agentUid },
      });
      if (!version) throw new DomainError('version_not_found', 404);
      return this.deployments.create({
        id: randomUUID(), tenant_uid: context.tenantUid, agent_uid: input.agentUid,
        kind: input.kind, active_version_id: version.id, status: 'disabled', revision: 1,
        capture_policy: '{"mode":"allow"}', fallback_policy: '{"action":"hangup"}',
        created_at: new Date(), updated_at: new Date(),
      });
    } catch (error) {
      this.mapError(error);
    }
  }

  async setReady(context: TenantContext, deploymentId: string, ready: boolean) {
    try {
      const row = await this.assertScope(context, deploymentId, ready ? 'robots:deploy' : 'robots:disable');
      if (row.kind === 'external_sip' && ready) throw new DomainError('external_sip_disabled', 409);
      if (ready && !row.active_version_id) throw new DomainError('version_not_found', 409);
      row.status = ready ? 'ready' : 'disabled';
      row.revision += 1;
      row.updated_at = new Date();
      await row.save();
      return row;
    } catch (error) {
      this.mapError(error);
    }
  }

  async issueNodeTicket(context: TenantContext, input: {
    nodeId: string; channelUniqueid: string; deploymentId: string;
  }) {
    try {
      const deployment = await this.assertScope(context, input.deploymentId, 'robots:admit');
      if (deployment.status !== 'ready') throw new DomainError('deployment_not_ready', 409);
      const issued = issueTicket({
        secret: this.ticketSecret(), tenantUid: context.tenantUid, nodeId: input.nodeId,
        channelUniqueid: input.channelUniqueid, deploymentId: input.deploymentId, now: new Date(),
      });
      await this.tickets.create({
        id: issued.id, tenant_uid: context.tenantUid, node_id: input.nodeId,
        channel_uniqueid: input.channelUniqueid, deployment_id: input.deploymentId,
        digest: issued.digest, expires_at: issued.expiresAt, consumed_at: null, created_at: new Date(),
      });
      return { id: issued.id, expiresAt: issued.expiresAt.toISOString() };
    } catch (error) {
      this.mapError(error);
    }
  }

  async browserTestTicket(context: TenantContext, deploymentId: string) {
    try {
      if (context.principalKind !== 'user') throw new ForbiddenException({ code: 'tenant_admin_required' });
      const deployment = await this.assertScope(context, deploymentId, 'robots:preview');
      if (deployment.kind !== 'browser_test' || deployment.status !== 'ready') {
        throw new DomainError('deployment_not_ready', 409);
      }
      return this.issueNodeTicket(context, {
        nodeId: `browser:${this.userId(context)}`,
        channelUniqueid: randomUUID(),
        deploymentId,
      });
    } catch (error) {
      this.mapError(error);
    }
  }

  async admit(context: TenantContext, input: {
    ticketId: string; nodeId: string; channelUniqueid: string; deploymentId: string;
    ingressKind: 'native' | 'browser_test' | 'autodial'; ingressKey: string;
  }) {
    try {
      const ticket = await this.tickets.findOne({ where: { id: input.ticketId, tenant_uid: context.tenantUid } });
      if (!ticket) throw new DomainError('spoof_ticket', 403);
      consumeTicket({
        secret: this.ticketSecret(),
        ticket: {
          id: ticket.id, digest: ticket.digest, tenantUid: ticket.tenant_uid, nodeId: ticket.node_id,
          channelUniqueid: ticket.channel_uniqueid, deploymentId: ticket.deployment_id,
          expiresAt: ticket.expires_at, consumedAt: ticket.consumed_at,
        },
        claimed: {
          nodeId: input.nodeId, channelUniqueid: input.channelUniqueid,
          deploymentId: input.deploymentId, tenantUid: context.tenantUid,
        },
        now: new Date(),
      });
      ticket.consumed_at = new Date();
      await ticket.save();
      const existing = await this.sessions.findOne({
        where: { ingress_kind: input.ingressKind, ingress_key: input.ingressKey },
      });
      if (existing) return { id: existing.id, replay: true };
      const deployment = await this.deployments.findOne({
        where: { id: input.deploymentId, tenant_uid: context.tenantUid },
      });
      if (!deployment || !deployment.active_version_id) {
        throw new DomainError('deployment_not_ready', 409);
      }
      if (deployment.status === 'draining' || deployment.status === 'stopped') {
        throw new DomainError('admissions_stopped', 409);
      }
      if (deployment.status !== 'ready') {
        throw new DomainError('deployment_not_ready', 409);
      }
      try {
        const session = await this.sessions.create({
          id: randomUUID(), tenant_uid: context.tenantUid, deployment_id: deployment.id,
          version_id: deployment.active_version_id, ingress_kind: input.ingressKind,
          ingress_key: input.ingressKey, node_id: input.nodeId, channel_uniqueid: input.channelUniqueid,
          owner: 'ai-voice', fence: '1', state: 'admitted', reason: null,
          capture_intent_id: null, usage_reservation_id: null, started_at: new Date(), ended_at: null,
        });
        return { id: session.id, replay: false };
      } catch (error) {
        if (!(error instanceof UniqueConstraintError)) throw error;
        const replayed = await this.sessions.findOne({
          where: { ingress_kind: input.ingressKind, ingress_key: input.ingressKey },
        });
        if (!replayed) throw error;
        return { id: replayed.id, replay: true };
      }
    } catch (error) {
      this.mapError(error);
    }
  }

  async listSessions(context: TenantContext, deploymentId?: string) {
    const where: Record<string, unknown> = { tenant_uid: context.tenantUid };
    if (deploymentId) {
      await this.assertScope(context, deploymentId, 'robots:read');
      where.deployment_id = deploymentId;
    }
    return this.sessions.findAll({
      where, order: [['started_at', 'DESC'], ['id', 'DESC']], limit: 50,
    });
  }

  async sessionTimeline(context: TenantContext, sessionId: string) {
    const session = await this.sessions.findOne({ where: { tenant_uid: context.tenantUid, id: sessionId } });
    if (!session) throw new NotFoundException({ code: 'resource_not_found' });
    await this.assertScope(context, session.deployment_id, 'robots:read');
    const [turns, events, operations] = await Promise.all([
      this.turns.findAll({ where: { session_id: sessionId }, order: [['input_turn_id', 'ASC'], ['output_epoch', 'ASC']] }),
      this.events.findAll({ where: { session_id: sessionId }, order: [['sequence', 'ASC']] }),
      this.operations.findAll({ where: { session_id: sessionId } }),
    ]);
    return { session, turns, events, operations };
  }

  executeTool(input: {
    action: string; operationKey: string; targetId?: string; allowlist: string[]; preview: boolean;
    seen: Map<string, { action: string; state: 'requested' | 'confirmed' | 'failed' }>;
  }) {
    return executeVoiceTool(input);
  }

  async drainTenant(context: TenantContext) {
    const rows = await this.deployments.findAll({
      where: { tenant_uid: context.tenantUid, status: 'ready' },
    });
    for (const row of rows) {
      row.status = 'draining';
      row.revision += 1;
      row.updated_at = new Date();
      await row.save();
    }
    return {
      admissionsStopped: true as const,
      liveSip: false as const,
      drained: rows.map((row) => row.id),
    };
  }

  capabilities() {
    return {
      mode: 'cascade',
      realtime: false,
      externalSip: false,
      toolsCatalog: true,
      knowledge: true,
      ariApp: process.env.ARI_AI_VOICE_APP_NAME || 'krasterisk_ai_voice',
      tools: ['end_call', 'transfer', 'get_session_context'],
      previewMic: 'opt-in',
    };
  }

  private snapshot(agent: CcAiAgent): AgentSnapshot {
    return {
      uid: agent.uid, tenantUid: agent.user_uid, name: agent.name, uniqueId: agent.unique_id,
      mode: agent.mode as 'realtime' | 'cascade', greeting: agent.greeting || '',
      instruction: agent.instruction || '', modelProfileId: agent.model_profile_id,
      sttProfileId: agent.stt_profile_id, ttsProfileId: agent.tts_profile_id, enabled: agent.enabled,
    };
  }

  private async policyOf(agentUid: number, tenantUid: number): Promise<RuntimePolicy> {
    const draft = await this.drafts.findOne({ where: { agent_uid: agentUid, tenant_uid: tenantUid } });
    return draft ? JSON.parse(draft.runtime_policy) as RuntimePolicy : { ...DEFAULT_RUNTIME_POLICY };
  }

  private async ensureDraft(tenantUid: number, agentUid: number, transaction?: unknown) {
    const existing = await this.drafts.findOne({
      where: { tenant_uid: tenantUid, agent_uid: agentUid }, transaction: transaction as never,
    });
    if (existing) return existing;
    return this.drafts.create({
      tenant_uid: tenantUid, agent_uid: agentUid, robot_uuid: randomUUID(), draft_revision: 1,
      runtime_policy: JSON.stringify(DEFAULT_RUNTIME_POLICY), created_at: new Date(), updated_at: new Date(),
    }, { transaction: transaction as never });
  }
}

export function assertUuid(value: string): void {
  if (!UUID.test(value)) throw new NotFoundException({ code: 'resource_not_found' });
}
