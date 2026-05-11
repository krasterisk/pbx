import { Injectable, NotFoundException, BadRequestException, Logger } from '@nestjs/common';
import { InjectModel } from '@nestjs/sequelize';
import { Op } from 'sequelize';
import { CcAiProvider } from './models/ai-provider.model';
import { CreateAiProviderDto, UpdateAiProviderDto } from './dto/ai-provider.dto';
import { encryptSecret } from './util/secret-cipher.util';

/**
 * Provider Registry — CRUD over `cc_ai_providers`.
 *
 * Multi-tenancy:
 * - `userUid = 0` rows are global templates (admin-installed via seed).
 * - Per-tenant CRUD always uses the tenant's own `userUid`; globals
 *   are read-only and exposed via `findAll` so the UI can clone them.
 */
@Injectable()
export class AiProvidersService {
  private readonly logger = new Logger(AiProvidersService.name);

  constructor(
    @InjectModel(CcAiProvider) private readonly model: typeof CcAiProvider,
  ) {}

  /** List providers visible to the tenant: own rows + global templates. */
  async findAll(userUid: number) {
    return this.model.findAll({
      where: { user_uid: { [Op.in]: [0, userUid] } },
      order: [['user_uid', 'ASC'], ['name', 'ASC']],
    });
  }

  async findOne(id: number, userUid: number) {
    const row = await this.model.findOne({
      where: { uid: id, user_uid: { [Op.in]: [0, userUid] } },
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
    // Globals are read-only for tenants
    const row = await this.model.findOne({ where: { uid: id, user_uid: userUid } });
    if (!row) throw new NotFoundException('Provider not found (or read-only global template)');

    const patch: any = { ...dto };
    delete patch.apiKey;
    if (typeof dto.apiKey === 'string' && dto.apiKey.length > 0) {
      patch.encrypted_api_key = encryptSecret(dto.apiKey);
    } else if (dto.apiKey === '') {
      patch.encrypted_api_key = '';
    }

    await row.update(patch);
    return row;
  }

  async remove(id: number, userUid: number) {
    const row = await this.model.findOne({ where: { uid: id, user_uid: userUid } });
    if (!row) throw new NotFoundException('Provider not found (or read-only global template)');
    await row.destroy();
    return { success: true };
  }

  /** Clone a global template into the tenant's own list (keeps endpoint/pricing). */
  async cloneTemplate(id: number, userUid: number) {
    const tpl = await this.model.findOne({ where: { uid: id, user_uid: 0 } });
    if (!tpl) throw new NotFoundException('Template not found');
    const clone = await this.model.create({
      name: `${tpl.name} (copy)`,
      kind: tpl.kind,
      vendor: tpl.vendor,
      endpoint: tpl.endpoint,
      auth_type: tpl.auth_type,
      encrypted_api_key: '',
      capabilities: tpl.capabilities,
      defaults: tpl.defaults,
      pricing: tpl.pricing,
      enabled: false, // start disabled — user needs to provide their key
      user_uid: userUid,
    });
    return clone;
  }
}
