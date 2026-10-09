import { BadRequestException, ConflictException, Injectable } from '@nestjs/common';
import type { Transaction } from 'sequelize';
import { InjectModel } from '@nestjs/sequelize';
import { TenantSetting } from './tenant-setting.model';
import { TABLE_PAGE_SIZE_OPTIONS, TENANT_SETTING_KEYS, TenantSettingDescriptor } from './tenant-settings.keys';

@Injectable()
export class TenantSettingsService {
  constructor(
    @InjectModel(TenantSetting) private readonly model: typeof TenantSetting,
  ) {}

  /** Internal UID references: only ContextsService writes these, never generic settings PUT. */
  async getContextDefaults(vpbxUserUid: number, transaction?: Transaction): Promise<{ endpoints: number; trunks: number }> {
    const rows = await this.model.findAll({ where: { vpbxUserUid, key: ['contexts.default_endpoints_uid', 'contexts.default_trunks_uid'] }, transaction });
    const read = (key: string) => {
      const value = Number(rows.find((row) => row.key === key)?.value ?? 0);
      return Number.isSafeInteger(value) && value > 0 ? value : 0;
    };
    return { endpoints: read('contexts.default_endpoints_uid'), trunks: read('contexts.default_trunks_uid') };
  }

  async setContextDefault(vpbxUserUid: number, kind: 'endpoints' | 'trunks', uid: number, enabled: boolean, transaction: Transaction): Promise<void> {
    const key = `contexts.default_${kind}_uid`;
    if (enabled) {
      // Ensure the unique tenant/key row exists before locking it. Both concurrent
      // first selections and later changes must check the same persisted row.
      await this.model.findOrCreate({ where: { vpbxUserUid, key }, defaults: { vpbxUserUid, key, value: '0', category: 'contexts' }, transaction });
      const setting = await this.model.findOne({ where: { vpbxUserUid, key }, transaction, lock: transaction.LOCK.UPDATE });
      if (!setting) throw new ConflictException('Context default could not be locked');
      if (Number(setting.value) > 0 && Number(setting.value) !== uid) {
        throw new ConflictException('Сначала снимите признак основного с текущего контекста');
      }
      await setting.update({ value: String(uid) }, { transaction });
    } else {
      // Compare-and-clear: deselecting an old context cannot clear a newer selection.
      await this.model.update({ value: '0' }, { where: { vpbxUserUid, key, value: String(uid) }, transaction });
    }
  }

  async getAll(vpbxUserUid: number): Promise<Record<string, unknown>> {
    const rows = await this.model.findAll({ where: { vpbxUserUid } });
    const stored = new Map(rows.map((r) => [r.key, r.value]));
    const result: Record<string, unknown> = {};
    for (const [key, desc] of Object.entries(TENANT_SETTING_KEYS)) {
      result[key] = stored.has(key) ? this.parseValue(desc, stored.get(key) ?? null) : desc.default;
    }
    return result;
  }

  async get(vpbxUserUid: number, key: string): Promise<unknown> {
    const desc = TENANT_SETTING_KEYS[key];
    if (!desc) {
      throw new BadRequestException(`Unknown tenant setting key: ${key}`);
    }
    const row = await this.model.findOne({ where: { vpbxUserUid, key } });
    return row ? this.parseValue(desc, row.value) : desc.default;
  }

  async setMany(vpbxUserUid: number, patch: Record<string, unknown>): Promise<Record<string, unknown>> {
    const unknown = Object.keys(patch).filter((k) => !(k in TENANT_SETTING_KEYS));
    if (unknown.length) {
      throw new BadRequestException(`Unknown tenant setting keys: ${unknown.join(', ')}`);
    }
    for (const [key, value] of Object.entries(patch)) {
      this.assertType(key, value);
    }
    for (const [key, value] of Object.entries(patch)) {
      const desc = TENANT_SETTING_KEYS[key];
      await this.model.upsert({
        vpbxUserUid,
        key,
        value: this.serializeValue(desc, value),
        category: desc.category,
      });
    }
    return this.getAll(vpbxUserUid);
  }

  private assertType(key: string, value: unknown): void {
    const desc = TENANT_SETTING_KEYS[key];
    const ok =
      desc.type === 'boolean' ? typeof value === 'boolean'
      : desc.type === 'number' ? typeof value === 'number' && Number.isFinite(value)
      : desc.type === 'string' ? typeof value === 'string'
      : desc.type === 'json' ? value !== undefined
      : false;
    if (!ok) {
      throw new BadRequestException(`Invalid type for ${key}: expected ${desc.type}`);
    }
    if (key === 'tables.page_size' && !TABLE_PAGE_SIZE_OPTIONS.includes(value as 10 | 25 | 50 | 100)) {
      throw new BadRequestException(`Invalid tables.page_size: expected one of ${TABLE_PAGE_SIZE_OPTIONS.join(', ')}`);
    }
  }

  private serializeValue(desc: TenantSettingDescriptor, value: unknown): string {
    if (desc.type === 'string') return String(value);
    return JSON.stringify(value);
  }

  private parseValue(desc: TenantSettingDescriptor, raw: string | null): unknown {
    if (raw === null || raw === undefined) return desc.default;
    if (desc.type === 'string') return raw;
    try {
      const parsed = JSON.parse(raw);
      if (desc.type === 'boolean') return parsed === true || parsed === 1;
      if (desc.type === 'number') return typeof parsed === 'number' && Number.isFinite(parsed) ? parsed : desc.default;
      return parsed;
    } catch {
      if (desc.type === 'boolean') return raw === 'true' || raw === '1';
      if (desc.type === 'number') {
        const n = Number(raw);
        return Number.isFinite(n) ? n : desc.default;
      }
      return desc.default;
    }
  }
}
