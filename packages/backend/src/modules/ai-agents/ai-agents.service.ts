import { Injectable, NotFoundException, BadRequestException, Logger } from '@nestjs/common';
import { InjectModel } from '@nestjs/sequelize';
import { Op } from 'sequelize';
import { CcAiAgent } from './models/ai-agent.model';
import { CcAiProvider } from './models/ai-provider.model';
import { CcAiToolset } from './models/ai-toolset.model';
import { CreateAiAgentDto, UpdateAiAgentDto } from './dto/ai-agent.dto';

/**
 * AI Agents CRUD. Validates provider/toolset references against the
 * tenant's own rows + global templates (`user_uid = 0`), enforces unique
 * `unique_id` per tenant, and rejects cascade-mode agents that miss
 * STT/TTS profiles.
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
    await this.validateLinkedEntities(dto, userUid);
    await this.assertUniqueId(dto.unique_id, userUid, null);
    this.assertModeConsistency(dto);

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
    await this.validateLinkedEntities(dto, userUid);
    if (dto.unique_id && dto.unique_id !== row.unique_id) {
      await this.assertUniqueId(dto.unique_id, userUid, id);
    }
    const merged = { ...row.get(), ...dto } as any;
    this.assertModeConsistency(merged);
    await row.update(dto);
    return row;
  }

  async remove(id: number, userUid: number) {
    const row = await this.findOne(id, userUid);
    await row.destroy();
    return { success: true };
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

  private assertModeConsistency(a: {
    mode?: 'realtime' | 'cascade';
    model_profile_id?: number | null;
    stt_profile_id?: number | null;
    tts_profile_id?: number | null;
  }) {
    if (a.mode === 'cascade') {
      if (!a.stt_profile_id) throw new BadRequestException('cascade mode requires STT profile');
      if (!a.tts_profile_id) throw new BadRequestException('cascade mode requires TTS profile');
    }
    if (!a.model_profile_id) {
      throw new BadRequestException('LLM/model profile is required');
    }
  }

  private async validateLinkedEntities(
    dto: { model_profile_id?: number; stt_profile_id?: number; tts_profile_id?: number; toolset_id?: number },
    userUid: number,
  ) {
    const providerIds = [dto.model_profile_id, dto.stt_profile_id, dto.tts_profile_id].filter(
      (v): v is number => typeof v === 'number' && v > 0,
    );
    if (providerIds.length > 0) {
      const found = await this.providerModel.findAll({
        where: { uid: { [Op.in]: providerIds }, user_uid: { [Op.in]: [0, userUid] } },
      });
      if (found.length !== new Set(providerIds).size) {
        throw new BadRequestException('Linked provider not accessible for this tenant');
      }
    }
    if (dto.toolset_id) {
      const ts = await this.toolsetModel.findOne({
        where: { uid: dto.toolset_id, user_uid: userUid },
      });
      if (!ts) throw new BadRequestException('Linked toolset not accessible for this tenant');
    }
  }
}
