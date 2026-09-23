import { Injectable, NotFoundException, BadRequestException, ForbiddenException } from '@nestjs/common';
import { InjectModel } from '@nestjs/sequelize';
import { CcAiProvider } from './ai-provider.model';
import { CreateAiProviderDto, UpdateAiProviderDto } from './ai-provider.dto';
import { decryptSecret, encryptSecret } from './secret-cipher.util';
import { resolveChatCompletionsUrl } from './chat-endpoint.util';

const PROVIDER_CAPABILITIES = new Set(['llm', 'stt', 'tts', 'realtime', 'tools', 'function_calling']);

export interface ProviderCredentialReference {
  tenantUid: number;
  providerUid: number;
  capability: string;
}

export interface ProviderRevision {
  providerUid: number;
  tenantUid: number;
  capability: string;
  config: Readonly<{ kind: string; vendor: string; endpoint: string;
    authType: string; capabilities: readonly string[] }>;
  credentialRef: Readonly<ProviderCredentialReference>;
}

/**
 * Provider connections in `cc_ai_providers`.
 * Tenant rows (`is_global = false`) belong to one cabinet.
 * Global rows are the superadmin catalog and stay out of tenant lists.
 */
export const GLOBAL_PROVIDER_OWNER_UID = 0;
@Injectable()
export class AiProvidersService {

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
        where: { uid: selected, user_uid: tenantUid, enabled: true, is_global: false },
      });
      if (chosen && chosen.user_uid === tenantUid && chosen.enabled && this.isChatLlm(chosen)) {
        return chosen;
      }
    }

    const candidates = await this.model.findAll({
      where: { user_uid: tenantUid, enabled: true, is_global: false },
      order: [['uid', 'ASC']],
    });
    return candidates.find((candidate) => candidate.user_uid === tenantUid
      && candidate.enabled && this.isChatLlm(candidate)) ?? null;
  }

  private hasLlm(row: { capabilities?: string[] }): boolean {
    return Array.isArray(row.capabilities) && row.capabilities.includes('llm');
  }

  private isChatLlm(row: { capabilities?: string[]; endpoint?: string }): boolean {
    return this.hasLlm(row) && !!resolveChatCompletionsUrl(row.endpoint ?? '');
  }

  /** Capture nonsecret admission facts; jobs retain a server-side credential reference. */
  async revisionForOperation(
    tenantUid: number, providerUid: number, capability: string,
  ): Promise<ProviderRevision> {
    const row = await this.usableProvider(tenantUid, providerUid, capability);
    const credentialRef = Object.freeze({ tenantUid, providerUid, capability });
    return Object.freeze({ providerUid, tenantUid, capability,
      config: Object.freeze({ kind: row.kind, vendor: row.vendor, endpoint: row.endpoint,
        authType: row.auth_type, capabilities: Object.freeze([...row.capabilities]) }),
      credentialRef });
  }

  /** Recheck tenant, enabled state and capability immediately before provider I/O. */
  async resolveCredential(reference: ProviderCredentialReference): Promise<string> {
    const row = await this.usableProvider(reference.tenantUid,
      reference.providerUid, reference.capability);
    if (row.auth_type === 'none') return '';
    if (!row.encrypted_api_key) throw new ForbiddenException({ code: 'provider_secret_missing' });
    return decryptSecret(row.encrypted_api_key);
  }

  private async usableProvider(
    tenantUid: number, providerUid: number, capability: string,
  ): Promise<CcAiProvider> {
    if (!Number.isSafeInteger(tenantUid) || tenantUid < 0
      || !Number.isSafeInteger(providerUid) || providerUid <= 0
      || !PROVIDER_CAPABILITIES.has(capability)) {
      throw new NotFoundException({ code: 'provider_not_found' });
    }
    const row = await this.model.findOne({
      where: { uid: providerUid, user_uid: tenantUid, enabled: true, is_global: false },
    });
    if (!row || row.uid !== providerUid || row.user_uid !== tenantUid || row.enabled !== true
      || !Array.isArray(row.capabilities) || !row.capabilities.includes(capability)) {
      throw new NotFoundException({ code: 'provider_not_found' });
    }
    return row;
  }

  async findAll(userUid: number) {
    return this.model.findAll({
      where: { user_uid: userUid, is_global: false },
      order: [['name', 'ASC']],
    });
  }

  async findGlobal() {
    return this.model.findAll({
      where: { is_global: true },
      order: [['name', 'ASC']],
    });
  }

  async findOne(id: number, userUid: number) {
    const row = await this.model.findOne({
      where: { uid: id, user_uid: userUid, is_global: false },
    });
    if (!row) throw new NotFoundException('Provider not found');
    return row;
  }

  async create(dto: CreateAiProviderDto, userUid: number) {
    return this.insert(dto, userUid, false);
  }

  async createGlobal(dto: CreateAiProviderDto) {
    return this.insert(dto, GLOBAL_PROVIDER_OWNER_UID, true);
  }

  private async insert(dto: CreateAiProviderDto, userUid: number, isGlobal: boolean) {
    if (!dto.capabilities || dto.capabilities.length === 0) {
      throw new BadRequestException('At least one capability is required');
    }
    if (!dto.pricing) {
      throw new BadRequestException('Pricing config is required');
    }
    const encrypted_api_key = dto.apiKey ? encryptSecret(dto.apiKey) : '';
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
      is_global: isGlobal,
      user_uid: userUid,
    });
  }

  async update(id: number, dto: UpdateAiProviderDto, userUid: number) {
    const row = await this.model.findOne({ where: { uid: id, user_uid: userUid, is_global: false } });
    if (!row) throw new NotFoundException('Provider not found');

    const patch: any = { ...dto };
    delete patch.apiKey;
    delete patch.is_global;
    if (typeof dto.apiKey === 'string' && dto.apiKey.length > 0) {
      patch.encrypted_api_key = encryptSecret(dto.apiKey);
    } else if (dto.apiKey === '') {
      patch.encrypted_api_key = '';
    }

    await row.update(patch);
    return row;
  }

  async updateGlobal(id: number, dto: UpdateAiProviderDto) {
    const row = await this.model.findOne({ where: { uid: id, is_global: true } });
    if (!row) throw new NotFoundException('Provider not found');
    const patch: any = { ...dto };
    delete patch.apiKey;
    delete patch.is_global;
    if (typeof dto.apiKey === 'string' && dto.apiKey.length > 0) {
      patch.encrypted_api_key = encryptSecret(dto.apiKey);
    } else if (dto.apiKey === '') {
      patch.encrypted_api_key = '';
    }
    await row.update(patch);
    return row;
  }

  async remove(id: number, userUid: number) {
    const row = await this.model.findOne({ where: { uid: id, user_uid: userUid, is_global: false } });
    if (!row) throw new NotFoundException('Provider not found');
    await row.destroy();
    return { success: true };
  }

  async removeGlobal(id: number) {
    const row = await this.model.findOne({ where: { uid: id, is_global: true } });
    if (!row) throw new NotFoundException('Provider not found');
    await row.destroy();
    return { success: true };
  }
}
