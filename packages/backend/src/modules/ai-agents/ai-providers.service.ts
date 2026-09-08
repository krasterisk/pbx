import { Injectable, NotFoundException, BadRequestException, Logger } from '@nestjs/common';
import { InjectModel } from '@nestjs/sequelize';
import { CcAiProvider } from './models/ai-provider.model';
import { CreateAiProviderDto, UpdateAiProviderDto } from './dto/ai-provider.dto';
import { encryptSecret } from './util/secret-cipher.util';
import { resolveChatCompletionsUrl } from '../voicemail/llm-summary.service';

const DEFAULT_LLM_CACHE_MS = 60_000;

/**
 * Tenant-owned LLM (and voice) provider connections.
 * Global templates are not used — each tenant creates their own rows.
 */
@Injectable()
export class AiProvidersService {
  private readonly logger = new Logger(AiProvidersService.name);
  private readonly defaultLlmByTenant = new Map<number, { at: number; row: CcAiProvider | null }>();

  constructor(
    @InjectModel(CcAiProvider) private readonly model: typeof CcAiProvider,
  ) {}

  /**
   * Chat-completions provider for this tenant.
   * Preferred uid wins when it belongs to the tenant and is a usable LLM.
   */
  async findDefaultLlm(tenantUid: number, preferredUid?: number | null): Promise<CcAiProvider | null> {
    const selected = Number(preferredUid);
    if (Number.isFinite(selected) && selected > 0) {
      const chosen = await this.model.findOne({
        where: { uid: selected, user_uid: tenantUid, enabled: true },
      });
      if (chosen && this.isChatLlm(chosen)) {
        return chosen;
      }
    }

    const cached = this.defaultLlmByTenant.get(tenantUid);
    const now = Date.now();
    if (cached && now - cached.at < DEFAULT_LLM_CACHE_MS) {
      return cached.row;
    }

    const candidates = await this.model.findAll({
      where: { user_uid: tenantUid, enabled: true },
      order: [['uid', 'ASC']],
    });
    const row = candidates.find((candidate) => this.isChatLlm(candidate)) ?? null;
    this.defaultLlmByTenant.set(tenantUid, { at: now, row });
    return row;
  }

  private hasLlm(row: { capabilities?: string[] }): boolean {
    return Array.isArray(row.capabilities) && row.capabilities.includes('llm');
  }

  private isChatLlm(row: { capabilities?: string[]; endpoint?: string }): boolean {
    return this.hasLlm(row) && !!resolveChatCompletionsUrl(row.endpoint ?? '');
  }

  private invalidateDefaultLlmCache(): void {
    this.defaultLlmByTenant.clear();
  }

  async findAll(userUid: number) {
    return this.model.findAll({
      where: { user_uid: userUid },
      order: [['name', 'ASC']],
    });
  }

  async findOne(id: number, userUid: number) {
    const row = await this.model.findOne({
      where: { uid: id, user_uid: userUid },
    });
    if (!row) throw new NotFoundException('Provider not found');
    return row;
  }

  async create(dto: CreateAiProviderDto, userUid: number) {
    if (!dto.capabilities || dto.capabilities.length === 0) {
      throw new BadRequestException('At least one capability is required');
    }
    if (!dto.pricing) {
      throw new BadRequestException('Pricing config is required');
    }
    const encrypted_api_key = dto.apiKey ? encryptSecret(dto.apiKey) : '';
    this.invalidateDefaultLlmCache();
    return this.model.create({
      name: dto.name,
      kind: dto.kind,
      vendor: dto.vendor,
      endpoint: dto.endpoint,
      auth_type: dto.auth_type || 'bearer',
      encrypted_api_key,
      capabilities: dto.capabilities,
      defaults: dto.defaults || {},
      pricing: dto.pricing,
      enabled: dto.enabled !== false,
      user_uid: userUid,
    });
  }

  async update(id: number, dto: UpdateAiProviderDto, userUid: number) {
    const row = await this.model.findOne({ where: { uid: id, user_uid: userUid } });
    if (!row) throw new NotFoundException('Provider not found');

    const patch: any = { ...dto };
    delete patch.apiKey;
    if (typeof dto.apiKey === 'string' && dto.apiKey.length > 0) {
      patch.encrypted_api_key = encryptSecret(dto.apiKey);
    } else if (dto.apiKey === '') {
      patch.encrypted_api_key = '';
    }

    await row.update(patch);
    this.invalidateDefaultLlmCache();
    return row;
  }

  async remove(id: number, userUid: number) {
    const row = await this.model.findOne({ where: { uid: id, user_uid: userUid } });
    if (!row) throw new NotFoundException('Provider not found');
    await row.destroy();
    this.invalidateDefaultLlmCache();
    return { success: true };
  }
}
