import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/sequelize';
import { CloudSetting } from './cloud-setting.model';

export interface SellerInfo {
  name: string;
  inn: string;
  kpp: string;
  ogrn: string;
  address: string;
  bankName: string;
  bankBik: string;
  bankAccount: string;
  corrAccount: string;
  serviceDescription: string;
  serviceCode: string;
}

const SELLER_KEY_PREFIX = 'billing.seller.';
const KEY_MAP: Record<keyof SellerInfo, string> = {
  name:               'billing.seller.name',
  inn:                'billing.seller.inn',
  kpp:                'billing.seller.kpp',
  ogrn:               'billing.seller.ogrn',
  address:            'billing.seller.address',
  bankName:           'billing.bank.name',
  bankBik:            'billing.bank.bik',
  bankAccount:        'billing.bank.account',
  corrAccount:        'billing.bank.corr_account',
  serviceDescription: 'billing.service.description',
  serviceCode:        'billing.service.code',
};

@Injectable()
export class CloudSettingsService {
  constructor(
    @InjectModel(CloudSetting) private readonly settingModel: typeof CloudSetting,
  ) {}

  // ─── Helpers ──────────────────────────────────────────────────────────────

  async get(key: string): Promise<string | null> {
    const row = await this.settingModel.findOne({ where: { key } });
    return row?.value ?? null;
  }

  async set(key: string, value: string, description?: string): Promise<void> {
    await this.settingModel.upsert({ key, value, description: description ?? null } as any);
  }

  // ─── Seller Info ──────────────────────────────────────────────────────────

  async getSellerInfo(): Promise<SellerInfo> {
    const rows = await this.settingModel.findAll({
      where: { key: Object.values(KEY_MAP) as any },
    });
    const map = new Map(rows.map((r) => [r.key, r.value ?? '']));
    const result = {} as SellerInfo;
    for (const [field, key] of Object.entries(KEY_MAP) as [keyof SellerInfo, string][]) {
      result[field] = map.get(key) ?? '';
    }
    return result;
  }

  async updateSellerInfo(partial: Partial<SellerInfo>): Promise<SellerInfo> {
    for (const [field, value] of Object.entries(partial) as [keyof SellerInfo, string][]) {
      const key = KEY_MAP[field];
      if (key && value !== undefined) {
        await this.set(key, value);
      }
    }
    return this.getSellerInfo();
  }
}
