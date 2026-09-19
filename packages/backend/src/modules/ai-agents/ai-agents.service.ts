import { Injectable, NotFoundException, BadRequestException, Logger } from '@nestjs/common';
import { InjectModel } from '@nestjs/sequelize';
import { Op } from 'sequelize';
import { CcAiAgent } from './models/ai-agent.model';
import { CcAiProvider } from './models/ai-provider.model';
import { CcAiToolset } from './models/ai-toolset.model';
import { CreateAiAgentDto, UpdateAiAgentDto } from './dto/ai-agent.dto';
import {
  assessAgentReadiness, type AgentConfigurationReadiness,
  type AgentProviderLinks, type SafeProvider,
} from './ai-agent-readiness';

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
  ) {}

  findAll(userUid: number) {
    return this.agentModel.findAll({
      where: { user_uid: userUid },
      order: [['name', 'ASC']],
    });
  }

  async findOne(id: number, userUid: number) {
    const row = await this.agentModel.findOne({ where: { uid: id, user_uid: userUid } });
    if (!row) throw new NotFoundException('AI agent not found');
    return row;
  }

  async create(dto: CreateAiAgentDto, userUid: number) {
    await this.assertUniqueId(dto.unique_id, userUid, null);
    await this.assertReady(dto, userUid);

    return this.agentModel.create({
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
  }

  async update(id: number, dto: UpdateAiAgentDto, userUid: number) {
    const row = await this.findOne(id, userUid);
    if (dto.unique_id && dto.unique_id !== row.unique_id) {
      await this.assertUniqueId(dto.unique_id, userUid, id);
    }
    const merged = { ...row.get(), ...dto } as AgentProviderLinks;
    // An invalid historical draft can always be switched OFF or repaired while
    // disabled. Re-enabling checks every resultant link again.
    if (merged.enabled !== false) await this.assertReady(merged, userUid);
    await row.update(dto);
    return row;
  }

  async remove(id: number, userUid: number) {
    const row = await this.findOne(id, userUid);
    await row.destroy();
    return { success: true };
  }

  async checkReadiness(id: number, userUid: number): Promise<AgentConfigurationReadiness> {
    const row = await this.findOne(id, userUid);
    return this.assessConfiguration(row.get() as AgentProviderLinks, userUid);
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
