import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/sequelize';
import { Op } from 'sequelize';
import type { AutodialDncScope, IAutodialDncEntry } from '@krasterisk/shared';
import { AcDnc } from './models/ac-dnc.model';
import { normalizeAutodialPhone } from './autodial-phone.util';
import type { CreateAutodialDncDto } from './dto/autodial-campaign.dto';

export interface AutodialDncCheckScope {
  campaignUid?: number;
  baseUid?: number;
}

@Injectable()
export class AutodialDncService {
  constructor(@InjectModel(AcDnc) private readonly dncModel: typeof AcDnc) {}

  async findAll(userUid: number): Promise<IAutodialDncEntry[]> {
    const rows = await this.dncModel.findAll({
      where: { user_uid: userUid },
      order: [['uid', 'DESC']],
    });
    return rows.map((r) => this.toDto(r));
  }

  async create(userUid: number, dto: CreateAutodialDncDto): Promise<IAutodialDncEntry> {
    this.assertScope(dto.scope, dto.scope_uid);
    const normalized = normalizeAutodialPhone(dto.normalized_phone, 'digits');
    if (!normalized) {
      throw new BadRequestException({ code: 'AC_DNC_INVALID_PHONE', message: 'Invalid phone' });
    }
    const row = await this.dncModel.create({
      user_uid: userUid,
      scope: dto.scope,
      scope_uid: dto.scope_uid ?? null,
      normalized_phone: normalized,
      reason: dto.reason?.trim() ?? '',
      source: dto.source?.trim() ?? 'manual',
      expires_at: dto.expires_at ? new Date(dto.expires_at) : null,
    });
    return this.toDto(row);
  }

  async remove(userUid: number, uid: number): Promise<void> {
    const deleted = await this.dncModel.destroy({ where: { uid, user_uid: userUid } });
    if (!deleted) {
      throw new NotFoundException({ code: 'AC_DNC_NOT_FOUND', message: 'DNC entry not found' });
    }
  }

  async isBlocked(
    userUid: number,
    phone: string,
    scope: AutodialDncCheckScope = {},
  ): Promise<boolean> {
    const normalized = normalizeAutodialPhone(phone, 'digits');
    if (!normalized) return false;
    const now = new Date();
    const orScopes: Array<Record<string, unknown>> = [{ scope: 'global', scope_uid: null }];
    if (scope.campaignUid != null) {
      orScopes.push({ scope: 'campaign', scope_uid: scope.campaignUid });
    }
    if (scope.baseUid != null) {
      orScopes.push({ scope: 'base', scope_uid: scope.baseUid });
    }
    const hit = await this.dncModel.findOne({
      where: {
        user_uid: userUid,
        normalized_phone: normalized,
        [Op.and]: [
          { [Op.or]: orScopes },
          { [Op.or]: [{ expires_at: null }, { expires_at: { [Op.gt]: now } }] },
        ],
      },
    });
    return !!hit;
  }

  private assertScope(scope: AutodialDncScope, scopeUid?: number | null): void {
    if (scope === 'global' && scopeUid != null) {
      throw new BadRequestException({ code: 'AC_DNC_SCOPE', message: 'global scope must not have scope_uid' });
    }
    if (scope !== 'global' && (scopeUid == null || scopeUid <= 0)) {
      throw new BadRequestException({ code: 'AC_DNC_SCOPE', message: 'scope_uid required for campaign/base scope' });
    }
  }

  private toDto(row: AcDnc): IAutodialDncEntry {
    return {
      uid: row.uid,
      user_uid: row.user_uid,
      scope: row.scope,
      scope_uid: row.scope_uid,
      normalized_phone: row.normalized_phone,
      reason: row.reason,
      source: row.source,
      expires_at: row.expires_at?.toISOString() ?? null,
    };
  }
}
