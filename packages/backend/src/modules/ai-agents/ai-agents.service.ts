import { Injectable, NotFoundException, BadRequestException, HttpException, Logger, ConflictException } from '@nestjs/common';
import { InjectModel } from '@nestjs/sequelize';
import { Op } from 'sequelize';
import { randomUUID } from 'node:crypto';
import { CcAiAgent } from './models/ai-agent.model';
import { CcAiProvider } from './models/ai-provider.model';
import { CcAiToolset } from './models/ai-toolset.model';
import { CreateAiAgentDto, UpdateAiAgentDto } from './dto/ai-agent.dto';
import {
  assessAgentReadiness, type AgentConfigurationReadiness,
  type AgentProviderLinks, type SafeProvider,
} from './ai-agent-readiness';
import { AiRobotDraft } from '../ai-voice/ai-voice.models';
import { DEFAULT_RUNTIME_POLICY } from '../ai-voice/voice-engine';

export function parseExpectedRevision(raw?: string | number | null): number | undefined {
  if (raw == null || raw === '') return undefined;
  const value = Number(String(raw).replace(/^W\//, '').replaceAll('"', '').trim());
  return Number.isInteger(value) ? value : undefined;
}

/**
 * AI Agents CRUD. Validates provider/toolset references against the
 * tenant's own rows, enforces unique `unique_id` per tenant, and validates
 * the resultant mode/provider roles before each write.
 */
@Injectable()
export class AiAgentsService {
  private readonly logger = new Logger(AiAgentsService.name);

  constructor(
    @InjectModel(CcAiAgent) private readonly agentModel: typeof CcAiAgent,
    @InjectModel(CcAiProvider) private readonly providerModel: typeof CcAiProvider,
    @InjectModel(CcAiToolset) private readonly toolsetModel: typeof CcAiToolset,
    @InjectModel(AiRobotDraft) private readonly drafts: typeof AiRobotDraft,
  ) {}

  async findAll(userUid: number) {
    const rows = await this.agentModel.findAll({
      where: { user_uid: userUid },
      order: [['name', 'ASC']],
    });
    return Promise.all(rows.map(row => this.withDraft(row)));
  }

  async findOne(id: number, userUid: number) {
    const row = await this.agentModel.findOne({ where: { uid: id, user_uid: userUid } });
    if (!row) throw new NotFoundException('AI agent not found');
    return this.withDraft(row);
  }

  async create(dto: CreateAiAgentDto, userUid: number) {
    await this.assertUniqueId(dto.unique_id, userUid, null);
    await this.assertReady(dto, userUid);

    const row = await this.agentModel.create({
      name: dto.name,
      unique_id: dto.unique_id,
      mode: dto.mode,
      voice: dto.voice || '',
      greeting: dto.greeting || '',
      instruction: dto.instruction || '',
      model_profile_id: dto.model_profile_id || null,
      stt_profile_id: dto.stt_profile_id || null,
      tts_profile_id: dto.tts_profile_id || null,
      vad_config: dto.vad_config || {},
      toolset_id: dto.toolset_id || null,
      channel_kind: dto.channel_kind || 'local',
      enabled: dto.enabled !== false,
      user_uid: userUid,
    });
    await this.ensureDraft(userUid, row.uid);
    return this.withDraft(row);
  }

  async update(id: number, dto: UpdateAiAgentDto, userUid: number, expectedRevision?: number) {
    const row = await this.requireRow(id, userUid);
    await this.assertDraftRevision(userUid, id, expectedRevision);
    if (dto.unique_id && dto.unique_id !== row.unique_id) {
      await this.assertUniqueId(dto.unique_id, userUid, id);
    }
    const merged = { ...row.get(), ...dto } as AgentProviderLinks;
    if (merged.enabled !== false) await this.assertReady(merged, userUid);
    await row.update(dto);
    await this.bumpDraft(userUid, id);
    return this.withDraft(row);
  }

  async remove(id: number, userUid: number, expectedRevision?: number) {
    const row = await this.requireRow(id, userUid);
    await this.assertDraftRevision(userUid, id, expectedRevision);
    await row.destroy();
    return { success: true };
  }

  async checkReadiness(id: number, userUid: number): Promise<AgentConfigurationReadiness> {
    const row = await this.requireRow(id, userUid);
    return this.assessConfiguration(row.get() as AgentProviderLinks, userUid);
  }

  private async requireRow(id: number, userUid: number): Promise<CcAiAgent> {
    const row = await this.agentModel.findOne({ where: { uid: id, user_uid: userUid } });
    if (!row) throw new NotFoundException('AI agent not found');
    return row;
  }

  private async withDraft(row: CcAiAgent) {
    const draft = await this.ensureDraft(row.user_uid, row.uid);
    return {
      ...row.get(),
      draft_revision: draft.draft_revision,
      robot_uuid: draft.robot_uuid,
    };
  }

  private async ensureDraft(userUid: number, agentUid: number): Promise<AiRobotDraft> {
    const existing = await this.drafts.findOne({ where: { tenant_uid: userUid, agent_uid: agentUid } });
    if (existing) return existing;
    return this.drafts.create({
      tenant_uid: userUid, agent_uid: agentUid, robot_uuid: randomUUID(), draft_revision: 1,
      runtime_policy: JSON.stringify(DEFAULT_RUNTIME_POLICY), created_at: new Date(), updated_at: new Date(),
    });
  }

  private async assertDraftRevision(userUid: number, agentUid: number, expected?: number): Promise<AiRobotDraft> {
    const draft = await this.ensureDraft(userUid, agentUid);
    if (expected == null || !Number.isInteger(expected)) {
      throw new HttpException({ code: 'revision_required' }, 428);
    }
    if (draft.draft_revision !== expected) throw new ConflictException({ code: 'stale_draft' });
    return draft;
  }

  private async bumpDraft(userUid: number, agentUid: number): Promise<void> {
    const draft = await this.ensureDraft(userUid, agentUid);
    draft.draft_revision += 1;
    draft.updated_at = new Date();
    await draft.save();
  }

  // ─── Validation helpers ─────────────────────────────────

  private async assertUniqueId(unique_id: string, userUid: number, excludeId: number | null) {
    if (!/^[A-Za-z0-9_\-]+$/.test(unique_id)) {
      throw new BadRequestException('unique_id may only contain [A-Za-z0-9_-]');
    }
    const where: any = { unique_id, user_uid: userUid };
    if (excludeId) where.uid = { [Op.ne]: excludeId };
    const dup = await this.agentModel.findOne({ where });
    if (dup) throw new BadRequestException(`unique_id "${unique_id}" is already used`);
  }

  private async assertReady(agent: AgentProviderLinks, userUid: number): Promise<void> {
    const readiness = await this.assessConfiguration(agent, userUid);
    if (!readiness.ready) {
      throw new BadRequestException({ code: 'agent_configuration_not_ready', issues: readiness.issues });
    }
  }

  private async assessConfiguration(
    agent: AgentProviderLinks, userUid: number,
  ): Promise<AgentConfigurationReadiness> {
    const roles = agent.mode === 'cascade'
      ? [agent.model_profile_id, agent.stt_profile_id, agent.tts_profile_id]
      : [agent.model_profile_id];
    const ids = [...new Set(roles.filter((uid): uid is number =>
      Number.isSafeInteger(uid) && Number(uid) > 0))];
    const [providers, toolset] = await Promise.all([
      ids.length ? this.providerModel.findAll({
        where: { uid: { [Op.in]: ids }, user_uid: userUid },
        attributes: ['uid', 'user_uid', 'enabled', 'capabilities'],
      }) : Promise.resolve([]),
      agent.toolset_id ? this.toolsetModel.findOne({
        where: { uid: agent.toolset_id, user_uid: userUid }, attributes: ['uid'],
      }) : Promise.resolve(null),
    ]);
    return assessAgentReadiness(
      agent, userUid,
      new Map<number, SafeProvider>(providers.map((provider) => [provider.uid, provider])),
      new Set(toolset ? [toolset.uid] : []),
    );
  }
}
