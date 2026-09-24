import { Injectable, NotFoundException, BadRequestException, ForbiddenException } from '@nestjs/common';
import { InjectModel } from '@nestjs/sequelize';
import { CcAiProvider } from './ai-provider.model';
import { CreateAiProviderDto, UpdateAiProviderDto } from './ai-provider.dto';
import { decryptSecret, encryptSecret } from './secret-cipher.util';
import { resolveChatCompletionsUrl } from './chat-endpoint.util';
import { mergeCatalogDefaults, toSpeechEngine, type SpeechCapability, type SpeechEngineConfig } from './speech-engine';
import { sealCustomAuth } from './provider-auth';

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
    if (!row.encrypted_api_key) {
      if (row.auth_type === 'custom') return '';
      throw new ForbiddenException({ code: 'provider_secret_missing' });
    }
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
    let row = await this.model.findOne({
      where: { uid: providerUid, user_uid: tenantUid, enabled: true, is_global: false },
    });
    if (!row && (capability === 'tts' || capability === 'stt')) {
      row = await this.model.findOne({
        where: { uid: providerUid, enabled: true, is_global: true },
      });
    }
    if (!row || row.uid !== providerUid || row.enabled !== true
      || (!row.is_global && row.user_uid !== tenantUid)
      || !Array.isArray(row.capabilities) || !row.capabilities.includes(capability)) {
      throw new NotFoundException({ code: 'provider_not_found' });
    }
    return row;
  }

  async findAll(userUid: number, capability?: string) {
    this.assertCapability(capability);
    const rows = await this.model.findAll({
      where: { user_uid: userUid, is_global: false },
      order: [['name', 'ASC']],
    });
    return this.withCapability(rows, capability);
  }

  async findGlobal(capability?: string) {
    this.assertCapability(capability);
    const rows = await this.model.findAll({
      where: { is_global: true },
      order: [['name', 'ASC']],
    });
    return this.withCapability(rows, capability);
  }

  /**
   * Tenant provider, or a global speech provider when the cabinet already
   * references a catalog uid. Global rows stay out of findAll.
   */
  async loadSpeechEngine(
    tenantUid: number,
    providerUid: number,
    capability: SpeechCapability,
  ): Promise<SpeechEngineConfig> {
    await this.revisionForOperation(tenantUid, providerUid, capability);
    const row = await this.usableProvider(tenantUid, providerUid, capability);
    // Yandex/Google keep the API key in `token` even when auth_mode is none.
    const token = row.encrypted_api_key ? decryptSecret(row.encrypted_api_key) : '';
    return toSpeechEngine(row, token);
  }

  private assertCapability(capability?: string): void {
    if (capability && !PROVIDER_CAPABILITIES.has(capability)) {
      throw new BadRequestException({ code: 'capability_invalid' });
    }
  }

  private withCapability<T extends { capabilities?: string[] }>(rows: T[], capability?: string): T[] {
    if (!capability) return rows;
    return rows.filter((row) => Array.isArray(row.capabilities) && row.capabilities.includes(capability));
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
    const auth = this.sealAuth(null, dto);
    return this.model.create({
      name: dto.name,
      kind: dto.kind,
      vendor: dto.vendor,
      endpoint: dto.endpoint,
      auth_type: dto.auth_type || 'bearer',
      encrypted_api_key: auth.encrypted_api_key ?? '',
      capabilities: dto.capabilities,
      defaults: auth.defaults,
      enabled: dto.enabled !== false,
      is_global: isGlobal,
      user_uid: userUid,
    });
  }

  async update(id: number, dto: UpdateAiProviderDto, userUid: number) {
    const row = await this.model.findOne({ where: { uid: id, user_uid: userUid, is_global: false } });
    if (!row) throw new NotFoundException('Provider not found');

    await row.update(this.patchFromDto(row, dto));
    return row;
  }

  async updateGlobal(id: number, dto: UpdateAiProviderDto) {
    const row = await this.model.findOne({ where: { uid: id, is_global: true } });
    if (!row) throw new NotFoundException('Provider not found');
    await row.update(this.patchFromDto(row, dto));
    return row;
  }

  private patchFromDto(row: CcAiProvider, dto: UpdateAiProviderDto) {
    const patch: any = { ...dto };
    delete patch.apiKey;
    delete patch.authHeaders;
    delete patch.is_global;
    const auth = this.sealAuth(row, dto);
    patch.encrypted_api_key = auth.encrypted_api_key;
    patch.defaults = auth.defaults;
    if (patch.encrypted_api_key === undefined) delete patch.encrypted_api_key;
    return patch;
  }

  private sealAuth(
    row: CcAiProvider | null,
    dto: { auth_type?: string; apiKey?: string; authHeaders?: Array<{ key: string; value: string }>; defaults?: Record<string, any> },
  ): { encrypted_api_key: string | undefined; defaults: Record<string, unknown> } {
    const auth = dto.auth_type || row?.auth_type || 'bearer';
    const defaults = mergeCatalogDefaults(row?.defaults, dto.defaults ?? row?.defaults ?? {});
    if (auth === 'none') {
      delete defaults.authHeaderKeys;
      return { encrypted_api_key: '', defaults };
    }
    if (auth === 'custom') {
      if (!dto.authHeaders) return { encrypted_api_key: undefined, defaults };
      const previous = row?.encrypted_api_key ? decryptSecret(row.encrypted_api_key) : '';
      const sealed = sealCustomAuth(row?.auth_type, previous, dto.authHeaders);
      defaults.authHeaderKeys = sealed.keys;
      return {
        encrypted_api_key: sealed.keys.length ? encryptSecret(sealed.plain) : '',
        defaults,
      };
    }
    delete defaults.authHeaderKeys;
    if (row?.auth_type === 'custom' && !(typeof dto.apiKey === 'string' && dto.apiKey.length > 0)) {
      return { encrypted_api_key: '', defaults };
    }
    if (typeof dto.apiKey === 'string' && dto.apiKey.length > 0) {
      return { encrypted_api_key: encryptSecret(dto.apiKey), defaults };
    }
    if (dto.apiKey === '') return { encrypted_api_key: '', defaults };
    return { encrypted_api_key: undefined, defaults };
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
